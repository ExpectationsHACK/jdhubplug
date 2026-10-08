import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import {
  countsAsRevenue,
  DATE_RANGES,
  filtersToQuery,
  inRange,
  inTab,
  itemCount,
  matchesQuery,
  money,
  ORDER_TABS,
  PAYMENT_LABEL,
  readOrderFilters,
  type OrderFilters,
} from "@/components/admin/orders/format";
import { LineThumb, Pagination, StatMoney, StatusBadge, TabNav } from "@/components/admin/orders/parts";
import { artForLines, requestNow, sweptOrders } from "@/components/admin/orders/server";
import { SweepRefresher, TimeLeft } from "@/components/admin/orders/Widgets";
import { AdminPage, EmptyState, fmtDate, PageHeader, relTime, StatCard } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

const PER_PAGE = 25;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const session = await requireAdmin();
  const [{ orders, released }, sp] = await Promise.all([sweptOrders(), searchParams]);
  const now = await requestNow();
  const f = readOrderFilters(sp);

  // Search, date and payment filters narrow everything; the tab picks a status group.
  const scoped = orders.filter((o) => matchesQuery(o, f.q) && inRange(o, f.range, now) && (f.pay === "all" || o.payment.method === f.pay));
  const rows = scoped.filter((o) => inTab(o, f.tab));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(f.page, pages);
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const art = await artForLines(visible.map((o) => o.lines[0]).filter(Boolean));

  const toFulfil = orders.filter((o) => o.status === "paid" || o.status === "processing");
  const awaiting = orders.filter((o) => o.status === "pending");
  const last30 = orders.filter((o) => countsAsRevenue(o) && inRange(o, "30d", now));
  const revenue30 = last30.reduce((n, o) => n + o.total, 0);

  const href = (patch: Partial<OrderFilters>) => `/admin/orders${filtersToQuery({ ...f, page: 1, ...patch })}`;
  const filtered = f.q || f.range !== "all" || f.pay !== "all";
  const exportHref = `/api/admin/orders/export${filtersToQuery({ ...f, page: 1 })}`;

  return (
    <AdminPage>
      <SweepRefresher released={released} />
      <PageHeader
        title="Orders"
        description={
          <>
            {orders.length.toLocaleString("en-NG")} orders
            {released > 0 && <> · {released} expired reservation{released === 1 ? "" : "s"} just released</>}
          </>
        }
        actions={
          can(session.role, "orders:write") && (
            <a href={exportHref} className="btn btn-outline" download>
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />
              </svg>
              Export CSV
            </a>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="To fulfil" value={toFulfil.length} hint="Paid, waiting to ship" tone={toFulfil.length ? "warn" : "default"} />
        <StatCard label="Awaiting payment" value={awaiting.length} hint={`${money(awaiting.reduce((n, o) => n + o.total, 0))} reserved`} />
        <StatCard label="Revenue, 30 days" value={<StatMoney>{money(revenue30)}</StatMoney>} hint={`${last30.length} paid orders`} />
        <StatCard label="Average order" value={<StatMoney>{last30.length ? money(Math.round(revenue30 / last30.length)) : "—"}</StatMoney>} hint="Last 30 days" />
      </div>

      <TabNav
        label="Order status"
        tabs={ORDER_TABS.map((t) => ({
          href: href({ tab: t.key }),
          label: t.label,
          count: scoped.filter((o) => inTab(o, t.key)).length,
          active: f.tab === t.key,
        }))}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          action="/admin/orders"
          q={f.q}
          placeholder="Search order ID, customer or phone"
          hidden={{ status: f.tab === "all" ? "" : f.tab }}
          selects={[
            { name: "range", label: "Date", value: f.range, options: DATE_RANGES.map((r) => ({ value: r.key, label: r.label })) },
            {
              name: "pay",
              label: "Payment method",
              value: f.pay,
              options: [{ value: "all", label: "All payments" }, ...Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))],
            },
          ]}
        />
        {filtered && (
          <Link href={href({ q: "", range: "all", pay: "all" })} className="text-[13px] font-bold text-muted underline underline-offset-4 hover:text-ink">
            Clear filters
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "No orders yet" : "No orders match"}
          body={orders.length === 0 ? "Orders placed at checkout show up here, with stock reserved until they're paid." : "Try another tab, a wider date range or a different search."}
          action={
            filtered ? (
              <Link href={href({ q: "", range: "all", pay: "all" })} className="btn btn-outline">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
            <table className="adm-table w-full text-left text-[14px]">
              <caption className="sr-only">Orders</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Items</th>
                  <th scope="col" className="text-right">
                    Total
                  </th>
                  <th scope="col">Payment</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className="group">
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold underline-offset-4 group-hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                        {o.id}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-ink-2">
                      <time dateTime={o.createdAt} title={fmtDate(o.createdAt)}>
                        {relTime(o.createdAt, now)}
                      </time>
                    </td>
                    <td className="max-w-[220px]">
                      <p className="truncate font-bold">{o.customer.name}</p>
                      <p className="truncate text-[12px] text-muted">
                        {o.customer.phone} · {o.customer.state}
                      </p>
                    </td>
                    <td>
                      <Items order={o} art={art} />
                    </td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums">
                      {money(o.total)}
                      {o.offerCode && <p className="text-[11px] font-bold uppercase tracking-wide text-accent">{o.offerCode}</p>}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{PAYMENT_LABEL[o.payment.method]}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "pending" && o.reservedUntil && <TimeLeft until={o.reservedUntil} now={now} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {visible.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl border border-line bg-white p-4 transition-colors active:bg-stage">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{o.id}</p>
                      <p className="truncate text-[13px] text-ink-2">{o.customer.name}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Items order={o} art={art} />
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{money(o.total)}</p>
                      <p className="text-[12px] text-muted">
                        <time dateTime={o.createdAt}>{relTime(o.createdAt, now)}</time> · {PAYMENT_LABEL[o.payment.method]}
                      </p>
                    </div>
                  </div>
                  {o.status === "pending" && o.reservedUntil && <TimeLeft until={o.reservedUntil} now={now} className="mt-2" />}
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => `/admin/orders${filtersToQuery({ ...f, page: p })}`} />
        </>
      )}
    </AdminPage>
  );
}

function Items({ order, art }: { order: Order; art: Awaited<ReturnType<typeof artForLines>> }) {
  const first = order.lines[0];
  const n = itemCount(order);
  if (!first) return <span className="text-muted">—</span>;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LineThumb line={first} art={art[first.productId]} size={40} />
      <div className="min-w-0 text-[13px]">
        <p className="max-w-[180px] truncate font-bold">{first.name}</p>
        <p className="text-muted">
          {n} item{n === 1 ? "" : "s"}
          {order.lines.length > 1 && ` · +${order.lines.length - 1} more`}
        </p>
      </div>
    </div>
  );
}
