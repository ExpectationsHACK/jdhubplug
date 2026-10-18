import "server-only";

import { after } from "next/server";
import { emailLayout, escapeHtml as e, sendEmail, sendSms, smsEnabled, type MessageResult } from "../messaging";
import { waLink } from "../settings";
import { getSettings } from "../store";
import type { Order, Settings } from "../types";
import {
  EVENT_LABEL,
  eventForStatus,
  maskEmail,
  maskPhone,
  type Channel,
  type LogEvent,
  type NotifyEvent,
  type NotifyLogEntry,
} from "./events";
import { appendNotifyLog, getNotifySettings } from "./store";

// Order notifications by email (Resend) and SMS (Termii).
//
//   renderOrderMessage   pure templates: subject, HTML email, plain text and a short SMS
//   notifyOrderPlaced    confirmation to the buyer + new-order alert to the store
//   notifyOrderTransition the message for the status an order just reached
//   resendOrderMessage   admin "resend" from the order page (awaited, returns results)
//
// Hooks never block or fail the order: delivery runs in after() (or fire-and-forget
// outside a request) and every attempt, sent or not, lands in the message log.

export type TemplateContext = {
  settings: Settings;
  /** Public site origin without a trailing slash. */
  site: string;
  /** Paystack is configured, so "pay by card" links work. */
  paystack: boolean;
};

export type RenderedMessage = { subject: string; preheader: string; title: string; html: string; text: string; sms: string };

// --------------------------------------------------------------- Formatting

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const money = (n: number) => naira.format(n);
/** SMS-safe amount: "₦" would force the whole SMS into UCS-2 (70 characters a part). */
const smsMoney = (n: number) => `NGN ${Math.round(n).toLocaleString("en-NG")}`;

const lagosTime = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

const firstName = (o: Order) => o.customer.name.trim().split(/\s+/)[0] || "there";
/** Single line, no control characters, capped (admin notes and hub text going into SMS). */
const oneLine = (s: string, max = 120) =>
  s
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const orderLink = (o: Pick<Order, "id" | "token">, site: string) => `${site}/order/${encodeURIComponent(o.id)}?t=${encodeURIComponent(o.token)}`;

const hubFor = (o: Order, s: Settings) => (o.pickupHub ? s.hubs.find((h) => h.city === o.pickupHub) : undefined);

/** Latest history note for `status`, without the internal "Stock restored" marker. */
function noteFor(o: Order, status: Order["status"]) {
  const ev = o.history.findLast((h) => h.status === status);
  const note = (ev?.note ?? "")
    .split(" · ")
    .filter((p) => !/^stock (restored|released)$/i.test(p.trim()))
    .join(" · ")
    .trim();
  return { ev, note };
}

function cancelReason(o: Order) {
  const { ev, note } = noteFor(o, "cancelled");
  if (ev?.by === "system" || /payment window expired/i.test(note)) return "We didn't receive payment before the reservation window closed, so the items were released.";
  return note;
}

// ------------------------------------------------------------ HTML pieces

const P = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const muted = (html: string) => `<p style="margin:0 0 14px;font-size:13px;color:#757575">${html}</p>`;
const box = (html: string) => `<div style="margin:0 0 16px;padding:14px 16px;background:#f4f4f4;border-radius:14px">${html}</div>`;
const h2 = (t: string) => `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#757575">${e(t)}</p>`;
const link = (href: string, label: string) => `<a href="${e(href)}" style="color:#1428a0;font-weight:700">${e(label)}</a>`;

function kv(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 0;color:#757575">${e(k)}</td><td align="right" style="padding:4px 0;font-weight:700">${e(v)}</td></tr>`)
    .join("")}</table>`;
}

function itemsHtml(o: Order) {
  const lines = o.lines
    .map(
      (l) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top"><div style="font-weight:700">${e(l.name)}</div>${l.spec ? `<div style="font-size:13px;color:#757575">${e(l.spec)}</div>` : ""}<div style="font-size:13px;color:#555">${l.qty} × ${e(money(l.finalUnitPrice))}</div></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;font-weight:700;white-space:nowrap">${e(money(l.finalUnitPrice * l.qty))}</td></tr>`,
    )
    .join("");
  const total = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? "font-weight:700;font-size:16px" : "color:#555"}">${e(k)}</td><td align="right" style="padding:4px 0;${strong ? "font-weight:800;font-size:16px" : ""}">${e(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${lines}
