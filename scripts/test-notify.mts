// Order notification test against the in-memory store, with no email/SMS provider set,
// so every attempt is logged as "skipped" and nothing leaves the machine.
// Run: npm run test:notify
process.env.JDHUB_MEMORY_ONLY = "1";
delete process.env.RESEND_API_KEY;
delete process.env.TERMII_API_KEY;
process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example";

import { placeOrder, transitionOrder, sweepExpiredOrders } from "../lib/orders";
import { getSettings, saveSettings, getOrder } from "../lib/store";
import { DEFAULT_NOTIFY_SETTINGS, NOTIFY_EVENTS, eventForStatus, maskEmail, maskPhone } from "../lib/notify/events";
import { flushNotifications, latestEvent, renderOrderMessage, renderPreviews, renderStoreAlert, sampleOrder, toE164 } from "../lib/notify/orders";
import { getNotifySettings, listNotifyLog, listOrderNotifyLog, saveNotifySettings } from "../lib/notify/store";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };
// Silence the "(not sent, no RESEND_API_KEY)" development notices.
console.info = () => undefined;

// ------------------------------------------------------------ Templates

const settings = await getSettings();
const evil = `<script>alert("x")</script>`;
const ctx = { settings: { ...settings, storeName: `JD & Co`, bank: { bankName: "Zenith <Bank>", accountName: "JD Escrow", accountNumber: "1234567890" } }, site: "https://shop.example", paystack: false };
for (const delivery of ["delivery", "pickup"] as const) {
  const base = sampleOrder(ctx.settings, delivery);
  const o = {
    ...base,
    customer: { ...base.customer, name: `Ada ${evil}`, address: `1 "Quote" St & <b>bold</b>` },
    lines: [{ ...base.lines[0], name: `Phone ${evil}`, spec: `<img src=x onerror=alert(1)>` }],
    customerNote: evil,
    history: base.history.map((h) => (h.status === "cancelled" ? { ...h, by: "Admin", note: `Buyer said ${evil} · Stock restored` } : h.status === "shipped" ? { ...h, note: `Tracking ${evil}` } : h)),
  };
  for (const ev of NOTIFY_EVENTS) {
    const m = renderOrderMessage(ev, o, ctx);
    assert(m.subject && m.text && m.sms && m.html.startsWith("<!doctype html>"), `${delivery}/${ev}: renders subject, html, text and sms`);
    assert(!/<script|<img|<b>bold/i.test(m.html), `${delivery}/${ev}: user text is escaped in html`);
    assert(m.html.includes(`https://shop.example/order/${o.id}?t=${o.token}`), `${delivery}/${ev}: CTA links to the order page with token`);
    assert(m.sms.length <= 480 && !m.sms.includes("\n"), `${delivery}/${ev}: sms is one line, <= 480 chars (${m.sms.length})`);
  }
  const placed = renderOrderMessage("placed", o, ctx);
  assert(placed.html.includes("&lt;script&gt;") && placed.html.includes("Zenith &lt;Bank&gt;") && placed.html.includes("1234567890"), `${delivery}/placed: escaped name + bank details`);
  assert(placed.html.includes("holding your items until"), `${delivery}/placed: shows reservation expiry`);
  assert(placed.html.includes("wa.me/"), `${delivery}/placed: WhatsApp link`);
  const cancelled = renderOrderMessage("cancelled", o, ctx);
  assert(cancelled.html.includes("Reason:") && !cancelled.html.includes("Stock restored"), `${delivery}/cancelled: shows reason without internal marker`);
  const alert = renderStoreAlert(o, ctx);
  assert(!/<script|<img/i.test(alert.html) && alert.html.includes("/admin/orders/"), `${delivery}: store alert escaped, links to admin`);
}
const pickup = sampleOrder(settings, "pickup");
const ready = renderOrderMessage("ready", pickup, ctx);
assert(ready.subject.includes(settings.hubs[0].city) && ready.html.includes(settings.hubs[0].address.replace(/&/g, "&amp;")), "ready: names the hub and its address");
assert(renderOrderMessage("placed", { ...pickup, payment: { method: "paystack" } }, { ...ctx, paystack: true }).html.includes(">Pay now<"), "paystack order: CTA is Pay now");
const expired = renderOrderMessage("cancelled", sampleOrder(settings), ctx);
assert(/reservation window closed/.test(expired.html), "auto-cancel explains the payment window expired");
assert(!renderOrderMessage("placed", pickup, ctx).sms.includes("₦"), "sms uses NGN, not ₦ (keeps GSM encoding)");
assert((await renderPreviews()).length === NOTIFY_EVENTS.length + 1, "previews render every template plus the store alert");

