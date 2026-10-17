import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/admin/orders/OrderActions";
import { customerWaLink, itemCount, money, orderStatusMessage, PAYMENT_LABEL, phoneKey, STATUS_LABEL, telHref } from "@/components/admin/orders/format";
import { OrderMessageList } from "@/components/admin/notifications/MessageLog";
import { ResendButtons } from "@/components/admin/notifications/NotifyForms";
import { IconLink, LineThumb, StatusBadge, WaGlyph } from "@/components/admin/orders/parts";
import { artForLines, requestNow, siteOrigin } from "@/components/admin/orders/server";
import { CopyLinkButton, NoteForm, TimeLeft } from "@/components/admin/orders/Widgets";
import { AdminPage, Card, fmtDate, PageHeader, relTime } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { EVENT_LABEL } from "@/lib/notify/events";
import { latestEvent } from "@/lib/notify/orders";
import { listOrderNotifyLog } from "@/lib/notify/store";
import { ORDER_FLOW } from "@/lib/orders";
import { getSettings, listOrders } from "@/lib/store";
import type { Order, OrderEvent, OrderStatus } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${decodeURIComponent(id).toUpperCase().slice(0, 20)}` };
}

const STEPS: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "completed"];
const STEP_LABEL: Partial<Record<OrderStatus, string>> = { pending: "Placed", paid: "Paid", processing: "Processing", shipped: "Shipped", delivered: "Delivered", completed: "Completed" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const session = await requireAdmin();
  const id = decodeURIComponent((await params).id).toUpperCase();
  if (!/^JDH-\d{1,12}$/.test(id)) notFound();

  const [orders, settings] = await Promise.all([listOrders(), getSettings()]);
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  const [now, origin, art, messages] = await Promise.all([requestNow(), siteOrigin(), artForLines(order.lines), listOrderNotifyLog(order.id)]);
  const key = phoneKey(order.customer.phone);
  const customerOrders = orders.filter((o) => phoneKey(o.customer.phone) === key);
  const customerPath = `/order/${order.id}?t=${order.token}`;
  const wa = customerWaLink(order.customer.phone, orderStatusMessage(order, settings.storeName, origin + customerPath));
  const hub = order.pickupHub ? settings.hubs.find((h) => h.city === order.pickupHub) : undefined;
  const allowed = ORDER_FLOW[order.status];
  const n = itemCount(order);
  const savedPerUnit = order.lines.some((l) => l.finalUnitPrice < l.unitPrice);

  return (
    <AdminPage>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={order.id}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={order.status} />
            <span>
              Placed <time dateTime={order.createdAt}>{fmtDate(order.createdAt)}</time> · {n} item{n === 1 ? "" : "s"} · {money(order.total)}
            </span>
          </span>
        }
        actions={
          <>
            <CopyLinkButton path={customerPath} />
            <Link href={`/admin/orders/${order.id}/invoice?print=1`} target="_blank" className="btn btn-outline">
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z" />
              </svg>
              Print invoice
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {/* Status + next step */}
          <Card>
            {order.status === "cancelled" || order.status === "refunded" ? (
              <div className="flex items-start gap-3 rounded-xl bg-stage p-4">
                <svg aria-hidden className="mt-0.5 shrink-0 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M8.5 8.5l7 7" />
                </svg>
                <div className="text-[14px]">
                  <p className="font-bold">{STATUS_LABEL[order.status]}</p>
                  <p className="text-ink-2">
                    {order.restocked ? "Every item was returned to stock and is back on sale." : "Stock for this order has not been restored."}
                  </p>
                </div>
              </div>
            ) : (
              <Stepper status={order.status} history={order.history} />
            )}

            {order.status === "pending" && order.reservedUntil && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f5c06b] bg-[#fff8eb] px-4 py-3 text-[13px] text-[#7a4b00]">
                <span>
                  Stock reserved until <b>{fmtDate(order.reservedUntil)}</b>. If it isn&apos;t paid by then, it cancels and restocks automatically.
                </span>
                <TimeLeft until={order.reservedUntil} now={now} />
              </div>
            )}

            {allowed.length > 0 && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-[13px] font-bold text-muted">Next step</p>
                <OrderActions
                  id={order.id}
                  allowed={allowed}
                  delivery={order.delivery}
                  total={money(order.total)}
                  method={PAYMENT_LABEL[order.payment.method].toLowerCase()}
                  canWrite={can(session.role, "orders:write")}
                />
              </div>
            )}
          </Card>

          {/* Items */}
          <Card title={`Items (${n})`}>
            <ul className="divide-y divide-line">
              {order.lines.map((l) => {
                const discounted = l.finalUnitPrice < l.unitPrice;
                return (
                  <li key={l.productId} className="flex items-center gap-4 py-3 first:pt-0">
                    <LineThumb line={l} art={art[l.productId]} size={64} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/products/${encodeURIComponent(l.productId)}`} className="line-clamp-2 font-bold hover:underline">
                        {l.name}
                      </Link>
                      <p className="truncate text-[13px] text-muted">{l.spec}</p>
                      <p className="mt-1 text-[13px] text-ink-2 tabular-nums">
                        {l.qty} ×{" "}
                        {discounted && (
                          <>
                            <s className="text-muted">{money(l.unitPrice)}</s>{" "}
                          </>
                        )}
                        <span className={discounted ? "font-bold text-sale" : ""}>{money(l.finalUnitPrice)}</span>
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-bold tabular-nums">{money(l.finalUnitPrice * l.qty)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discount > 0 && (
                <Row
                  label={
                    <>
                      Discount
                      {order.offerCode && (
                        <Link href="/admin/offers" className="ml-2 rounded-full bg-[#e8efff] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent hover:underline">
                          {order.offerCode}
                        </Link>
                      )}
                    </>
                  }
                  value={<span className="text-sale">−{money(order.discount)}</span>}
                />
              )}
              <Row label={order.delivery === "pickup" ? "Pickup" : "Delivery"} value={order.deliveryFee ? money(order.deliveryFee) : "Free"} />
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-bold">Total</dt>
                <dd className="display text-[22px] tabular-nums">{money(order.total)}</dd>
              </div>
              {savedPerUnit && !order.discount && <p className="text-[12px] text-muted">Offer prices are already included in the line prices.</p>}
            </dl>
          </Card>

          {/* Timeline */}
          <Card title="Timeline">
            {can(session.role, "orders:write") && (
              <div className="mb-6">
                <NoteForm id={order.id} />
              </div>
            )}
            <Timeline events={order.history} now={now} />
          </Card>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Order details">
          <Card
            title="Customer"
            actions={
              <Link href={`/admin/customers/${key}`} className="text-[13px] font-bold text-accent hover:underline">
                {customerOrders.length} order{customerOrders.length === 1 ? "" : "s"} →
              </Link>
            }
          >
            <p className="font-bold">{order.customer.name}</p>
            <p className="mt-0.5 text-[14px] text-ink-2">{order.customer.phone}</p>
            {order.customer.email && <p className="truncate text-[14px] text-ink-2">{order.customer.email}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <IconLink href={telHref(order.customer.phone)} label={`Call ${order.customer.name}`} kind="phone" />
              {order.customer.email && <IconLink href={`mailto:${order.customer.email}`} label={`Email ${order.customer.name}`} kind="mail" />}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn min-h-9 flex-1 bg-wa px-4 py-2 text-white hover:brightness-95">
                  <WaGlyph /> Message on WhatsApp
                </a>
              )}
            </div>
            {wa && <p className="mt-2 text-[12px] text-muted">Opens a chat with the customer, prefilled with a {STATUS_LABEL[order.status].toLowerCase()} update and their tracking link.</p>}
          </Card>

          <Card title={order.delivery === "pickup" ? "Pickup" : "Delivery"}>
            {order.delivery === "pickup" ? (
              <div className="text-[14px]">
                <p className="font-bold">{order.pickupHub ? `${order.pickupHub} hub` : "Pickup hub not chosen"}</p>
                {hub && (
                  <>
                    <p className="text-ink-2">{hub.address}</p>
                    <p className="text-[13px] text-muted">{hub.hours}</p>
                  </>
                )}
              </div>
            ) : (
              <address className="text-[14px] not-italic leading-relaxed text-ink-2">
                <span className="font-bold text-ink">{order.customer.name}</span>
                <br />
                {order.customer.address && (
                  <>
                    {order.customer.address}
                    <br />
                  </>
                )}
                {[order.customer.city, order.customer.state].filter(Boolean).join(", ")}
              </address>
            )}
            {order.customerNote && (
              <div className="mt-4 rounded-xl bg-stage p-3 text-[13px]">
                <p className="font-bold">Note from customer</p>
                <p className="mt-1 whitespace-pre-line break-words text-ink-2">{order.customerNote}</p>
              </div>
            )}
          </Card>

          <Card title="Payment">
            <dl className="space-y-2 text-[14px]">
              <Row label="Method" value={PAYMENT_LABEL[order.payment.method]} />
              <Row
                label="Status"
                value={order.status === "refunded" ? <span className="font-bold text-sale">Refunded</span> : order.payment.paidAt ? <span className="font-bold text-ok">Paid</span> : order.status === "cancelled" ? "Not paid" : <span className="font-bold text-[#b45309]">Unpaid</span>}
              />
              {order.payment.paidAt && <Row label="Paid" value={fmtDate(order.payment.paidAt)} />}
              {order.payment.reference && <Row label="Reference" value={<span className="break-all font-mono text-[12px]">{order.payment.reference}</span>} />}
              {order.status === "pending" && order.reservedUntil && <Row label="Pay by" value={fmtDate(order.reservedUntil)} />}
              {order.offerCode && <Row label="Offer" value={<span className="font-bold uppercase text-accent">{order.offerCode}</span>} />}
            </dl>
            {order.payment.paidAt && !["completed", "refunded"].includes(order.status) && (
              <p className="mt-4 flex gap-2 rounded-xl bg-[#e8efff] p-3 text-[12px] text-accent-deep">
                <svg aria-hidden className="mt-px shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" />
                </svg>
                Funds are held in escrow until the buyer confirms delivery.
              </p>
            )}
          </Card>

          <Card title="Messages">
            {can(session.role, "orders:write") && (
              <div className="mb-4 border-b border-line pb-4">
                <ResendButtons id={order.id} latestLabel={EVENT_LABEL[latestEvent(order)]} />
              </div>
            )}
            <OrderMessageList entries={messages} now={now} />
          </Card>
        </aside>
      </div>
    </AdminPage>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex items-center text-ink-2">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function Stepper({ status, history }: { status: OrderStatus; history: OrderEvent[] }) {
  const current = STEPS.indexOf(status);
  const reachedAt = (s: OrderStatus) => history.findLast((e) => e.status === s)?.at;
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const done = i <= current;
        const at = reachedAt(s);
        return (
          <li key={s} className="min-w-0" aria-current={i === current ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${done ? "bg-ink" : "bg-line"} ${i === current ? "adm-step-current" : ""}`} />
            <p className={`mt-2 truncate text-[12px] font-bold ${done ? "text-ink" : "text-muted"}`}>{STEP_LABEL[s]}</p>
            <p className="hidden truncate text-[11px] text-muted sm:block">{at ? new Date(at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : " "}</p>
          </li>
        );
      })}
      <style>{`
        .adm-step-current { position: relative; overflow: hidden; }
        .adm-step-current::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transform: translateX(-100%); animation: adm-step-shine 2.4s ease-in-out infinite; }
        @keyframes adm-step-shine { to { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .adm-step-current::after { animation: none; display: none; } }
      `}</style>
    </ol>
  );
}

const DOT: Record<OrderEvent["status"], string> = {
  pending: "bg-[#f5a524]",
  paid: "bg-accent",
  processing: "bg-[#6b21a8]",
  shipped: "bg-[#6b21a8]",
  delivered: "bg-ok",
  completed: "bg-ok",
  cancelled: "bg-muted",
  refunded: "bg-sale",
  note: "bg-white border-2 border-ink",
};

function Timeline({ events, now }: { events: Order["history"]; now: number }) {
  const list = [...events].reverse();
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {list.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-4 pl-0">
          <span aria-hidden className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${DOT[e.status]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[14px] font-bold">{e.status === "note" ? "Note" : STATUS_LABEL[e.status]}</p>
              <time dateTime={e.at} title={fmtDate(e.at)} className="text-[12px] text-muted">
                {relTime(e.at, now)}
              </time>
            </div>
            {e.note && (
              <p className={`mt-1 whitespace-pre-line break-words text-[13px] ${e.status === "note" ? "rounded-xl bg-stage px-3 py-2 text-ink" : "text-ink-2"}`}>{e.note}</p>
            )}
            <p className="mt-0.5 text-[12px] text-muted">by {e.by}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