<tr><td colspan="2" style="height:8px"></td></tr>
${total("Subtotal", money(o.subtotal))}
${o.discount > 0 ? total(`Discount${o.offerCode ? ` (${o.offerCode.toUpperCase()})` : ""}`, `−${money(o.discount)}`) : ""}
${total(o.delivery === "pickup" ? "Pickup" : "Delivery", o.deliveryFee ? money(o.deliveryFee) : "Free")}
${total("Total", money(o.total), true)}</table>`;
}

function fulfilmentHtml(o: Order, s: Settings) {
  if (o.delivery === "pickup") {
    const hub = hubFor(o, s);
    return box(
      `<b>Pickup at ${e(o.pickupHub ?? "our")} hub</b>${hub ? `<br>${e(hub.address)}<br><span style="color:#757575">${e(hub.hours)}</span>` : ""}`,
    );
  }
  const c = o.customer;
  const place = [c.city, c.state].filter(Boolean).join(", ");
  return box(`<b>Delivery to ${e(c.name)}</b>${c.address ? `<br>${e(c.address)}` : ""}${place ? `<br>${e(place)}` : ""}<br><span style="color:#757575">${e(c.phone)}</span>`);
}

function paymentHtml(o: Order, ctx: TemplateContext) {
  const { settings: s } = ctx;
  const wa = waLink(s.whatsapp, `Hi ${s.storeName}, about my order ${o.id}.`);
  const bank = s.bank;
  const hasBank = !!(bank.accountNumber && bank.bankName);
  const parts: string[] = [h2("How to pay")];
  if (o.payment.method === "paystack" && ctx.paystack) {
    parts.push(P(`Pay securely by card, bank transfer or USSD on Paystack from your ${link(orderLink(o, ctx.site), "order page")}. We confirm it instantly.`));
  } else if (o.payment.method === "whatsapp") {
    parts.push(P(`${link(wa, "Message us on WhatsApp")} and our team will confirm payment options and delivery with you.`));
  } else if (hasBank) {
    parts.push(P(`Transfer exactly <b>${e(money(o.total))}</b> to our escrow account and use your order number as the reference:`));
    parts.push(
      box(
        kv([
          ["Bank", bank.bankName],
          ["Account name", bank.accountName],
          ["Account number", bank.accountNumber],
          ["Amount", money(o.total)],
          ["Reference", o.id],
        ]),
      ),
    );
    parts.push(P(`Sent it? ${link(wa, "Share the receipt on WhatsApp")} and we'll confirm within minutes.`));
  } else {
    parts.push(P(`Our team will send the escrow account details on ${link(wa, "WhatsApp")}. Use <b>${e(o.id)}</b> as the transfer reference.`));
  }
  if (o.reservedUntil) {
    parts.push(box(`We're holding your items until <b>${e(lagosTime(o.reservedUntil))}</b> (Lagos time). If we haven't received payment by then, the order cancels automatically and the items go back on sale.`));
  }
  return parts.join("");
}

function footerHtml(s: Settings) {
  const wa = waLink(s.whatsapp, `Hi ${s.storeName}`);
  return `Questions about your order? Reply to this email, ${link(wa, "WhatsApp us")} or call ${e(s.phone)}.<br>You're receiving this because you placed an order with ${e(s.storeName)}.`;
}

// ---------------------------------------------------------------- Templates

type Draft = { subject: string; preheader: string; title: string; body: string; text: string[]; sms: string; cta: string };

