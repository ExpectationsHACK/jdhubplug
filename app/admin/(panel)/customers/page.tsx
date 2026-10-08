import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { aggregateCustomers, customerWaLink, money, telHref, type CustomerSummary } from "@/components/admin/orders/format";
import { Avatar, IconLink, Pagination, StatMoney } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { AdminPage, EmptyState, fmtDate, PageHeader, relTime, StatCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings, listOrders } from "@/lib/store";

export const metadata: Metadata = { title: "Customers" };

const PER_PAGE = 30;
const SORTS = { spend: "Top spenders", recent: "Most recent", orders: "Most orders" } as const;
type Sort = keyof typeof SORTS;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const [orders, settings, sp] = await Promise.all([listOrders(), getSettings(), searchParams]);
  const now = await requestNow();

  const q = first(sp.q).trim().slice(0, 80);
  const sortParam = first(sp.sort);
  const sort: Sort = sortParam in SORTS ? (sortParam as Sort) : "spend";
  const pageParam = Number.parseInt(first(sp.page) || "1", 10);

  const all = aggregateCustomers(orders);
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^(234|0)/, "");
  const matches = (c: CustomerSummary) =>
    !q ||
    c.name.toLowerCase().includes(needle) ||
    !!c.email?.toLowerCase().includes(needle) ||
    c.states.some((s) => s.toLowerCase().includes(needle)) ||
    (digits.length >= 4 && c.phone.replace(/\D/g, "").includes(digits));

  const cmp: Record<Sort, (a: CustomerSummary, b: CustomerSummary) => number> = {
    spend: (a, b) => b.spent - a.spent || b.lastOrderAt.localeCompare(a.lastOrderAt),
    recent: (a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt),
    orders: (a, b) => b.orders - a.orders || b.spent - a.spent,
  };
  const rows = all.filter(matches).sort(cmp[sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const paying = all.filter((c) => c.paidOrders > 0);
  const repeat = paying.filter((c) => c.paidOrders > 1);
  const ltv = paying.length ? Math.round(paying.reduce((n, c) => n + c.spent, 0) / paying.length) : 0;

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (sort !== "spend") u.set("sort", sort);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <AdminPage>
      <PageHeader title="Customers" description="Everyone who has ordered, grouped by phone number." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Customers" value={all.length.toLocaleString("en-NG")} hint={`${paying.length} have paid`} />
        <StatCard label="Repeat buyers" value={repeat.length} hint={paying.length ? `${Math.round((repeat.length / paying.length) * 100)}% of paying customers` : "No paying customers yet"} />
        <StatCard label="Average lifetime value" value={<StatMoney>{ltv ? money(ltv) : "—"}</StatMoney>} hint="Per paying customer" />
      </div>

      <div className="mb-4">
        <FilterBar
          action="/admin/customers"
          q={q}
          placeholder="Search name, phone, email or state"
          selects={[{ name: "sort", label: "Sort by", value: sort, options: Object.entries(SORTS).map(([value, label]) => ({ value, label })) }]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={all.length ? "No customers match" : "No customers yet"}
          body={all.length ? "Try a different name or the last digits of their phone number." : "Customers appear here after their first order."}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
            <table className="adm-table w-full text-left text-[14px]">
              <caption className="sr-only">Customers</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col" className="text-right">
                    Spent
                  </th>
                  <th scope="col">Last order</th>
                  <th scope="col">
                    <span className="sr-only">Contact</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const wa = customerWaLink(c.phone, `Hi ${c.name.split(/\s+/)[0]}, this is ${settings.storeName}.`);
                  return (
                    <tr key={c.key} className="group">
                      <td className="max-w-[280px]">
                        <Link href={`/admin/customers/${c.key}`} className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <span className="min-w-0">
                            <span className="block truncate font-bold group-hover:underline">{c.name}</span>
                            <span className="block truncate text-[12px] text-muted">{c.email ?? c.phone}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="max-w-[160px] truncate text-ink-2">{c.states.join(", ") || "—"}</td>
                      <td className="text-right tabular-nums">
                        {c.orders}
                        {c.openOrders > 0 && <span className="ml-1 text-[12px] text-muted">({c.openOrders} open)</span>}
                      </td>
                      <td className="text-right font-bold tabular-nums">{money(c.spent)}</td>
                      <td className="whitespace-nowrap text-ink-2">
                        <time dateTime={c.lastOrderAt} title={fmtDate(c.lastOrderAt)}>
                          {relTime(c.lastOrderAt, now)}
                        </time>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <IconLink href={telHref(c.phone)} label={`Call ${c.name}`} kind="phone" />
                          {wa && <IconLink href={wa} label={`WhatsApp ${c.name}`} kind="wa" external />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {visible.map((c) => (
              <li key={c.key}>
                <Link href={`/admin/customers/${c.key}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 active:bg-stage">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.name}</p>
                    <p className="truncate text-[12px] text-muted">
                      {c.orders} order{c.orders === 1 ? "" : "s"} · {relTime(c.lastOrderAt, now)}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums">{money(c.spent)}</p>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={qs} />
        </>
      )}
    </AdminPage>
  );
}
