import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HealthList, Panel, Tile } from "@/components/admin/core/DashboardBits";
import { requestNow } from "@/components/admin/core/clock";
import { computeDashboard, delta } from "@/components/admin/core/dashboard-metrics";
import { count, lagosDay, naira, nairaCompact } from "@/components/admin/core/format";
import { healthSummary, systemHealth } from "@/components/admin/core/health";
import { AdminIcon } from "@/components/admin/core/icons";
import { RevenueChart } from "@/components/admin/core/RevenueChart";
import { SweepButton, SweepNotice } from "@/components/admin/core/SweepControls";
import s from "@/components/admin/core/core.module.css";
import { AdminPage, Badge, ORDER_TONE, Table, relTime } from "@/components/admin/ui";
import { ProductImage } from "@/components/ProductImage";
import { can, requireAdmin } from "@/lib/auth";
import { STATUS_LABEL, sweepExpiredOrders } from "@/lib/orders";
import { getAllOfferStats, getSettings, listLeads, listOffers, listOrders, listProducts, listStaff, storageStatus } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <AdminPage>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </AdminPage>
  );
}

async function Dashboard() {
  const session = await requireAdmin();

  // Free stock held by abandoned unpaid orders before counting anything.
  const released = await sweepExpiredOrders().catch(() => 0);
  const [orders, products, offers, offerStats, leads, settings] = await Promise.all([
    listOrders(),
    listProducts(),
    listOffers(),
    getAllOfferStats(),
    listLeads(),
    getSettings(),
  ]);
  const now = await requestNow();
  const m = computeDashboard({ orders, products, offers, offerStats, leads, settings, now });
  const isStaffAdmin = session.role !== "support";
  const health = isStaffAdmin ? systemHealth() : [];
  const summary = healthSummary(health);
  const todayKey = lagosDay(now);
  const hour = new Date(now + 3_600_000).getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.name.split(/\s+/)[0];
  const dateLine = new Date(now).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });

  const canProducts = can(session.role, "products:write");
  const canOffers = can(session.role, "offers:write");
  const checklist = m.totalOrders === 0 ? await setupChecklist(settings, offers.length, session.role === "owner") : null;

  return (
    <>
      <div className={`mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${s.rise}`}>
        <div>
          <p className="text-[13px] font-bold text-muted">{dateLine}</p>
          <h1 className="display mt-1 text-[26px] md:text-[32px]">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {m.totalOrders === 0
              ? "Your store is ready. Here's everything you need for your first sale."
              : m.awaitingPayment.count + m.toFulfil.count > 0
                ? `${count(m.toFulfil.count, "order")} to fulfil and ${count(m.awaitingPayment.count, "order")} awaiting payment.`
                : "You're all caught up. Nice work."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaffAdmin && (summary.bad > 0 || summary.warn > 0) && (
            <a
              href="#health"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold ${summary.bad ? "bg-[#fde8ef] text-sale" : "bg-[#fff4e0] text-[#b45309]"}`}
            >
              <AdminIcon name="alert" size={15} />
              {summary.bad ? count(summary.bad, "setup issue") : count(summary.warn, "setup suggestion")}
            </a>
          )}
          <Link href="/" target="_blank" rel="noopener" className="btn btn-outline">
            View store
          </Link>
          {canProducts && (
            <Link href="/admin/products/new" className="btn btn-primary">
              <AdminIcon name="plus" size={16} />
              Add product
            </Link>
          )}
        </div>
      </div>

      <SweepNotice released={released} />

      {checklist && <Welcome productCount={m.activeProducts} checklist={checklist} />}

      <h2 className="sr-only">Sales</h2>
      <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
        <Tile
          i={0}
          label="Revenue today"
          value={naira(m.today.revenue)}
          hint={`${count(m.today.orders, "paid order")}`}
          trend={periodTrend(m.today, "yesterday")}
          icon="wallet"
        />
        <Tile
          i={1}
          label="Last 7 days"
          value={naira(m.week.revenue)}
          hint={`${count(m.week.orders, "paid order")}`}
          trend={periodTrend(m.week, "previous 7 days")}
          icon="activity"
        />
        <Tile
          i={2}
          label="Last 30 days"
          value={naira(m.month.revenue)}
          hint={m.averageOrder ? `Avg. order ${nairaCompact(m.averageOrder)}` : count(m.month.orders, "paid order")}
          trend={periodTrend(m.month, "previous 30 days")}
          icon="receipt"
        />
      </div>

      <h2 className="sr-only">Operations</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:mt-4 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        <Tile
          i={3}
          label="Awaiting payment"
          value={m.awaitingPayment.count}
          tone={m.awaitingPayment.count ? "warn" : "default"}
          hint={m.awaitingPayment.count ? `${nairaCompact(m.awaitingPayment.value)} held` : "None"}
          href="/admin/orders?status=pending"
          icon="clock"
        />
        <Tile
          i={4}
          label="To fulfil"
          value={m.toFulfil.count}
          tone={m.toFulfil.count ? "accent" : "default"}
          hint={m.toFulfil.count ? `${m.toFulfil.paid} paid · ${m.toFulfil.processing} packing` : "All shipped"}
          href="/admin/orders?status=paid"
          icon="truck"
        />
        <Tile
          i={5}
          label="Low stock"
          value={m.lowStockCount}
          tone={m.lowStockCount ? "warn" : "default"}
          hint={`${settings.lowStockThreshold} or fewer left`}
          href="/admin/inventory"
          icon="layers"
        />
        <Tile
          i={6}
          label="Sold out"
          value={m.soldOutCount}
          tone={m.soldOutCount ? "bad" : "default"}
          hint={`of ${m.activeProducts} live products`}
          href="/admin/inventory"
          icon="box"
        />
        <Tile
          i={7}
          label="Live offers"
          value={m.liveOffers.length}
          tone={m.liveOffers.length ? "good" : "default"}
          hint={m.liveOffers[0]?.offer.title ?? "No offer running"}
          href="/admin/offers"
          icon="link"
        />
        <Tile
          i={8}
          label="New requests"
          value={m.newLeads}
          tone={m.newLeads ? "accent" : "default"}
          hint="Sell, swap & contact"
          href="/admin/requests"
          icon="inbox"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Panel i={9} title="Revenue" description="Paid orders per day, last 14 days (Lagos time)">
            <RevenueChart data={m.chart} todayKey={todayKey} />
          </Panel>

          <Panel i={10} title="Recent orders" href="/admin/orders">
            {m.recentOrders.length ? (
              <div className="-mx-4 md:-mx-5 [&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-b-0">
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Items</th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="whitespace-nowrap">
                          <Link href={`/admin/orders/${o.id}`} className="font-bold underline-offset-4 hover:underline">
                            {o.id}
                          </Link>
                        </td>
                        <td className="max-w-[180px] truncate">{o.customer.name}</td>
                        <td className="text-ink-2">{o.lines.reduce((n, l) => n + l.qty, 0)}</td>
                        <td className="text-right font-bold tabular-nums">{naira(o.total)}</td>
                        <td>
                          <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        </td>
                        <td className="whitespace-nowrap text-ink-2">
                          <time dateTime={o.createdAt}>{relTime(o.createdAt, now)}</time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <p className="rounded-xl bg-stage px-4 py-8 text-center text-[14px] text-ink-2">No orders yet. They&apos;ll show up here the moment a buyer checks out.</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel i={11} title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {canProducts && <QuickAction href="/admin/products/new" icon="plus" label="Add product" />}
              {canOffers && <QuickAction href="/admin/offers/new" icon="link" label="Create offer" />}
              <QuickAction href="/admin/orders" icon="receipt" label="Orders" />
              <QuickAction href="/" icon="store" label="View store" external />
            </div>
          </Panel>

          <Panel i={12} title="Low stock" description={`Live products with ${settings.lowStockThreshold} or fewer units`} href="/admin/inventory">
            {m.lowStock.length ? (
              <ul className="-my-1">
                {m.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/products/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors hover:bg-stage focus-visible:ring-2 focus-visible:ring-accent">
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stage">
                        <ProductImage item={p} width={120} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{p.name}</span>
                        <span className="block truncate text-[12px] text-muted">{p.spec}</span>
                      </span>
                      <Badge tone={p.stock === 1 ? "red" : "amber"}>{p.stock} left</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-stage px-3 py-3 text-[13px] text-ink-2">
                <AdminIcon name="check" size={16} className="text-ok" /> Stock levels look healthy.
              </p>
            )}
            {m.lowStockCount > m.lowStock.length && <p className="mt-2 text-[12px] text-muted">+{m.lowStockCount - m.lowStock.length} more in Inventory</p>}
          </Panel>

          <Panel i={13} title="Top sellers" description="By units on paid orders">
            {m.topSellers.length ? (
              <ol className="-my-1">
                {m.topSellers.map((t, idx) => (
                  <li key={t.productId} className="flex items-center gap-3 py-2">
                    <span className="w-4 shrink-0 text-center text-[13px] font-bold text-muted">{idx + 1}</span>
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stage">
                      {t.product ? (
                        <ProductImage item={t.product} width={120} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-muted">
                          <AdminIcon name="box" size={18} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      {t.product ? (
                        <Link href={`/admin/products/${t.productId}`} className="block truncate text-[14px] font-bold underline-offset-4 hover:underline">
                          {t.name}
                        </Link>
                      ) : (
                        <span className="block truncate text-[14px] font-bold">{t.name}</span>
                      )}
                      <span className="block text-[12px] text-muted">{count(t.units, "unit")} sold</span>
                    </span>
                    <span className="text-[13px] font-bold tabular-nums">{nairaCompact(t.revenue)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl bg-stage px-3 py-3 text-[13px] text-ink-2">Your best sellers will rank here after the first paid orders.</p>
            )}
          </Panel>
        </div>
      </div>

      {isStaffAdmin && (
        <Panel
          i={14}
          id="health"
          className="mt-4 scroll-mt-20"
          title="System health"
          description={
            summary.bad
              ? `${count(summary.bad, "thing")} to fix before you go live.`
              : summary.warn
                ? `Working. ${count(summary.warn, "optional improvement")} below.`
                : "Everything is set up."
          }
          action={
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                summary.bad ? "bg-[#fde8ef] text-sale" : summary.warn ? "bg-[#fff4e0] text-[#b45309]" : "bg-[#e6f6ee] text-ok"
              }`}
            >
              {summary.ok}/{health.length} OK
            </span>
          }
        >
          <HealthList checks={health} extra={can(session.role, "orders:write") ? { cron: <SweepButton /> } : undefined} />
        </Panel>
      )}
    </>
  );
}

