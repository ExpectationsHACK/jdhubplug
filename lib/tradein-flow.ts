// Trade-in (sell / swap) pipeline rules. Isomorphic and pure, so the admin forms, the
// customer status page and the server agree. Persistence lives in lib/tradein.ts.

import type { ConditionCheck, InspectionChecklist, Lead, LeadStatus, LeadType, PayoutMethod } from "./types";

export const TRADE_TYPES: LeadType[] = ["sell", "swap"];
export const isTradeIn = (l: Pick<Lead, "type">) => TRADE_TYPES.includes(l.type);

/** Pipeline order, for boards and steppers. */
export const STAGES: LeadStatus[] = ["new", "contacted", "inspection_booked", "inspected", "offer_sent", "accepted", "declined", "paid", "closed", "cancelled"];

export const STAGE_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  inspection_booked: "Inspection booked",
  inspected: "Inspected",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  declined: "Declined",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** Stages after which nothing else happens. */
export const TERMINAL: LeadStatus[] = ["closed", "cancelled"];
/** Stages that still need work from the team. */
export const OPEN_STAGES: LeadStatus[] = ["new", "contacted", "inspection_booked", "inspected", "offer_sent", "accepted"];

/**
 * Allowed moves for sell / swap leads. A stage listed under itself can be repeated
 * (rebooking an inspection, sending a revised offer).
 */
export const TRADE_FLOW: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "inspection_booked", "closed", "cancelled"],
  contacted: ["inspection_booked", "closed", "cancelled"],
  inspection_booked: ["inspection_booked", "inspected", "cancelled"],
  inspected: ["offer_sent", "inspection_booked", "cancelled"],
  offer_sent: ["offer_sent", "accepted", "declined", "cancelled"],
  accepted: ["paid", "cancelled"],
  declined: ["offer_sent", "closed"],
  paid: ["closed"],
  closed: [],
  cancelled: [],
};

/** Contact / vendor leads keep the original three statuses. */
export const CONTACT_FLOW: Partial<Record<LeadStatus, LeadStatus[]>> = {
  new: ["contacted", "closed"],
  contacted: ["closed", "new"],
  closed: ["new"],
};

/** A stored status that predates the pipeline (or is unknown) maps onto a known one. */
export function normalizeStatus(l: Pick<Lead, "type" | "status">): LeadStatus {
  const s = l.status as string;
  if (isTradeIn(l)) return (STAGES as string[]).includes(s) ? (s as LeadStatus) : "new";
  return s === "contacted" || s === "closed" ? s : "new";
}

export function canTransition(l: Pick<Lead, "type" | "status">, to: LeadStatus): boolean {
  const from = normalizeStatus(l);
  const flow = isTradeIn(l) ? TRADE_FLOW[from] : (CONTACT_FLOW[from] ?? []);
  return flow.includes(to);
}

export function allowedNext(l: Pick<Lead, "type" | "status">): LeadStatus[] {
  const from = normalizeStatus(l);
  return isTradeIn(l) ? TRADE_FLOW[from] : (CONTACT_FLOW[from] ?? []);
}

// ------------------------------------------------------------------ Estimate

export const OFFER_LOCK_DAYS = 7;
export const CREDIT_DAYS = 30;
const DAY = 86_400_000;

