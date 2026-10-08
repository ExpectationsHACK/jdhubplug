// Dashboard numbers, computed from raw store data. Pure (no I/O), so it's easy to reason
// about and cheap to run on every dashboard load.

import { offerState } from "@/lib/pricing";
import type { Lead, Offer, OfferStats, Order, OrderStatus, Product, Settings } from "@/lib/types";
import { lagosDay, lagosDayStart } from "./format";

/** Statuses whose order total counts as revenue. */
export const REVENUE_STATUSES: ReadonlySet<OrderStatus> = new Set(["paid", "processing", "shipped", "delivered", "completed"]);

const DAY = 86_400_000;

export type RevenueDay = { day: string; revenue: number; orders: number };

export type Period = { revenue: number; orders: number; previous: number };

export type TopSeller = {
  productId: string;
  name: string;
  spec: string;
  units: number;
  revenue: number;
  product?: Pick<Product, "photo" | "imageUrl" | "art" | "tint" | "name" | "stock">;
};

export type DashboardMetrics = {
  today: Period;
  week: Period;
  month: Period;
  chart: RevenueDay[];
  awaitingPayment: { count: number; value: number; nextExpiry?: string };
  toFulfil: { count: number; paid: number; processing: number };
  lowStock: Product[];
  lowStockCount: number;
  soldOutCount: number;
  activeProducts: number;
  liveOffers: { offer: Offer; stats: OfferStats }[];
  newLeads: number;
  recentOrders: Order[];
  topSellers: TopSeller[];
  totalOrders: number;
  averageOrder: number;
};

/** When an order's money counts: the payment time if we have it, otherwise when it was placed. */
const revenueAt = (o: Order) => Date.parse(o.payment.paidAt ?? o.createdAt);

export function computeDashboard(input: {
  orders: Order[];
  products: Product[];
  offers: Offer[];
  offerStats: Record<string, OfferStats>;
  leads: Lead[];
  settings: Settings;
  now: number;
}): DashboardMetrics {
  const { orders, products, offers, offerStats, leads, settings, now } = input;
  const todayStart = lagosDayStart(now);
  const earning = orders.filter((o) => REVENUE_STATUSES.has(o.status));

  // Rolling windows by Lagos calendar day: "last 7 days" = today and the 6 days before it.
  const sumSince = (from: number, to = Infinity) => {
    let revenue = 0;
    let n = 0;
    for (const o of earning) {
      const t = revenueAt(o);
      if (t >= from && t < to) {
        revenue += o.total;
        n++;
      }
    }
    return { revenue, orders: n };
  };
  const period = (days: number): Period => {
    const from = todayStart - (days - 1) * DAY;
    const cur = sumSince(from);
    return { ...cur, previous: sumSince(from - days * DAY, from).revenue };
  };

  // 14-day chart, oldest first.
  const chart: RevenueDay[] = [];
  const byDay = new Map<string, RevenueDay>();
  for (let i = 13; i >= 0; i--) {
    const day = lagosDay(todayStart - i * DAY + DAY / 2);
    const row = { day, revenue: 0, orders: 0 };
    chart.push(row);
    byDay.set(day, row);
  }
  for (const o of earning) {
    const row = byDay.get(lagosDay(revenueAt(o)));
    if (row) {
      row.revenue += o.total;
      row.orders++;
    }
  }

  const pending = orders.filter((o) => o.status === "pending");
  const nextExpiry = pending
    .map((o) => o.reservedUntil)
    .filter((t): t is string => !!t && Date.parse(t) > now)
    .sort()[0];

  const active = products.filter((p) => p.status === "active");
  const threshold = settings.lowStockThreshold;
  const low = active.filter((p) => p.stock > 0 && p.stock <= threshold).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));

  const liveOffers = offers
    .map((offer) => ({ offer, stats: offerStats[offer.code] ?? { views: 0, orders: 0, revenue: 0 } }))
    .filter(({ offer, stats }) => offerState(offer, now, stats) === "live");

  // Top sellers by units on orders that actually earned money.
  const sellers = new Map<string, TopSeller>();
  for (const o of earning) {
    for (const l of o.lines) {
      const row = sellers.get(l.productId) ?? { productId: l.productId, name: l.name, spec: l.spec, units: 0, revenue: 0 };
      row.units += l.qty;
      row.revenue += l.finalUnitPrice * l.qty;
      sellers.set(l.productId, row);
    }
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const topSellers = [...sellers.values()]
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 5)
    .map((s) => ({ ...s, product: byId.get(s.productId) }));

  const allRevenue = earning.reduce((s, o) => s + o.total, 0);

  return {
    today: period(1),
    week: period(7),
    month: period(30),
    chart,
    awaitingPayment: { count: pending.length, value: pending.reduce((s, o) => s + o.total, 0), nextExpiry },
    toFulfil: {
      count: orders.filter((o) => o.status === "paid" || o.status === "processing").length,
      paid: orders.filter((o) => o.status === "paid").length,
      processing: orders.filter((o) => o.status === "processing").length,
    },
    lowStock: low.slice(0, 6),
    lowStockCount: low.length,
    soldOutCount: active.filter((p) => p.stock <= 0).length,
    activeProducts: active.length,
    liveOffers,
    newLeads: leads.filter((l) => l.status === "new").length,
    recentOrders: orders.slice(0, 8),
    topSellers,
    totalOrders: orders.length,
    averageOrder: earning.length ? Math.round(allRevenue / earning.length) : 0,
  };
}

/** "+12%" / "−8%" against the previous period, or null when there's nothing to compare. */
export function delta(cur: number, prev: number): { text: string; up: boolean } | null {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`, up: pct >= 0 };
}
