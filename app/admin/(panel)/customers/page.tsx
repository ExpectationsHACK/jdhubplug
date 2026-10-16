import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { aggregateCustomers, countsAsRevenue, customerWaLink, money, phoneKey, telHref, type CustomerSummary } from "@/components/admin/orders/format";
import { BlockButton } from "@/components/admin/customers/BlockButton";
import { Avatar, IconLink, Pagination, StatMoney, TabNav } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { AdminPage, Badge, EmptyState, fmtDate, PageHeader, relTime, StatCard } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { getSettings, listCustomers, listOrders } from "@/lib/store";
import type { Customer, Order } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

const PER_PAGE = 30;
const SORTS = { spend: "Top spenders", recent: "Most recent", orders: "Most orders" } as const;
type Sort = keyof typeof SORTS;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const session = await requireAdmin();
  const [orders, settings, accounts, sp] = await Promise.all([listOrders(), getSettings(), listCustomers(), searchParams]);
  const now = await requestNow();

  const q = first(sp.q).trim().slice(0, 80);
  const view = first(sp.view) === "accounts" ? "accounts" : "buyers";
  const tabs = (
    <TabNav
      label="Customer views"
      tabs={[
        { href: "/admin/customers", label: "Buyers", active: view === "buyers" },
        { href: "/admin/customers?view=accounts", label: "Accounts", count: accounts.length, active: view === "accounts" },
      ]}
    />
  );
  if (view === "accounts") {
    return <AccountsView accounts={accounts} orders={orders} q={q} page={Number.parseInt(first(sp.page) || "1", 10)} now={now} canBlock={can(session.role, "orders:write")} tabs={tabs} />;
  }

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
      {tabs}

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

function AccountsView({
  accounts,
  orders,
  q,
  page: pageParam,
  now,
  canBlock,
  tabs,
}: {
  accounts: Customer[];
  orders: Order[];
  q: string;
  page: number;
  now: number;
  canBlock: boolean;
  tabs: React.ReactNode;
}) {
  // Orders placed while signed in carry customerId; count those per account.
  const byAccount = new Map<string, { orders: number; spent: number }>();
  for (const o of orders) {
    if (!o.customerId) continue;
    const t = byAccount.get(o.customerId) ?? { orders: 0, spent: 0 };
    t.orders++;
    if (countsAsRevenue(o)) t.spent += o.total;
    byAccount.set(o.customerId, t);
  }

  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^(234|0)/, "");
  const rows = accounts.filter(
    (c) =>
      !q ||
      !!c.name?.toLowerCase().includes(needle) ||
      !!c.email?.includes(needle) ||
      c.id.toLowerCase() === needle ||
      !!c.contactEmail?.includes(needle) ||
      (digits.length >= 4 && [c.phone, c.contactPhone].some((p) => !!p?.replace(/\D/g, "").includes(digits))),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const blocked = accounts.filter((c) => c.blocked).length;
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const active = accounts.filter((c) => (c.lastLoginAt ?? "") >= weekAgo).length;

  const qs = (p: number) => {
    const u = new URLSearchParams({ view: "accounts" });
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    return `/admin/customers?${u}`;
  };
  const label = (c: Customer) => c.name || c.email || c.phone || c.id;

  return (
    <AdminPage>
      <PageHeader title="Customers" description="Shopper accounts: everyone who has signed in with a phone or email code." />
      {tabs}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Accounts" value={accounts.length.toLocaleString("en-NG")} hint={`${byAccount.size} have ordered while signed in`} />
        <StatCard label="Signed in this week" value={active} />
        <StatCard label="Blocked" value={blocked} hint={blocked ? "Can't sign in or check out" : "Nobody is blocked"} />
      </div>

      <div className="mb-4">
        <FilterBar action="/admin/customers" q={q} placeholder="Search name, phone, email or account ID" hidden={{ view: "accounts" }} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={accounts.length ? "No accounts match" : "No accounts yet"}
          body={accounts.length ? "Try a different name, email or the last digits of a phone number." : "Shoppers appear here after they sign in at /signin or at checkout."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="adm-table w-full min-w-[760px] text-left text-[14px]">
              <caption className="sr-only">Shopper accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Shopper</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col" className="text-right">
                    Spent
                  </th>
                  <th scope="col">Status</th>
                  {canBlock && (
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const t = byAccount.get(c.id);
                  const key = c.phone ? phoneKey(c.phone) : "";
                  const name = label(c);
                  return (
                    <tr key={c.id}>
                      <td className="max-w-[280px]">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <span className="min-w-0">
                            {key && t ? (
                              <Link href={`/admin/customers/${key}`} className="block truncate font-bold hover:underline">
                                {name}
                              </Link>
                            ) : (
                              <span className="block truncate font-bold">{name}</span>
                            )}
                            <span className="block truncate text-[12px] text-muted">
                              {[c.phone, c.email].filter(Boolean).join(" · ") || c.id}
                              {(c.contactPhone || c.contactEmail) && <span title="Typed at checkout, not verified"> · contact {[c.contactPhone, c.contactEmail].filter(Boolean).join(", ")}</span>}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-ink-2">
                        <time dateTime={c.createdAt}>{fmtDate(c.createdAt)}</time>
                      </td>
                      <td className="whitespace-nowrap text-ink-2">
                        {c.lastLoginAt ? (
                          <time dateTime={c.lastLoginAt} title={fmtDate(c.lastLoginAt)}>
                            {relTime(c.lastLoginAt, now)}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-right tabular-nums">{t?.orders ?? 0}</td>
                      <td className="text-right font-bold tabular-nums">{t?.spent ? money(t.spent) : "—"}</td>
                      <td>{c.blocked ? <Badge tone="red">Blocked</Badge> : <Badge tone="green">Active</Badge>}</td>
                      {canBlock && (
                        <td className="text-right">
                          <BlockButton id={c.id} name={name} blocked={!!c.blocked} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={qs} />
        </>
      )}
    </AdminPage>
  );
}
