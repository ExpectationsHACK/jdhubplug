// Formatting, filtering and aggregation helpers for the admin orders, customers and
// requests screens. Isomorphic and pure (no store access), so client components and
// the CSV route can share them.

import { STAGE_LABEL } from "@/lib/tradein-flow";
import type { Lead, LeadType, Order, OrderStatus, PaymentMethod } from "@/lib/types";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
export const money = (n: number) => naira.format(n);

/**
 * Same wording as STATUS_LABEL in lib/orders.ts, which is server-only; duplicated here
 * so client components can use it.
 */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid (in escrow)",
  processing: "Processing",
  shipped: "Shipped / ready at hub",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  paystack: "Paystack",
  transfer: "Bank transfer",
  whatsapp: "WhatsApp",
};

/** Statuses whose money counts toward revenue / lifetime value. */
export const REVENUE_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered", "completed"];
export const countsAsRevenue = (o: Pick<Order, "status">) => REVENUE_STATUSES.includes(o.status);

// ------------------------------------------------------------------- Phones

/** Last 10 digits of a Nigerian phone number: the key customers are grouped by. */
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/** International (234…) form for wa.me links, or null if it doesn't look like a phone number. */
export function waNumber(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("234") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length === 11) return `234${d.slice(1)}`;
  if (d.length === 10) return `234${d}`;
  return d.length >= 10 ? d : null;
}

/** WhatsApp chat link to the customer's own number, prefilled with `text`. */
export function customerWaLink(phone: string, text: string) {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** Prefilled WhatsApp message to the customer about their order's current status. */
export function orderStatusMessage(o: Pick<Order, "id" | "status" | "total" | "delivery" | "reservedUntil" | "customer">, storeName: string, link: string) {
  const hi = `Hi ${o.customer.name.split(/\s+/)[0] || "there"}, this is ${storeName} about your order ${o.id}.`;
  const deadline = o.reservedUntil
    ? new Date(o.reservedUntil).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "2-digit" })
    : null;
  const body: Record<OrderStatus, string> = {
    pending: `We're holding your items${deadline ? ` until ${deadline}` : ""}. Once your payment of ${money(o.total)} lands, we'll get it ready.`,
    paid: `We've received your payment of ${money(o.total)}. It's held safely in escrow while we prepare your order.`,
    processing: "Your order is being inspected and packed now.",
    shipped: o.delivery === "pickup" ? "Your order is ready for pickup at the hub." : "Your order is on its way.",
    delivered: "Your order has been delivered. Please check everything and confirm it's as described.",
    completed: "Thanks for confirming. Your order is complete. Enjoy!",
    cancelled: "Your order has been cancelled. Reply here if you'd like to place it again.",
    refunded: `We've refunded ${money(o.total)} for this order.`,
  };
  return `${hi} ${body[o.status]}\n\nTrack it here: ${link}`;
}

