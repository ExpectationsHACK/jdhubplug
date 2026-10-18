import "server-only";

// Trade-in (sell / swap) pipeline: every stage change goes through changeLead(), which
// holds a per-lead lock, checks the move against TRADE_FLOW and appends to the lead's
// timeline. Rules and labels live in lib/tradein-flow.ts (isomorphic).
//
// Data layout:
//   jd:leads             hash  id -> Lead JSON (status, token, trade, history)
//   jd:tradein:acct      hash  lead id -> full payout bank details JSON (admin only;
//                              the lead itself only keeps the masked number)

import { emailEnabled, emailLayout, escapeHtml, sendEmail, sendSms, smsEnabled } from "./messaging";
import { formatNaira, gradeName } from "./reference";
import { getDriver } from "./store/driver";
import { getLead, getOffer, getOfferStats, getSettings, listOrders, saveLead, saveOffer, withLock } from "./store";
import {
  canTransition,
  CREDIT_DAYS,
  deviceOf,
  estimateLockedUntil,
  estimateOf,
  fmtSlot,
  isTradeIn,
  maskAccount,
  normalizeStatus,
  PAYOUT_LABEL,
  STAGE_LABEL,
  statusPath,
  type BankInput,
} from "./tradein-flow";
import type {
  InspectionBooking,
  InspectionResult,
  Lead,
  LeadEvent,
  LeadStatus,
  Offer,
  PayoutBank,
  PayoutMethod,
  SwapCredit,
  TradeIn,
  TradeInPayout,
} from "./types";

const K = {
  accounts: "jd:tradein:acct",
};

const DAY = 86_400_000;
const nowIso = () => new Date().toISOString();

/** A rule violation the user should see (bad transition, missing data). */
export class TradeInError extends Error {}

// -------------------------------------------------------------------- Tokens

export const newLeadToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

