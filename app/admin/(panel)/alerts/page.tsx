import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAlertButton, SendModelButton } from "@/components/admin/alerts/AlertActions";
import { Pagination, TabNav } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { AdminPage, Badge, Card, EmptyState, fmtDate, PageHeader, relTime, StatCard, Table, type Tone } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { emailEnabled, smsEnabled } from "@/lib/messaging";
import { getCategory } from "@/lib/reference";
import { listStockAlerts, waitlistDemand, type StockAlertStatus } from "@/lib/stock-alerts";
import { listProducts } from "@/lib/store";

export const metadata: Metadata = { title: "Stock alerts" };

const PER_PAGE = 30;
const TABS = ["waiting", "notified", "skipped", "failed", "all"] as const;
type TabKey = (typeof TABS)[number];
const STATUS_LABEL: Record<StockAlertStatus, string> = { waiting: "Waiting", notified: "Notified", skipped: "Not delivered", failed: "Failed" };
const STATUS_TONE: Record<StockAlertStatus, Tone> = { waiting: "amber", notified: "green", skipped: "neutral", failed: "red" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function StockAlertsPage({ searchParams }: PageProps<"/admin/alerts">) {
  const session = await requireAdmin();
  const [alerts, products, sp] = await Promise.all([listStockAlerts(), listProducts(), searchParams]);
  const now = await requestNow();
  const canWrite = can(session.role, "products:write");
  const demand = await waitlistDemand({ alerts, products });

  const tabParam = first(sp.status);
  const tab: TabKey = (TABS as readonly string[]).includes(tabParam) ? (tabParam as TabKey) : "waiting";
  const model = first(sp.model).slice(0, 120);
  const scoped = alerts.filter((a) => !model || a.model === model);
  const rows = scoped.filter((a) => tab === "all" || a.status === tab);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pageParam = Number.parseInt(first(sp.page) || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const href = (patch: { status?: TabKey; page?: number; model?: string | null }) => {
    const u = new URLSearchParams();
    const s = patch.status ?? tab;
    if (s !== "waiting") u.set("status", s);
    const m = patch.model === null ? "" : (patch.model ?? model);
    if (m) u.set("model", m);
    if (patch.page && patch.page > 1) u.set("page", String(patch.page));
    const str = u.toString();
    return `/admin/alerts${str ? `?${str}` : ""}`;
  };

  const waiting = alerts.filter((a) => a.status === "waiting").length;
  const ready = demand.filter((d) => d.inStock > 0).reduce((n, d) => n + d.waiting, 0);
  const monthAgo = new Date(now - 30 * 86400_000).toISOString();
  const notified30 = alerts.filter((a) => a.notifiedAt && a.notifiedAt >= monthAgo && a.status === "notified").length;
  const noProvider = !emailEnabled() || !smsEnabled();

  return (
    <AdminPage>
      <PageHeader
        title="Stock alerts"
        description="Shoppers waiting for sold-out models. Use the demand list to decide what to buy next; alerts go out automatically when stock arrives."
      />

      {noProvider && (
        <p role="note" className="mb-6 rounded-2xl border border-[#f5d9a8] bg-[#fff8eb] px-4 py-3 text-[14px] text-[#7a4a00]">
          {!emailEnabled() && !smsEnabled()
            ? "Email and SMS aren't set up (RESEND_API_KEY, TERMII_API_KEY), so alerts are recorded as not delivered."
            : !emailEnabled()
              ? "Email isn't set up (RESEND_API_KEY): email alerts are recorded as not delivered."
              : "SMS isn't set up (TERMII_API_KEY): phone alerts are recorded as not delivered."}
        </p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting" value={waiting.toLocaleString("en-NG")} hint={`${demand.length} model${demand.length === 1 ? "" : "s"}`} />
        <StatCard label="Ready to send" value={ready.toLocaleString("en-NG")} hint="Model back in stock" tone={ready ? "warn" : "default"} />
        <StatCard label="Notified (30 days)" value={notified30.toLocaleString("en-NG")} tone={notified30 ? "good" : "default"} />
        <StatCard label="Top model" value={demand[0] ? demand[0].waiting : "—"} hint={demand[0]?.name ?? "No demand yet"} />
      </div>

      <Card title="Demand by model" className="mb-8">
        {demand.length === 0 ? (
          <p className="text-[14px] text-ink-2">Nobody is waiting on a sold-out model right now.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">Waiting</th>
                <th>Oldest request</th>
                <th>In stock now</th>
                {canWrite && <th className="text-right">Send</th>}
              </tr>
            </thead>
            <tbody>
              {demand.map((d) => (
                <tr key={d.model}>
                  <td>
                    <Link href={href({ model: d.model, status: "waiting", page: 1 })} className="font-bold hover:underline">
                      {d.name}
                    </Link>
                    <p className="text-[12px] text-muted">
                      {getCategory(d.category)?.name ?? d.category} · {d.model}
                      {d.exact > 0 && ` · ${d.exact} want the exact listing`}
                    </p>
                  </td>
                  <td className="text-right text-[16px] font-bold tabular-nums">{d.waiting}</td>
                  <td>
                    <time dateTime={d.oldest} title={fmtDate(d.oldest)}>
                      {relTime(d.oldest, now)}
                    </time>
                  </td>
                  <td>{d.inStock > 0 ? <Badge tone="green">{d.inStock} unit{d.inStock === 1 ? "" : "s"}</Badge> : <Badge tone="neutral">Sold out</Badge>}</td>
                  {canWrite && (
                    <td className="text-right">
                      <SendModelButton model={d.model} name={d.name} waiting={d.waiting} inStock={d.inStock} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <h2 className="mb-3 text-[18px] font-bold">
        Alerts
        {model && (
          <span className="ml-2 text-[14px] font-normal text-ink-2">
            for {model} ·{" "}
            <Link href={href({ model: null, page: 1 })} className="font-bold underline underline-offset-4">
              show all
            </Link>
          </span>
        )}
      </h2>
      <TabNav
        label="Alert status"
        tabs={TABS.map((t) => ({
          href: href({ status: t, page: 1 }),
          label: t === "all" ? "All" : STATUS_LABEL[t],
          count: scoped.filter((a) => t === "all" || a.status === t).length,
          active: t === tab,
        }))}
      />

      {visible.length === 0 ? (
        <EmptyState title={alerts.length ? "Nothing here" : "No stock alerts yet"} body={alerts.length ? "No alerts match this tab." : "When a shopper asks to hear about a sold-out product, it shows up here."} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Product</th>
              <th>Status</th>
              <th>Requested</th>
              {canWrite && <th className="text-right">
                <span className="sr-only">Actions</span>
              </th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id}>
                <td>
                  <p className="font-bold">{a.contact}</p>
                  <p className="text-[12px] text-muted">
                    {a.channel === "sms" ? "SMS" : "Email"}
                    {a.customerId && (
                      <>
                        {" "}· account {a.customerId}
                      </>
                    )}
                  </p>
                </td>
                <td>
                  <Link href={`/admin/products/${encodeURIComponent(a.productId)}`} className="font-bold hover:underline">
                    {a.productName}
                  </Link>
                  <p className="text-[12px] text-muted">{a.exact ? "This exact listing only" : `Any ${a.model} unit`}</p>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  {a.notifiedAt && (
                    <p className="mt-1 text-[12px] text-muted">
                      {a.status === "notified" ? "Sent" : "Tried"} {relTime(a.notifiedAt, now)}
                      {a.notifiedProductId && a.notifiedProductId !== a.productId && ` · ${a.notifiedProductId}`}
                    </p>
                  )}
                  {a.lastError && a.status !== "notified" && <p className="mt-1 max-w-64 truncate text-[12px] text-muted" title={a.lastError}>{a.lastError}</p>}
                </td>
                <td>
                  <time dateTime={a.createdAt} title={fmtDate(a.createdAt)}>
                    {relTime(a.createdAt, now)}
                  </time>
                </td>
                {canWrite && (
                  <td className="text-right">
                    <DeleteAlertButton id={a.id} label={`${a.productName} (${a.contact})`} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => href({ page: p })} />
    </AdminPage>
  );
}