/** tel: href that keeps only characters a dialler understands. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// ---------------------------------------------------------------- Time left

/** "3h 12m left", "8m left" or "expired" until an ISO deadline. */
export function timeLeft(until: string, now: number) {
  const ms = Date.parse(until) - now;
  if (!Number.isFinite(ms) || ms <= 0) return { label: "Expired", urgent: true, expired: true };
  const m = Math.ceil(ms / 60_000);
  const label = m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h left` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
  return { label, urgent: m < 60, expired: false };
}

// ------------------------------------------------------------------ Filters

export const ORDER_TABS = [
  { key: "all", label: "All", statuses: null },
  { key: "pending", label: "Awaiting payment", statuses: ["pending"] },
  { key: "fulfil", label: "To fulfil", statuses: ["paid", "processing"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "closed", label: "Cancelled & refunded", statuses: ["cancelled", "refunded"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly OrderStatus[] | null }[];

export type OrderTab = (typeof ORDER_TABS)[number]["key"];

export const DATE_RANGES = [
  { key: "all", label: "All time", days: 0 },
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
] as const;

export type DateRange = (typeof DATE_RANGES)[number]["key"];

export type OrderFilters = {
  tab: OrderTab;
  q: string;
  range: DateRange;
  pay: PaymentMethod | "all";
  page: number;
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parse and validate list filters from the URL. Unknown values fall back to defaults. */
export function readOrderFilters(sp: Record<string, string | string[] | undefined>): OrderFilters {
  const page = Number.parseInt(first(sp.page) ?? "1", 10);
  return {
    tab: pick(first(sp.status), ORDER_TABS.map((t) => t.key), "all"),
    q: (first(sp.q) ?? "").trim().slice(0, 80),
    range: pick(first(sp.range), DATE_RANGES.map((r) => r.key), "all"),
    pay: pick(first(sp.pay), ["all", "paystack", "transfer", "whatsapp"] as const, "all"),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Start of "today" in Lagos (WAT, UTC+1, no DST) as epoch ms. */
export function startOfLagosDay(now: number) {
  const wat = now + 3_600_000;
  return wat - (wat % 86_400_000) - 3_600_000;
}

export function inRange(o: Pick<Order, "createdAt">, range: DateRange, now: number) {
  if (range === "all") return true;
  const t = Date.parse(o.createdAt);
  if (range === "today") return t >= startOfLagosDay(now);
  const days = range === "7d" ? 7 : 30;
  return t >= now - days * 86_400_000;
}

/** Text search over order id, customer name and phone (digits match ignoring formatting). */
export function matchesQuery(o: Order, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (o.id.toLowerCase().includes(needle) || o.customer.name.toLowerCase().includes(needle)) return true;
  if (o.customer.email?.toLowerCase().includes(needle)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4) {
    const d = digits.replace(/^(234|0)/, "");
    return o.customer.phone.replace(/\D/g, "").includes(d);
  }
  return false;
}

export function tabFor(key: OrderTab) {
  return ORDER_TABS.find((t) => t.key === key)!;
}

export function inTab(o: Pick<Order, "status">, key: OrderTab) {
  const t = tabFor(key);
  return !t.statuses || (t.statuses as readonly OrderStatus[]).includes(o.status);
}

/** Order filters → query string (defaults omitted). */
export function filtersToQuery(f: Partial<OrderFilters>) {
  const p = new URLSearchParams();
  if (f.tab && f.tab !== "all") p.set("status", f.tab);
  if (f.q) p.set("q", f.q);
  if (f.range && f.range !== "all") p.set("range", f.range);
  if (f.pay && f.pay !== "all") p.set("pay", f.pay);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const itemCount = (o: Pick<Order, "lines">) => o.lines.reduce((n, l) => n + l.qty, 0);

// ---------------------------------------------------------------- Customers

export type CustomerSummary = {
  key: string;
  name: string;
  phone: string;
  email?: string;
  orders: number;
  paidOrders: number;
  spent: number;
  firstOrderAt: string;
  lastOrderAt: string;
  states: string[];
  openOrders: number;
};

/** Group orders by normalised phone. Orders must be newest first (as listOrders returns). */
export function aggregateCustomers(orders: Order[]): CustomerSummary[] {
  const map = new Map<string, CustomerSummary>();
  for (const o of orders) {
    const key = phoneKey(o.customer.phone);
    if (!key) continue;
    let c = map.get(key);
    if (!c) {
      // First seen = most recent order: its name/email are the freshest details.
      c = {
        key,
        name: o.customer.name,
        phone: o.customer.phone,
        email: o.customer.email,
        orders: 0,
        paidOrders: 0,
        spent: 0,
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
        states: [],
        openOrders: 0,
      };
      map.set(key, c);
    }
    c.orders++;
    if (countsAsRevenue(o)) {
      c.paidOrders++;
      c.spent += o.total;
    }
    if (["pending", "paid", "processing", "shipped"].includes(o.status)) c.openOrders++;
    if (!c.email && o.customer.email) c.email = o.customer.email;
    if (o.createdAt < c.firstOrderAt) c.firstOrderAt = o.createdAt;
    if (o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
    if (o.customer.state && !c.states.includes(o.customer.state)) c.states.push(o.customer.state);
  }
  return [...map.values()];
}

// ------------------------------------------------------------------ Leads

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  sell: "Sell",
  swap: "Swap",
  contact: "Contact",
  vendor: "Vendor",
};

/** Every lead status, including the sell / swap pipeline stages (see lib/tradein-flow.ts). */
export const LEAD_STATUS_LABEL: Record<Lead["status"], string> = STAGE_LABEL;

/** Turn a camelCase / snake_case detail key into a readable label. */
export const humanizeKey = (k: string) =>
  k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