/** Constant-time comparison so the token can't be guessed byte by byte. */
export function tokenMatches(lead: Pick<Lead, "token">, token: string) {
  const a = lead.token ?? "";
  if (!a || a.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export const TOKEN_RE = /^[a-f0-9]{32,64}$/;
export const LEAD_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/** The lead behind a customer status link, or null if the id or token is wrong. */
export async function getLeadForCustomer(id: string, token: string): Promise<Lead | null> {
  if (!LEAD_ID_RE.test(id) || !TOKEN_RE.test(token)) return null;
  const lead = await getLead(id);
  if (!lead || !isTradeIn(lead) || !tokenMatches(lead, token)) return null;
  return { ...lead, status: normalizeStatus(lead) };
}

/** Fields a new sell / swap lead starts with (token, estimate lock, first timeline entry). */
export function initialTradeFields(input: Pick<Lead, "type" | "details">, createdAt = nowIso()): Pick<Lead, "token" | "trade" | "history"> {
  const estimate = estimateOf({ details: input.details });
  return {
    token: newLeadToken(),
    trade: {
      ...(estimate ? { estimate } : {}),
      estimateLockedUntil: estimateLockedUntil({ createdAt }),
    },
    history: [{ at: createdAt, by: "customer", from: "new", to: "new", kind: "status", note: estimate ? `Request sent with an instant estimate of ${formatNaira(estimate)}` : "Request sent" }],
  };
}

/** Give an older lead a status-link token (and normalised status) if it has none. */
export async function ensureLeadToken(id: string): Promise<Lead | null> {
  const lead = await getLead(id);
  if (!lead) return null;
  if (lead.token || !isTradeIn(lead)) return { ...lead, status: normalizeStatus(lead) };
  return withLock(`lead:${id}`, async () => {
    const fresh = await getLead(id);
    if (!fresh) return null;
    if (fresh.token) return { ...fresh, status: normalizeStatus(fresh) };
    return saveLead({ ...fresh, status: normalizeStatus(fresh), token: newLeadToken() });
  });
}

// -------------------------------------------------------------- Core change

export type Change = {
  /** New status. Omit for a note or message log that doesn't move the lead. */
  to?: LeadStatus;
  note?: string;
  kind?: LeadEvent["kind"];
  trade?: Partial<TradeIn>;
};

/**
 * Apply a change to a lead under its lock. `fn` sees the latest stored lead (with a
 * normalised status) and returns the change; a status move that isn't allowed from
 * the current stage throws TradeInError and nothing is written.
 */
export async function changeLead(id: string, by: string, fn: (lead: Lead) => Change | Promise<Change>): Promise<Lead> {
  if (!LEAD_ID_RE.test(id)) throw new TradeInError("This request no longer exists.");
  return withLock(`lead:${id}`, async () => {
    const stored = await getLead(id);
    if (!stored) throw new TradeInError("This request no longer exists.");
    const from = normalizeStatus(stored);
    const lead: Lead = { ...stored, status: from };
    const c = await fn(lead);
    if (c.to && !canTransition(lead, c.to)) {
      throw new TradeInError(`Can't move this request from “${STAGE_LABEL[from]}” to “${STAGE_LABEL[c.to]}”.`);
    }
    const to = c.to ?? from;
    const event: LeadEvent | null =
      c.to || c.note ? { at: nowIso(), by, from, to, ...(c.note ? { note: c.note.slice(0, 1000) } : {}), kind: c.kind ?? (c.to ? "status" : "note") } : null;
    return saveLead({
      ...lead,
      status: to,
      token: lead.token ?? newLeadToken(),
      trade: c.trade ? { ...lead.trade, ...c.trade } : lead.trade,
      history: event ? [...(lead.history ?? []), event].slice(-300) : lead.history,
    });
  });
}

function requireTrade(lead: Lead) {
  if (!isTradeIn(lead)) throw new TradeInError("Only sell and swap requests have a trade-in pipeline.");
}

// ------------------------------------------------------------------ Stages

export async function markContacted(id: string, by: string, note?: string) {
  return changeLead(id, by, (l) => {
    requireTrade(l);
    return { to: "contacted", note: note || "Customer contacted" };
  });
}

export type BookingInput = { at: string; method: InspectionBooking["method"]; address?: string; hub?: string; staff?: string };

export async function bookInspection(id: string, by: string, input: BookingInput) {
  const settings = await getSettings();
  if (!Number.isFinite(Date.parse(input.at))) throw new TradeInError("Choose a date and time.");
  if (input.method === "pickup" && (input.address ?? "").trim().length < 5) throw new TradeInError("Enter the pickup address.");
  if (input.method === "dropoff" && !settings.hubs.some((h) => h.city === input.hub)) throw new TradeInError("Choose a hub.");
  const booking: InspectionBooking = {
    at: new Date(input.at).toISOString(),
    method: input.method,
    ...(input.method === "pickup" ? { address: input.address!.trim().slice(0, 300) } : { hub: input.hub }),
    ...(input.staff?.trim() ? { staff: input.staff.trim().slice(0, 80) } : {}),
    bookedAt: nowIso(),
    bookedBy: by,
  };
  return changeLead(id, by, (l) => {
    requireTrade(l);
    const rebook = l.status === "inspection_booked" || l.status === "inspected";
    return {
      to: "inspection_booked",
      trade: { booking },
      note: `${rebook ? "Inspection rebooked" : "Inspection booked"} for ${fmtSlot(booking.at)}: ${placeOf(booking, settings.hubs)}${booking.staff ? ` with ${booking.staff}` : ""}`,
    };
  });
}

export type InspectionInput = Omit<InspectionResult, "inspectedAt" | "inspectedBy">;

export async function recordInspection(id: string, by: string, input: InspectionInput) {
  if (!Number.isFinite(input.finalOffer) || input.finalOffer < 0 || input.finalOffer > 100_000_000) throw new TradeInError("Enter the final offer amount.");
  const result: InspectionResult = { ...input, finalOffer: Math.round(input.finalOffer), notes: input.notes?.trim().slice(0, 1000) || undefined, inspectedAt: nowIso(), inspectedBy: by };
  return changeLead(id, by, (l) => {
    requireTrade(l);
    const failed = !input.checklist.imeiClean || !input.checklist.accountSignedOut;
    return {
      to: "inspected",
      trade: { inspection: result },
      note: `Inspected: ${gradeName(result.grade)}, final offer ${formatNaira(result.finalOffer)}${failed ? " (IMEI or account lock issue)" : ""}`,
    };
  });
}

/** Send (or revise) the final offer. `amount` overrides the inspection amount. */
export async function sendOffer(id: string, by: string, amount?: number) {
  return changeLead(id, by, (l) => {
    requireTrade(l);
    const insp = l.trade?.inspection;
    if (!insp) throw new TradeInError("Record the inspection before sending an offer.");
    const finalOffer = amount !== undefined && Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : insp.finalOffer;
    const revised = finalOffer !== insp.finalOffer || l.status === "offer_sent" || l.status === "declined";
    return {
      to: "offer_sent",
      trade: { inspection: { ...insp, finalOffer }, offerSentAt: nowIso(), response: undefined },
      note: `${revised ? "Revised offer" : "Offer"} of ${formatNaira(finalOffer)} sent`,
    };
  });
}

export type PayoutChoiceInput = { method: PayoutMethod; bank?: BankInput };

/**
 * The customer accepts or declines the offer (on the status page, or staff on their
 * behalf). Accepting a swap with swap credit issues the single-use credit code.
 */
export async function respondToOffer(id: string, by: string, decision: "accepted" | "declined", opts: { payout?: PayoutChoiceInput; reason?: string } = {}) {
  return changeLead(id, by, async (l) => {
    requireTrade(l);
    if (l.status !== "offer_sent") throw new TradeInError(l.status === "accepted" || l.status === "declined" ? "This offer has already been answered." : "There's no open offer to answer.");
    const at = nowIso();
    if (decision === "declined") {
      const reason = opts.reason?.trim().slice(0, 500) || undefined;
      return { to: "declined", trade: { response: { decision, at, by, ...(reason ? { reason } : {}) } }, note: `Offer declined${reason ? `: ${reason}` : ""}` };
    }
    const amount = l.trade?.inspection?.finalOffer ?? 0;
    const method: PayoutMethod = opts.payout?.method ?? (l.type === "swap" ? "swap_credit" : "bank");
    if (method === "swap_credit" && l.type !== "swap") throw new TradeInError("Swap credit is only for swap requests.");
    let bank: PayoutBank | undefined;
    if (method === "bank" && opts.payout?.bank) bank = await storeAccount(l.id, opts.payout.bank);
    const credit = method === "swap_credit" ? await issueSwapCredit(l, amount) : undefined;
    return {
      to: "accepted",
      trade: { response: { decision, at, by }, payoutChoice: { method, ...(bank ? { bank } : {}) }, ...(credit ? { credit } : {}) },
      note: `Offer of ${formatNaira(amount)} accepted · payout by ${PAYOUT_LABEL[method].toLowerCase()}${bank ? ` to ${bank.bankName} ${bank.accountMasked}` : ""}${credit ? ` · credit code ${credit.code.toUpperCase()}` : ""}`,
    };
  });
}

export type PayoutInput = { method: PayoutMethod; amount?: number; reference?: string; bank?: BankInput };

/** Record that the customer was paid (accepted → paid). */
export async function recordPayout(id: string, by: string, input: PayoutInput) {
  return changeLead(id, by, async (l) => {
    requireTrade(l);
    if (l.status !== "accepted") throw new TradeInError("Only an accepted offer can be paid out.");
    const amount = input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0 ? Math.round(input.amount) : (l.trade?.inspection?.finalOffer ?? 0);
    if (!amount) throw new TradeInError("Enter the amount paid.");
    if (input.method === "swap_credit" && l.type !== "swap") throw new TradeInError("Swap credit is only for swap requests.");
    let bank: PayoutBank | undefined;
    if (input.method === "bank") {
      bank = input.bank ? await storeAccount(l.id, input.bank) : l.trade?.payoutChoice?.bank;
      if (!bank) throw new TradeInError("Enter the customer's bank details.");
    }
    let credit = l.trade?.credit;
    if (input.method === "swap_credit" && !credit) credit = await issueSwapCredit(l, amount);
    const reference = input.reference?.trim().slice(0, 120) || (input.method === "swap_credit" ? credit?.code.toUpperCase() : undefined);
    if (input.method === "bank" && !reference) throw new TradeInError("Enter the transfer reference.");
    const payout: TradeInPayout = { method: input.method, amount, ...(bank ? { bank } : {}), ...(reference ? { reference } : {}), paidAt: nowIso(), paidBy: by };
    return {
      to: "paid",
      trade: { payout, ...(credit ? { credit } : {}) },
      note: `Paid ${formatNaira(amount)} by ${PAYOUT_LABEL[input.method].toLowerCase()}${bank ? ` to ${bank.bankName} ${bank.accountMasked}` : ""}${reference ? ` · ref ${reference}` : ""}`,
    };
  });
}

export async function closeLead(id: string, by: string, to: "closed" | "cancelled", reason: string) {
  const why = reason.trim().slice(0, 500);
  if (why.length < 3) throw new TradeInError("Give a reason.");
  return changeLead(id, by, (l) => {
    requireTrade(l);
    return { to, trade: { closeReason: why }, note: `${to === "closed" ? "Closed" : "Cancelled"}: ${why}` };
  });
}

export async function addLeadNote(id: string, by: string, note: string) {
  const text = note.trim();
  if (!text) throw new TradeInError("Write a note first.");
  return changeLead(id, by, () => ({ note: text, kind: "note" }));
}

// ------------------------------------------------------------ Bank account

async function storeAccount(leadId: string, bank: BankInput): Promise<PayoutBank> {
  await getDriver().hset(K.accounts, { [leadId]: JSON.stringify(bank) });
  return { bankName: bank.bankName, accountName: bank.accountName, accountMasked: maskAccount(bank.accountNumber) };
}

/** Full payout account details. Admin only: callers must check `leads:write` first. */
export async function getPayoutAccount(leadId: string): Promise<BankInput | null> {
  const raw = await getDriver().hget(K.accounts, leadId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BankInput;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- Swap credit

async function uniqueCreditCode() {
  for (let i = 0; i < 8; i++) {
    const code = `swap-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    if (!(await getOffer(code))) return code;
  }
  throw new Error("Could not generate a unique swap credit code");
}

/**
 * Create (once) the single-use, fixed-amount Offer the customer spends on their swap.
 * Scoped to the product they picked in the swap planner when it is still on sale.
 */
export async function issueSwapCredit(lead: Lead, amount: number): Promise<SwapCredit> {
  if (lead.trade?.credit) return lead.trade.credit;
  if (!amount || amount <= 0) throw new TradeInError("The offer amount is missing.");
  const code = await uniqueCreditCode();
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + CREDIT_DAYS * DAY).toISOString();
  const productId = lead.details?.productId;
  const offer: Offer = {
    code,
    title: `Swap credit · ${lead.name}`.slice(0, 80),
    headline: `${formatNaira(amount)} swap credit`,
    description: `Single-use credit from trade-in ${lead.id}${deviceOf(lead) ? ` (${deviceOf(lead)})` : ""}.`,
    discount: { type: "fixed", value: Math.round(amount) },
    scope: productId ? { type: "products", productIds: [productId] } : { type: "all" },
    startsAt: issuedAt,
    endsAt: expiresAt,
    active: true,
    usageLimit: 1,
    ...(productId ? { heroProductId: productId } : {}),
    createdAt: issuedAt,
    updatedAt: issuedAt,
  };
  const saved = await saveOffer(offer);
  return { code: saved.code, amount: Math.round(amount), issuedAt, expiresAt };
}

/**
 * Mark accepted swaps paid once their credit code has been used on an order. Cheap
 * when nothing was redeemed (one stats read per open credit). Returns leads changed.
 */
export async function syncCreditRedemptions(leads: Lead[]): Promise<number> {
  const open = leads.filter((l) => normalizeStatus(l) === "accepted" && l.trade?.credit && !l.trade.payout);
  if (!open.length) return 0;
  const used = [];
  for (const l of open) {
    const stats = await getOfferStats(l.trade!.credit!.code);
    if (stats.orders >= 1) used.push(l);
  }
  if (!used.length) return 0;
  const orders = await listOrders();
  let n = 0;
  for (const l of used) {
    const credit = l.trade!.credit!;
    const order = orders.find((o) => o.offerCode === credit.code && o.status !== "cancelled" && o.status !== "refunded");
    if (!order) continue;
    await changeLead(l.id, "system", (cur) => {
      if (cur.status !== "accepted") return {};
      return {
        to: "paid",
        trade: {
          credit: { ...credit, redeemedAt: order.createdAt, orderId: order.id },
          payout: { method: "swap_credit", amount: credit.amount, reference: order.id, paidAt: order.createdAt, paidBy: "system" },
        },
        note: `Swap credit ${credit.code.toUpperCase()} redeemed on order ${order.id}`,
      };
    }).then(
      () => n++,
      (e) => console.error("[tradein] credit sync failed", l.id, e),
    );
  }
  return n;
}

// ---------------------------------------------------------------- Messages

export type NotifyKind = "inspection_booked" | "offer_sent" | "paid" | "credit";

function placeOf(b: InspectionBooking, hubs: { city: string; address: string }[]) {
  if (b.method === "pickup") return `pickup at ${b.address}`;
  const hub = hubs.find((h) => h.city === b.hub);
  return `drop-off at our ${b.hub} hub${hub ? ` (${hub.address})` : ""}`;
}

/** E.164 (+234…) for SMS, or null. */
export function smsNumber(phone: string): string | null {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[789][01]\d{8}$/.test(d) ? `+234${d}` : null;
}

export function composeMessage(lead: Lead, kind: NotifyKind, link: string, store: { storeName: string; hubs: { city: string; address: string }[] }) {
  const first = lead.name.split(/\s+/)[0] || "there";
  const device = deviceOf(lead) || "device";
  const t = lead.trade ?? {};
  const amount = formatNaira(t.payout?.amount ?? t.credit?.amount ?? t.inspection?.finalOffer ?? 0);
  switch (kind) {
    case "inspection_booked": {
      const b = t.booking!;
      const where = placeOf(b, store.hubs);
      return {
        subject: `Your ${device} inspection: ${fmtSlot(b.at)}`,
        title: "Your inspection is booked",
        lines: [`Hi ${first}, your free inspection for your ${device} is booked for ${fmtSlot(b.at)}, ${where}.`, "Please bring the device charged and signed out of iCloud / Google."],
        cta: "View your trade-in",
      };
    }
    case "offer_sent":
      return {
        subject: `Your final offer for your ${device}: ${amount}`,
        title: `Your final offer: ${amount}`,
        lines: [`Hi ${first}, we've inspected your ${device}. Our final offer is ${amount}.`, "See the inspection results and accept or decline here:"],
        cta: "See your offer",
      };
    case "paid":
      return {
        subject: `${amount} payment sent for your ${device}`,
        title: "Payment sent",
        lines: [
          `Hi ${first}, we've paid ${amount} for your ${device}${t.payout ? ` by ${PAYOUT_LABEL[t.payout.method].toLowerCase()}` : ""}${t.payout?.bank ? ` to ${t.payout.bank.bankName} ${t.payout.bank.accountMasked}` : ""}.`,
          t.payout?.reference ? `Reference: ${t.payout.reference}.` : "",
          "Thanks for trading in with us.",
        ].filter(Boolean),
        cta: "View your trade-in",
      };
    case "credit": {
      const c = t.credit!;
      const expires = new Date(c.expiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
      return {
        subject: `Your ${formatNaira(c.amount)} swap credit code`,
        title: `${formatNaira(c.amount)} swap credit`,
        lines: [`Hi ${first}, your swap credit is ready. Code: ${c.code.toUpperCase()} (one use, valid until ${expires}).`, "Use it at checkout, or open your trade-in page for the shopping link:"],
        cta: "Use my swap credit",
      };
    }
  }
}

/**
 * Tell the customer about a step by email (if they gave one) and SMS (if set up), then
 * log every attempt on the lead's timeline. Never throws.
 */
export async function notifyLead(id: string, kind: NotifyKind, origin: string): Promise<string[]> {
  const log: string[] = [];
  try {
    const [lead, settings] = await Promise.all([ensureLeadToken(id), getSettings()]);
    if (!lead) return log;
    const link = `${origin}${statusPath(lead)}`;
    const shopLink = kind === "credit" && lead.trade?.credit ? `${origin}/o/${lead.trade.credit.code}` : null;
    const msg = composeMessage(lead, kind, link, settings);

    if (lead.email && emailEnabled()) {
      const body = msg.lines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join("");
      const r = await sendEmail({
        to: lead.email,
        subject: msg.subject,
        html: emailLayout({ storeName: settings.storeName, preheader: msg.lines[0], title: msg.title, body, cta: { label: msg.cta, href: shopLink ?? link } }),
        text: `${msg.lines.join("\n\n")}\n\n${shopLink ?? link}${shopLink ? `\n\nYour trade-in: ${link}` : ""}`,
        replyTo: settings.email || undefined,
      });
      log.push(r.ok ? `Email sent to ${lead.email}` : `Email to ${lead.email} failed: ${r.error}`);
    } else if (lead.email) {
      log.push("Email not sent: email isn't set up");
    }

    const to = smsNumber(lead.phone);
    if (smsEnabled() && to) {
      const r = await sendSms(to, `${settings.storeName}: ${msg.lines[0]} ${shopLink ?? link}`);
      log.push(r.ok ? `SMS sent to ${lead.phone}` : `SMS to ${lead.phone} failed: ${r.error}`);
    } else if (smsEnabled()) {
      log.push(`SMS not sent: ${lead.phone} isn't a Nigerian mobile number`);
    }
    if (!log.length) log.push("No message sent: no email on file and SMS isn't set up. Share the status link on WhatsApp.");

    await changeLead(id, "system", () => ({ note: `${msg.title} · ${log.join(" · ")}`, kind: "message" }));
  } catch (e) {
    console.error("[tradein] notify failed", id, kind, e);
    log.push("Message failed");
  }
  return log;
}