/** The instant estimate the customer was quoted (sell tool: estimate, swap planner: tradeInValue). */
export function estimateOf(l: Pick<Lead, "details" | "trade">): number | undefined {
  if (l.trade?.estimate) return l.trade.estimate;
  const raw = l.details?.estimate ?? l.details?.tradeInValue;
  const n = raw ? Number(String(raw).replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function estimateLockedUntil(l: Pick<Lead, "createdAt" | "trade">): string {
  return l.trade?.estimateLockedUntil ?? new Date(Date.parse(l.createdAt) + OFFER_LOCK_DAYS * DAY).toISOString();
}

/** Device description from whichever tool created the lead. */
export function deviceOf(l: Pick<Lead, "details">): string {
  const d = l.details ?? {};
  return [d.model, d.storage].filter(Boolean).join(" ") || d.tradeIn || d.device || d.item || "";
}

// ------------------------------------------------------------------ Payouts

export const PAYOUT_LABEL: Record<PayoutMethod, string> = {
  bank: "Bank transfer",
  cash: "Cash at hub",
  swap_credit: "Swap credit",
};

/** Major Nigerian banks and fintechs that issue NUBAN account numbers. */
export const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "Lotus Bank",
  "Moniepoint Microfinance Bank",
  "OPay",
  "PalmPay",
  "Parallex Bank",
  "Polaris Bank",
  "Premium Trust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank (ALAT)",
  "Zenith Bank",
] as const;

export const isNuban = (s: string) => /^\d{10}$/.test(s);
export const maskAccount = (s: string) => (s.length >= 4 ? `******${s.slice(-4)}` : "******");

export type BankInput = { bankName: string; accountName: string; accountNumber: string };

/** Validate customer / admin bank details. Returns cleaned values or an error. */
export function parseBank(raw: { bankName?: unknown; accountName?: unknown; accountNumber?: unknown }): { ok: true; bank: BankInput } | { ok: false; error: string } {
  const bankName = String(raw.bankName ?? "").trim();
  const accountName = String(raw.accountName ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const accountNumber = String(raw.accountNumber ?? "").replace(/[\s-]/g, "");
  if (!(NIGERIAN_BANKS as readonly string[]).includes(bankName)) return { ok: false, error: "Choose your bank from the list." };
  if (!isNuban(accountNumber)) return { ok: false, error: "Account number must be the 10-digit NUBAN." };
  if (accountName.length < 3) return { ok: false, error: "Enter the account name." };
  return { ok: true, bank: { bankName, accountName, accountNumber } };
}

// --------------------------------------------------------------- Checklist

export const CONDITION_LABEL: Record<ConditionCheck, string> = { ok: "Good", minor: "Minor wear", damaged: "Damaged" };

export function checklistRows(c: InspectionChecklist): { label: string; value: string; good: boolean }[] {
  return [
    { label: "IMEI", value: c.imeiClean ? "Clean" : "Flagged", good: c.imeiClean },
    { label: "iCloud / Google", value: c.accountSignedOut ? "Signed out" : "Still signed in", good: c.accountSignedOut },
    { label: "Screen", value: CONDITION_LABEL[c.screen], good: c.screen === "ok" },
    ...(c.batteryHealth !== undefined ? [{ label: "Battery health", value: `${c.batteryHealth}%`, good: c.batteryHealth >= 80 }] : []),
    { label: "Body", value: CONDITION_LABEL[c.body], good: c.body === "ok" },
    { label: "Functions", value: c.functions === "ok" ? "All working" : "Issues found", good: c.functions === "ok" },
  ];
}

// -------------------------------------------------------------------- Time

/** "YYYY-MM-DDTHH:mm" typed in Lagos time (WAT, UTC+1, no DST) → ISO, or null. */
export function parseLagosLocal(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}:00+01:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** ISO → "YYYY-MM-DDTHH:mm" in Lagos time, for datetime-local inputs. */
export function toLagosLocal(iso: string): string {
  return new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 16);
}

export const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Monday 00:00 Lagos time of the week containing `now`, as epoch ms. */
export function startOfLagosWeek(now: number) {
  const wat = now + 3_600_000;
  const day = new Date(wat).getUTCDay(); // 0 = Sunday
  const midnight = wat - (wat % DAY);
  return midnight - ((day + 6) % 7) * DAY - 3_600_000;
}

/** First of the month 00:00 Lagos time, as epoch ms. */
export function startOfLagosMonth(now: number) {
  const d = new Date(now + 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 3_600_000;
}

// ------------------------------------------------------------------- Stats

export type TradeStats = {
  open: number;
  inspectionsThisWeek: number;
  paidThisMonth: number;
  paidCountThisMonth: number;
  avgFinal: number;
  avgEstimate: number;
  /** Average final offer as a share of the estimate (1 = matched), over leads with both. */
  ratio: number | null;
  compared: number;
};

export function tradeStats(leads: Lead[], now: number): TradeStats {
  const trades = leads.filter(isTradeIn);
  const week = startOfLagosWeek(now);
  const month = startOfLagosMonth(now);
  let paid = 0;
  let paidCount = 0;
  let sumFinal = 0;
  let sumEst = 0;
  let compared = 0;
  let inspections = 0;
  for (const l of trades) {
    const t = l.trade;
    const slot = t?.booking?.at ? Date.parse(t.booking.at) : NaN;
    if (slot >= week && slot < week + 7 * DAY && normalizeStatus(l) !== "cancelled") inspections++;
    if (t?.payout && Date.parse(t.payout.paidAt) >= month) {
      paid += t.payout.amount;
      paidCount++;
    }
    const est = estimateOf(l);
    if (t?.inspection && est) {
      sumFinal += t.inspection.finalOffer;
      sumEst += est;
      compared++;
    }
  }
  return {
    open: trades.filter((l) => OPEN_STAGES.includes(normalizeStatus(l))).length,
    inspectionsThisWeek: inspections,
    paidThisMonth: paid,
    paidCountThisMonth: paidCount,
    avgFinal: compared ? Math.round(sumFinal / compared) : 0,
    avgEstimate: compared ? Math.round(sumEst / compared) : 0,
    ratio: compared && sumEst ? sumFinal / sumEst : null,
    compared,
  };
}

export const statusPath = (l: Pick<Lead, "id" | "token">) => `/trade-in/${encodeURIComponent(l.id)}?t=${l.token ?? ""}`;