function periodTrend(p: { revenue: number; previous: number }, vs: string) {
  const d = delta(p.revenue, p.previous);
  return d ? { ...d, vs: `vs ${vs}` } : null;
}

function QuickAction({ href, icon, label, external }: { href: string; icon: React.ComponentProps<typeof AdminIcon>["name"]; label: string; external?: boolean }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className={`group flex flex-col items-start gap-3 rounded-xl border border-line p-3 text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-accent ${s.lift}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-stage transition-colors group-hover:bg-ink group-hover:text-white">
        <AdminIcon name={icon} size={17} />
      </span>
      {label}
    </Link>
  );
}

type ChecklistItem = { label: string; body: string; href: string; done: boolean; external?: boolean };

async function setupChecklist(settings: Settings, offerCount: number, isOwner: boolean): Promise<ChecklistItem[]> {
  const storage = storageStatus();
  const staffCount = isOwner ? (await listStaff()).length : 0;
  const items: ChecklistItem[] = [
    {
      label: "Add your WhatsApp and contact details",
      body: "Buyers tap WhatsApp on every product page.",
      href: "/admin/settings",
      done: settings.whatsapp !== DEFAULT_SETTINGS.whatsapp,
    },
    {
      label: "Add bank transfer details",
      body: "Shown at checkout for transfer payments.",
      href: "/admin/settings#bank",
      done: !!settings.bank.accountNumber,
    },
    {
      label: "Connect permanent storage",
      body: "Upstash Redis keeps products and orders safe.",
      href: "#health",
      done: storage.kind === "redis",
    },
    {
      label: "Create your first offer link",
      body: "Share a special link that applies a discount.",
      href: "/admin/offers/new",
      done: offerCount > 0,
    },
  ];
  if (isOwner) {
    items.push({ label: "Invite your team", body: "Give managers and support their own sign-in.", href: "/admin/staff", done: staffCount > 0 });
  }
  return items;
}

function Welcome({ productCount, checklist }: { productCount: number; checklist: ChecklistItem[] }) {
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  return (
    <section className={`relative mb-6 overflow-hidden rounded-2xl bg-ink p-5 text-white md:p-8 ${s.rise}`} aria-labelledby="welcome-title">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-accent-deep/60 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:gap-10">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold">
            <AdminIcon name="sparkle" size={14} /> Welcome to JDHub Admin
          </p>
          <h2 id="welcome-title" className="display mt-4 text-[26px] md:text-[34px]">
            Your first sale starts here.
          </h2>
          <p className="mt-2 max-w-md text-[14px] text-white/75">
            {productCount} products are live on your storefront. Finish these steps and you&apos;re ready to take orders with confidence.
          </p>
          <div className="mt-5 max-w-sm">
            <div className="flex justify-between text-[12px] font-bold text-white/80">
              <span>Setup progress</span>
              <span>
                {done} of {checklist.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.label}>
              <Link
                href={c.href}
                className="group flex h-full items-start gap-3 rounded-xl bg-white/[0.07] p-3 outline-none ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${c.done ? "bg-white text-ink" : "ring-1 ring-white/40"}`}>
                  {c.done && <AdminIcon name="check" size={13} strokeWidth={2.2} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[14px] font-bold ${c.done ? "text-white/60 line-through decoration-white/40" : ""}`}>{c.label}</span>
                  <span className="mt-0.5 block text-[12px] text-white/60">{c.body}</span>
                </span>
                <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="h-4 w-40 animate-pulse rounded bg-line" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-line" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3 md:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:mt-4 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-white lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}