/** Render the customer message for `event`. Pure: no store or network access. */
export function renderOrderMessage(event: NotifyEvent, o: Order, ctx: TemplateContext): RenderedMessage {
  const s = ctx.settings;
  const store = s.storeName;
  const url = orderLink(o, ctx.site);
  const hi = P(`Hi ${e(firstName(o))},`);
  const hub = hubFor(o, s);
  const total = money(o.total);
  let d: Draft;

  switch (event) {
    case "placed": {
      const pending = o.status === "pending";
      const payOnline = pending && o.payment.method === "paystack" && ctx.paystack;
      d = {
        subject: `Order ${o.id} confirmed: ${total}`,
        preheader: pending && o.reservedUntil ? `Pay by ${lagosTime(o.reservedUntil)} to keep your items.` : `Thanks for your order with ${store}.`,
        title: "Thanks, we've got your order",
        body:
          hi +
          P(`Your order <b>${e(o.id)}</b> is in and the items are reserved for you. Every ${e(store)} order is escrow-protected: we only release the money once you've received what you paid for.`) +
          h2("Your order") +
          itemsHtml(o) +
          h2(o.delivery === "pickup" ? "Pickup" : "Delivery") +
          fulfilmentHtml(o, s) +
          (pending ? paymentHtml(o, ctx) : ""),
        text: [
          `Order ${o.id} received.`,
          ...o.lines.map((l) => `- ${l.qty} x ${l.name}: ${money(l.finalUnitPrice * l.qty)}`),
          `Total: ${total}`,
          o.delivery === "pickup" ? `Pickup at ${o.pickupHub ?? "our"} hub${hub ? `, ${hub.address}` : ""}` : `Delivery to ${[o.customer.address, o.customer.city, o.customer.state].filter(Boolean).join(", ")}`,
          pending && s.bank.accountNumber && o.payment.method !== "whatsapp" && !payOnline
            ? `Pay by transfer: ${s.bank.bankName}, ${s.bank.accountName}, ${s.bank.accountNumber}. Reference: ${o.id}.`
            : "",
          pending && o.reservedUntil ? `We're holding your items until ${lagosTime(o.reservedUntil)} (Lagos time).` : "",
        ],
        sms: pending && o.reservedUntil
          ? `${store}: order ${o.id} received (${smsMoney(o.total)}). Pay by ${lagosTime(o.reservedUntil)} to keep your items: ${url}`
          : `${store}: order ${o.id} received (${smsMoney(o.total)}). Track it: ${url}`,
        cta: payOnline ? "Pay now" : "View your order",
      };
      break;
    }
    case "paid":
      d = {
        subject: `Payment received for ${o.id}`,
        preheader: `${total} received and held in escrow.`,
        title: "Payment received",
        body:
          hi +
          P(`We've received <b>${e(total)}</b> for order <b>${e(o.id)}</b>. The money is held in escrow until you've received your order.`) +
          (o.payment.reference ? box(kv([["Payment reference", o.payment.reference]])) : "") +
          P(o.delivery === "pickup" ? "We'll let you know as soon as it's ready for pickup." : "We'll let you know as soon as it's on its way."),
        text: [`We've received ${total} for order ${o.id}. It's held in escrow until you receive your order.`],
        sms: `${store}: payment of ${smsMoney(o.total)} for order ${o.id} received and held in escrow. Track: ${url}`,
        cta: "Track your order",
      };
      break;
    case "processing":
      d = {
        subject: `We're preparing order ${o.id}`,
        preheader: "Your items are being inspected and packed.",
        title: "We're preparing your order",
        body: hi + P(`Order <b>${e(o.id)}</b> is being inspected and packed. ${o.delivery === "pickup" ? "We'll tell you the moment it's ready at the hub." : "We'll tell you the moment it ships."}`) + itemsHtml(o),
        text: [`Order ${o.id} is being inspected and packed.`],
        sms: `${store}: we're preparing order ${o.id}. Track: ${url}`,
        cta: "Track your order",
      };
      break;
    case "shipped": {
      const { note } = noteFor(o, "shipped");
      d = {
        subject: `Order ${o.id} is on its way`,
        preheader: "Your order is out for delivery.",
        title: "Your order is on its way",
        body:
          hi +
          P(`Good news: order <b>${e(o.id)}</b> has left us and is on its way to you.`) +
          (note ? box(e(note)) : "") +
          h2("Delivering to") +
          fulfilmentHtml(o, s) +
          muted("Please check the item when it arrives. Your money stays in escrow until you're happy with it."),
        text: [`Order ${o.id} is on its way to you.`, note],
        sms: `${store}: order ${o.id} is on its way to you.${note ? ` ${oneLine(note, 80)}.` : ""} Track: ${url}`,
        cta: "Track your order",
      };
      break;
    }
    case "ready": {
      const { note } = noteFor(o, "shipped");
      const where = `${o.pickupHub ?? "our"} hub`;
      d = {
        subject: `Order ${o.id} is ready for pickup at ${where}`,
        preheader: hub ? `${hub.address} · ${hub.hours}` : "Bring your order number when you come.",
        title: `Ready for pickup at ${where}`,
        body:
          hi +
          P(`Order <b>${e(o.id)}</b> is waiting for you. Bring your order number and a valid ID when you come.`) +
          fulfilmentHtml(o, s) +
          (note ? box(e(note)) : "") +
          muted("Check the item at the hub before you leave. Your money stays in escrow until you're happy with it."),
        text: [`Order ${o.id} is ready for pickup at ${where}.`, hub ? `${hub.address} (${hub.hours})` : "", note],
        sms: `${store}: order ${o.id} is ready for pickup at ${oneLine(where, 40)}${hub ? `, ${oneLine(hub.address, 80)} (${oneLine(hub.hours, 40)})` : ""}. Bring your order number. ${url}`,
        cta: "View pickup details",
      };
      break;
    }
    case "delivered": {
      const verb = o.delivery === "pickup" ? "collected" : "delivered";
      const wa = waLink(s.whatsapp, `Hi ${store}, about my order ${o.id}.`);
      d = {
        subject: `Order ${o.id} ${verb}`,
        preheader: `Thanks for shopping with ${store}.`,
        title: `Your order has been ${verb}`,
        body:
          hi +
          P(`Order <b>${e(o.id)}</b> has been ${verb}. We hope you love it.`) +
          P(`If anything isn't as described, ${link(wa, "message us on WhatsApp")} right away. Your payment is still protected by escrow.`) +
          P(`Happy with it? ${link(`${url}#review`, "Leave a verified review")}: it helps other buyers choose with confidence.`),
        text: [`Order ${o.id} has been ${verb}. If anything isn't as described, contact us on WhatsApp: ${wa}`, `Leave a verified review: ${url}#review`],
        sms: `${store}: order ${o.id} has been ${verb}. Thank you! Anything wrong? WhatsApp +${s.whatsapp.replace(/\D/g, "")}`,
        cta: "View your order",
      };
      break;
    }
    case "cancelled": {
      const reason = cancelReason(o);
      d = {
        subject: `Order ${o.id} was cancelled`,
        preheader: reason || "Your order has been cancelled.",
        title: "Your order was cancelled",
        body:
          hi +
          P(`Order <b>${e(o.id)}</b> has been cancelled.`) +
          (reason ? box(`<b>Reason:</b> ${e(reason)}`) : "") +
          P(o.payment.paidAt ? "If you've already paid, we'll be in touch about your refund." : "You haven't been charged. If you still want the items, you're welcome to order again while they're in stock."),
        text: [`Order ${o.id} has been cancelled.`, reason ? `Reason: ${reason}` : ""],
        sms: `${store}: order ${o.id} was cancelled.${reason ? ` ${oneLine(reason, 110)}` : ""} ${url}`,
        cta: "View order",
      };
      break;
    }
    case "refunded":
      d = {
        subject: `Refund for order ${o.id}`,
        preheader: `${total} refunded.`,
        title: "Your refund is on its way",
        body:
          hi +
          P(`We've refunded <b>${e(total)}</b> for order <b>${e(o.id)}</b>.`) +
          muted("Depending on your bank, it can take a few working days to show in your account. If it hasn't arrived after that, reply to this email."),
        text: [`We've refunded ${total} for order ${o.id}. It can take a few working days to show in your account.`],
        sms: `${store}: we've refunded ${smsMoney(o.total)} for order ${o.id}. It can take a few working days to reach you.`,
        cta: "View order",
      };
      break;
  }

  const html = emailLayout({ storeName: store, preheader: d.preheader, title: d.title, body: d.body, cta: { label: d.cta, href: url }, footer: footerHtml(s) });
  const text = [`Hi ${firstName(o)},`, "", ...d.text.filter(Boolean), "", `${d.cta}: ${url}`, "", `${store} · WhatsApp +${s.whatsapp.replace(/\D/g, "")} · ${s.phone}`].join("\n");
  return { subject: d.subject, preheader: d.preheader, title: d.title, html, text, sms: oneLine(d.sms, 480) };
}

/** New-order alert for the store's own inbox and phone. */
export function renderStoreAlert(o: Order, ctx: TemplateContext): RenderedMessage {
  const s = ctx.settings;
  const admin = `${ctx.site}/admin/orders/${encodeURIComponent(o.id)}`;
  const items = o.lines.reduce((n, l) => n + l.qty, 0);
  const method = { paystack: "Paystack", transfer: "Bank transfer", whatsapp: "WhatsApp" }[o.payment.method];
  const title = `New order ${o.id}`;
  const body =
    P(`<b>${e(o.customer.name)}</b> placed an order for <b>${e(money(o.total))}</b> (${items} item${items === 1 ? "" : "s"}, ${e(method)}).`) +
    box(kv([["Phone", o.customer.phone], ...(o.customer.email ? ([["Email", o.customer.email]] as [string, string][]) : []), ["Payment", method], ["Fulfilment", o.delivery === "pickup" ? `Pickup, ${o.pickupHub ?? "hub not set"}` : `Delivery, ${o.customer.state}`]])) +
    itemsHtml(o) +
    (o.customerNote ? box(`<b>Note from customer:</b><br>${e(o.customerNote)}`) : "") +
    (o.reservedUntil ? muted(`Stock is reserved until ${e(lagosTime(o.reservedUntil))} (Lagos time).`) : "");
  const html = emailLayout({ storeName: s.storeName, preheader: `${money(o.total)} from ${o.customer.name}`, title, body, cta: { label: "Open in admin", href: admin }, footer: `Store alert for ${e(s.storeName)}. Turn these off in Admin → Notifications.` });
  const text = [`${title}: ${money(o.total)} from ${o.customer.name} (${o.customer.phone}).`, ...o.lines.map((l) => `- ${l.qty} x ${l.name}`), `Payment: ${method}`, admin].join("\n");
  return {
    subject: `${title}: ${money(o.total)} from ${oneLine(o.customer.name, 60)}`,
    preheader: "",
    title,
    html,
    text,
    sms: oneLine(`${s.storeName}: new order ${o.id}, ${smsMoney(o.total)} from ${oneLine(o.customer.name, 40)} (${items} item${items === 1 ? "" : "s"}, ${method}). ${admin}`, 480),
  };
}

// ----------------------------------------------------------------- Delivery

/** E.164 (+234…) for Nigerian numbers; other "+" numbers pass through; null if unusable. */
export function toE164(phone: string): string | null {
  const raw = phone.trim();
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) return `+${d}`;
  if (d.startsWith("0") && d.length === 11) return `+234${d.slice(1)}`;
  if (d.length === 10 && /^[789]/.test(d)) return `+234${d}`;
  if (raw.startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

const isEmail = (s: string | undefined): s is string => !!s && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s.trim());

async function templateContext(): Promise<TemplateContext> {
  // Lazy import: lib/paystack imports lib/orders, which imports this module.
  const { paystackEnabled, requestOrigin, siteUrl } = await import("../paystack");
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  // Request headers aren't readable everywhere after() runs (e.g. Server Components), so only try them as a fallback.
  const origin = configured || (await requestOrigin().catch(() => null));
  return { settings: await getSettings(), site: siteUrl(origin), paystack: paystackEnabled() };
}

type Attempt = { event: LogEvent; orderId?: string; audience: NotifyLogEntry["audience"]; by?: string };

async function record(a: Attempt, channel: Channel, to: string, res: MessageResult) {
  const entry: NotifyLogEntry = {
    at: new Date().toISOString(),
    event: a.event,
    orderId: a.orderId,
    channel,
    to: channel === "email" ? maskEmail(to) : maskPhone(to),
    status: res.ok ? "ok" : res.skipped ? "skipped" : "error",
    audience: a.audience,
    detail: res.ok ? res.id : res.error.slice(0, 200),
    by: a.by,
  };
  await appendNotifyLog(entry).catch((err) => console.error("[notify] couldn't write the message log", err));
  return entry;
}

async function emailTo(a: Attempt, to: string, m: RenderedMessage, replyTo?: string) {
  return record(a, "email", to, await sendEmail({ to: to.trim(), subject: m.subject, html: m.html, text: m.text, replyTo }));
}

async function smsTo(a: Attempt, phone: string, m: RenderedMessage) {
  const to = toE164(phone);
  if (!to) return record(a, "sms", phone, { ok: false, skipped: true, error: "Not a valid phone number for SMS." });
  return record(a, "sms", to, await sendSms(to, m.sms));
}

type Channels = { email: boolean; sms: boolean };

async function sendCustomer(event: NotifyEvent, o: Order, ctx: TemplateContext, channels: Channels, by?: string) {
  const m = renderOrderMessage(event, o, ctx);
  const a: Attempt = { event, orderId: o.id, audience: "customer", by };
  const out: NotifyLogEntry[] = [];
  const email = o.customer.email?.trim();
  if (channels.email && isEmail(email)) out.push(await emailTo(a, email, m, isEmail(ctx.settings.email) ? ctx.settings.email : undefined));
  if (channels.sms) {
    // Without a provider this logs a "skipped" entry, so admins can see what would have gone out.
    out.push(smsEnabled() ? await smsTo(a, o.customer.phone, m) : await record(a, "sms", o.customer.phone, { ok: false, skipped: true, error: "SMS isn't set up (TERMII_API_KEY)." }));
  }
  return out;
}

async function sendStoreAlert(o: Order, ctx: TemplateContext, channels: Channels) {
  const m = renderStoreAlert(o, ctx);
  const a: Attempt = { event: "store-alert", orderId: o.id, audience: "store" };
  const out: NotifyLogEntry[] = [];
  if (channels.email && isEmail(ctx.settings.email)) out.push(await emailTo(a, ctx.settings.email, m, isEmail(o.customer.email) ? o.customer.email : undefined));
  if (channels.sms && ctx.settings.phone) out.push(await smsTo(a, ctx.settings.phone, m));
  return out;
}

// --------------------------------------------------------------- Scheduling

const g = globalThis as unknown as { __jdNotifyPending?: Set<Promise<void>> };
const pending = (g.__jdNotifyPending ??= new Set());

/** Run `task` after the response is sent; outside a request, start it now without waiting. */
function schedule(label: string, task: () => Promise<unknown>) {
  const run = () => {
    const p: Promise<void> = task()
      .then(() => undefined)
      .catch((err) => console.error(`[notify] ${label} failed`, err))
      .finally(() => pending.delete(p));
    pending.add(p);
    return p;
  };
  try {
    after(run);
  } catch {
    // Outside a request (scripts/tests).
    void run();
  }
}

/** Wait for every scheduled notification to finish (tests and scripts). */
export async function flushNotifications() {
  while (pending.size) await Promise.allSettled([...pending]);
}

/** Order confirmation to the buyer and new-order alert to the store. Never throws. */
export function notifyOrderPlaced(order: Order) {
  schedule(`placed ${order.id}`, async () => {
    const [ctx, prefs] = await Promise.all([templateContext(), getNotifySettings()]);
    await Promise.all([sendCustomer("placed", order, ctx, prefs.events.placed), sendStoreAlert(order, ctx, prefs.storeAlert)]);
  });
}

/**
 * The message for the status `order` just moved to from `from`. Call once per real
 * transition (lib/orders.ts does, after saving); no-op transitions send nothing.
 */
export function notifyOrderTransition(order: Order, from: Order["status"]) {
  if (from === order.status) return;
  const event = eventForStatus(order.status, order.delivery);
  if (!event || event === "placed") return;
  schedule(`${event} ${order.id}`, async () => {
    const [ctx, prefs] = await Promise.all([templateContext(), getNotifySettings()]);
    await sendCustomer(event, order, ctx, prefs.events[event]);
  });
}

/** The event that describes where the order is now (the latest status with a message). */
export function latestEvent(o: Order): NotifyEvent {
  for (const h of [...o.history].reverse()) {
    if (h.status === "note") continue;
    const ev = eventForStatus(h.status, o.delivery);
    if (ev) return ev;
  }
  return "placed";
}

export type ResendResult = { event: NotifyEvent; entries: NotifyLogEntry[] };

/**
 * Admin resend from the order page. Ignores the per-event toggles: email goes out when
 * the buyer gave an address; SMS when there's no email, or the event's SMS toggle is on.
 */
export async function resendOrderMessage(order: Order, kind: "confirmation" | "latest", by: string): Promise<ResendResult> {
  const event = kind === "confirmation" ? "placed" : latestEvent(order);
  const [ctx, prefs] = await Promise.all([templateContext(), getNotifySettings()]);
  const hasEmail = isEmail(order.customer.email);
  const entries = await sendCustomer(event, order, ctx, { email: true, sms: !hasEmail || prefs.events[event].sms }, by);
  return { event, entries };
}

/** A sample message to check the email provider. */
export async function sendTestEmail(to: string, by: string) {
  const ctx = await templateContext();
  const s = ctx.settings;
  const html = emailLayout({
    storeName: s.storeName,
    preheader: "Your email settings work.",
    title: "Test email",
    body: P(`This is a test from ${e(s.storeName)} admin, sent by ${e(by)}. If you can read it, order emails will reach your customers.`),
    cta: { label: "Open notifications", href: `${ctx.site}/admin/notifications` },
  });
  return record({ event: "test", audience: "test", by }, "email", to, await sendEmail({ to, subject: `${s.storeName} test email`, html, text: `This is a test email from ${s.storeName} admin, sent by ${by}.` }));
}

// ----------------------------------------------------------------- Previews

/** A realistic order for template previews. */
export function sampleOrder(s: Settings, delivery: Order["delivery"] = "delivery"): Order {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const hub = s.hubs[0];
  return {
    id: "JDH-10234",
    token: "preview",
    createdAt: at(120),
    updatedAt: at(1),
    status: "pending",
    lines: [
      { productId: "iphone-13", name: "iPhone 13 128GB", spec: "Midnight · Like new · 91% battery", qty: 1, unitPrice: 520_000, finalUnitPrice: 495_000 },
      { productId: "airpods", name: "AirPods Pro (2nd gen)", spec: "Great condition", qty: 1, unitPrice: 145_000, finalUnitPrice: 145_000 },
    ],
    subtotal: 640_000,
    discount: 0,
    deliveryFee: delivery === "pickup" ? 0 : s.deliveryFeeLagos,
    total: 640_000 + (delivery === "pickup" ? 0 : s.deliveryFeeLagos),
    customer: { name: "Ada Obi", phone: "+2348031234567", email: "ada@example.com", address: "12 Allen Avenue", city: "Ikeja", state: "Lagos" },
    delivery,
    pickupHub: delivery === "pickup" ? hub?.city : undefined,
    payment: { method: "transfer", reference: "TRF-88213" },
    reservedUntil: new Date(now + s.reservationMinutes * 60_000).toISOString(),
    history: [
      { at: at(120), status: "pending", by: "customer", note: "Order placed, stock reserved" },
      { at: at(60), status: "shipped", by: "Tunde (Manager)", note: delivery === "pickup" ? "Ask for Tunde at the front desk" : "Tracking: GIG Logistics #GL123456" },
      { at: at(1), status: "cancelled", by: "system", note: "Payment window expired; stock released" },
    ],
  };
}

/** Every template rendered for the sample order, for the admin previews. */
export async function renderPreviews(): Promise<{ event: LogEvent; label: string; message: RenderedMessage }[]> {
  const ctx = await templateContext();
  const delivery = sampleOrder(ctx.settings, "delivery");
  const pickup = sampleOrder(ctx.settings, "pickup");
  const list: { event: LogEvent; label: string; message: RenderedMessage }[] = (["placed", "paid", "processing", "shipped", "ready", "delivered", "cancelled", "refunded"] as NotifyEvent[]).map((event) => ({
    event,
    label: EVENT_LABEL[event],
    message: renderOrderMessage(event, event === "ready" ? pickup : event === "paid" ? { ...delivery, status: "paid", payment: { ...delivery.payment, paidAt: delivery.updatedAt } } : delivery, ctx),
  }));
  list.push({ event: "store-alert", label: EVENT_LABEL["store-alert"], message: renderStoreAlert(delivery, ctx) });
  return list;
}