assert(eventForStatus("shipped", "pickup") === "ready" && eventForStatus("shipped", "delivery") === "shipped" && eventForStatus("completed", "delivery") === null, "status -> event mapping");
assert(maskEmail("adaobi@gmail.com") === "ad••••@gmail.com" && maskPhone("+2348031234567") === "+234803 ••• 4567", "recipients are masked");
assert(toE164("08031234567") === "+2348031234567" && toE164("+234 800 000 0000") === "+2348000000000" && toE164("12") === null, "phone numbers normalised for SMS");

// ------------------------------------------------------------ Settings

const d = await getNotifySettings();
assert(JSON.stringify(d) === JSON.stringify(DEFAULT_NOTIFY_SETTINGS), "defaults when nothing is stored");
assert(NOTIFY_EVENTS.every((e) => d.events[e].email) && d.events.shipped.sms && d.events.ready.sms && d.events.cancelled.sms && !d.events.paid.sms, "defaults: all email on, SMS for shipped/ready/cancelled");

// ------------------------------------------------------------ Hooks

const cust = { name: "Ada <Obi>", phone: "08031234567", email: "ada@example.com", state: "Lagos", address: "1 Allen Ave" };
const count = async (id: string, event: string, channel?: string) => (await listOrderNotifyLog(id)).filter((e) => e.event === event && (!channel || e.channel === channel)).length;

const placed = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], customer: cust, delivery: "pickup", pickupHub: settings.hubs[0].city, paymentMethod: "transfer" });
assert(placed.ok, `order placed ${!placed.ok ? placed.error : ""}`);
if (placed.ok) {
  const id = placed.order.id;
  await flushNotifications();
  assert((await count(id, "placed", "email")) === 1 && (await count(id, "placed", "sms")) === 0, "placed: one email, no SMS (toggle off)");
  assert((await count(id, "store-alert", "email")) === 1, "placed: one store alert email");
  const entries = await listOrderNotifyLog(id);
  assert(entries.every((e) => e.status === "skipped" && !e.to.includes("ada@") && e.to.includes("•")), "without providers every attempt is logged as skipped, recipients masked");

  // Paying twice (callback + webhook) is a no-op the second time.
  await Promise.all([transitionOrder(id, "paid", "paystack"), transitionOrder(id, "paid", "paystack")]);
  await transitionOrder(id, "paid", "admin");
  await flushNotifications();
  assert((await count(id, "paid")) === 1, `paid: exactly one message for three paid calls (got ${await count(id, "paid")})`);

  await transitionOrder(id, "processing", "admin");
  await transitionOrder(id, "shipped", "admin", { note: "Ask for Tunde" });
  await transitionOrder(id, "shipped", "admin");
  await flushNotifications();
  assert((await count(id, "processing")) === 1, "processing: one message");
  assert((await count(id, "ready", "email")) === 1 && (await count(id, "ready", "sms")) === 1 && (await count(id, "shipped")) === 0, "pickup shipped -> one 'ready' email + SMS");

  await transitionOrder(id, "delivered", "admin");
  await transitionOrder(id, "completed", "admin");
  await transitionOrder(id, "refunded", "admin");
  await transitionOrder(id, "refunded", "admin");
  await flushNotifications();
  assert((await count(id, "delivered")) === 1 && (await count(id, "refunded")) === 1, "delivered and refunded: one each; completed sends nothing");
  assert(latestEvent((await getOrder(id))!) === "refunded", "latest event for resend");

  // Toggling an event off stops it.
  await saveNotifySettings({ ...DEFAULT_NOTIFY_SETTINGS, events: { ...DEFAULT_NOTIFY_SETTINGS.events, placed: { email: false, sms: false } }, storeAlert: { email: false, sms: false } });
  const quiet = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" });
  await flushNotifications();
  if (quiet.ok) assert((await listOrderNotifyLog(quiet.order.id)).length === 0, "toggled-off events send nothing");
  await saveNotifySettings(DEFAULT_NOTIFY_SETTINGS);
}

// The sweep's auto-cancel sends the cancelled message.
await saveSettings({ ...settings, reservationMinutes: 0 });
const exp = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" });
await new Promise((r) => setTimeout(r, 20));
await sweepExpiredOrders();
await sweepExpiredOrders();
await flushNotifications();
if (exp.ok) {
  assert((await getOrder(exp.order.id))!.status === "cancelled", "sweep cancelled the expired order");
  assert((await count(exp.order.id, "cancelled", "email")) === 1 && (await count(exp.order.id, "cancelled", "sms")) === 1, "sweep auto-cancel: one cancelled email + SMS");
}
await saveSettings(settings);

const log = await listNotifyLog();
assert(log.length > 0 && log.every((e) => e.at && e.event && e.channel && e.status), "global log records every attempt");
