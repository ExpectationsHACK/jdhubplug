import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { aggregateCustomers, customerWaLink, itemCount, money, PAYMENT_LABEL, phoneKey, telHref } from "@/components/admin/orders/format";
import { Avatar, IconLink, LineThumb, StatMoney, StatusBadge } from "@/components/admin/orders/parts";
import { artForLines, requestNow } from "@/components/admin/orders/server";
import { AdminPage, Card, fmtDate, PageHeader, relTime, StatCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings, listOrders } from "@/lib/store";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[phone]">) {
  await requireAdmin();
  const key = phoneKey(decodeURIComponent((await params).phone));
  if (key.length !== 10) notFound();

  const [all, settings] = await Promise.all([listOrders(), getSettings()]);
  const orders = all.filter((o) => phoneKey(o.customer.phone) === key);
  const c = aggregateCustomers(orders)[0];
  if (!c) notFound();

  const [now, art] = await Promise.all([requestNow(), artForLines(orders.map((o) => o.lines[0]).filter(Boolean))]);
  const wa = customerWaLink(c.phone, `Hi ${c.name.split(/\s+/)[0]}, this is ${settings.storeName}.`);
  const avg = c.paidOrders ? Math.round(c.spent / c.paidOrders) : 0;
  const names = [...new Set(orders.map((o) => o.customer.name))];
  const addresses = [...new Set(orders.filter((o) => o.delivery === "delivery").map((o) => [o.customer.address, o.customer.city, o.customer.state].filter(Boolean).join(", ")))].filter(Boolean);
  const units = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded").reduce((n, o) => n + itemCount(o), 0);

  return (
    <AdminPage>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={c.name}
        description={
          <>
            Customer since <time dateTime={c.firstOrderAt}>{fmtDate(c.firstOrderAt)}</time>
          </>
        }
        actions={
          <>
            <a href={telHref(c.phone)} className="btn btn-outline">
              Call
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn bg-wa text-white hover:brightness-95">
                WhatsApp
              </a>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime value" value={<StatMoney>{money(c.spent)}</StatMoney>} hint={`${c.paidOrders} paid order${c.paidOrders === 1 ? "" : "s"}`} tone={c.spent ? "good" : "default"} />
        <StatCard label="Orders" value={c.orders} hint={c.openOrders ? `${c.openOrders} open` : "None open"} />
        <StatCard label="Average order" value={<StatMoney>{avg ? money(avg) : "—"}</StatMoney>} />
        <StatCard label="Items bought" value={units} hint={`Last order ${relTime(c.lastOrderAt, now)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Orders">
          <ul className="-mx-5 divide-y divide-line">
            {orders.map((o) => {
              const firstLine = o.lines[0];
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fafbfc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    {firstLine && <LineThumb line={firstLine} art={art[firstLine.productId]} size={48} />}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{o.id}</span>
                        <StatusBadge status={o.status} />
                      </p>
                      <p className="truncate text-[13px] text-muted">
                        {firstLine?.name}
                        {o.lines.length > 1 && ` +${o.lines.length - 1} more`} · <time dateTime={o.createdAt} title={fmtDate(o.createdAt)}>{relTime(o.createdAt, now)}</time> ·{" "}
                        {PAYMENT_LABEL[o.payment.method]}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums">{money(o.total)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <aside className="min-w-0 space-y-4" aria-label="Customer details">
          <Card title="Contact">
            <div className="flex items-center gap-3">
              <Avatar name={c.name} size={48} />
              <div className="min-w-0">
                <p className="truncate font-bold">{c.name}</p>
                <p className="text-[14px] text-ink-2">{c.phone}</p>
              </div>
            </div>
            {c.email && <p className="mt-3 truncate text-[14px] text-ink-2">{c.email}</p>}
            <div className="mt-4 flex gap-2">
              <IconLink href={telHref(c.phone)} label={`Call ${c.name}`} kind="phone" />
              {c.email && <IconLink href={`mailto:${c.email}`} label={`Email ${c.name}`} kind="mail" />}
              {wa && <IconLink href={wa} label={`WhatsApp ${c.name}`} kind="wa" external />}
            </div>
            {names.length > 1 && <p className="mt-4 text-[12px] text-muted">Also ordered as: {names.slice(1).join(", ")}</p>}
          </Card>
          <Card title="Locations">
            <p className="text-[14px] font-bold">{c.states.join(", ") || "—"}</p>
            {addresses.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
                {addresses.slice(0, 5).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </AdminPage>
  );
}
