import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { itemCount, money, PAYMENT_LABEL, STATUS_LABEL } from "@/components/admin/orders/format";
import { PrintButton } from "@/components/admin/orders/Widgets";
import { requireAdmin } from "@/lib/auth";
import { getOrder, getSettings } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]/invoice">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Invoice ${decodeURIComponent(id).toUpperCase().slice(0, 20)}` };
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Printable invoice + packing slip. The admin shell is hidden when printing, so only
// the sheet reaches the paper.

export default async function InvoicePage({ params, searchParams }: PageProps<"/admin/orders/[id]/invoice">) {
  await requireAdmin();
  const id = decodeURIComponent((await params).id).toUpperCase();
  if (!/^JDH-\d{1,12}$/.test(id)) notFound();
  const [order, settings, sp] = await Promise.all([getOrder(id), getSettings(), searchParams]);
  if (!order) notFound();

  const paid = !!order.payment.paidAt && order.status !== "refunded";
  const payState = order.status === "refunded" ? "Refunded" : order.status === "cancelled" ? "Cancelled" : paid ? "Paid" : "Awaiting payment";
  const bank = settings.bank;
  const showBank = !paid && order.status === "pending" && order.payment.method === "transfer" && bank.accountNumber;
  const n = itemCount(order);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          #invoice, #invoice * { visibility: visible; }
          #invoice { position: absolute; inset: 0 0 auto 0; width: 100%; }
          a[href]::after { content: none !important; }
        }
      `}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1 text-[13px] font-bold text-muted hover:text-ink">
          ← Back to {order.id}
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-muted sm:inline">Tip: turn off &quot;Headers and footers&quot; in the print dialog.</span>
          <PrintButton auto={sp.print === "1"} label="Print invoice" />
        </div>
      </div>

      <article id="invoice" className="rounded-2xl border border-line bg-white p-6 text-[13px] text-ink shadow-sm md:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex flex-col justify-between gap-6 border-b border-ink pb-6 sm:flex-row">
          <div>
            <p className="display text-[26px] font-extrabold uppercase tracking-[0.14em]">{settings.storeName}</p>
            <p className="mt-2 leading-relaxed text-ink-2">
              {settings.hubs[0] && (
                <>
                  {settings.hubs[0].address}, {settings.hubs[0].city}
                  <br />
                </>
              )}
              {settings.phone} · {settings.email}
              <br />
              WhatsApp +{settings.whatsapp}
            </p>
          </div>
          <div className="sm:text-right">
            <h1 className="display text-[28px]">Invoice</h1>
            <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 sm:justify-end">
              <dt className="text-muted">Invoice no.</dt>
              <dd className="font-bold">{order.id}</dd>
              <dt className="text-muted">Date</dt>
              <dd>{day(order.createdAt)}</dd>
              <dt className="text-muted">Payment</dt>
              <dd className={`font-bold ${paid ? "text-ok" : order.status === "pending" ? "text-[#b45309]" : ""}`}>{payState}</dd>
              <dt className="text-muted">Status</dt>
              <dd>{STATUS_LABEL[order.status]}</dd>
            </dl>
          </div>
        </header>

        {/* Parties */}
        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Bill to</h2>
            <p className="mt-1.5 font-bold">{order.customer.name}</p>
            <p className="text-ink-2">{order.customer.phone}</p>
            {order.customer.email && <p className="text-ink-2">{order.customer.email}</p>}
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{order.delivery === "pickup" ? "Pickup" : "Ship to"}</h2>
            {order.delivery === "pickup" ? (
              <>
                <p className="mt-1.5 font-bold">{order.pickupHub ? `${order.pickupHub} hub` : "Pickup"}</p>
                {settings.hubs
                  .filter((h) => h.city === order.pickupHub)
                  .map((h) => (
                    <p key={h.city} className="text-ink-2">
                      {h.address} · {h.hours}
                    </p>
                  ))}
              </>
            ) : (
              <address className="mt-1.5 not-italic leading-relaxed text-ink-2">
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
          </div>
        </section>

        {/* Lines */}
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink text-[11px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="w-8 py-2 pr-2 font-bold print:table-cell">
                <span className="sr-only">Packed</span>
              </th>
              <th scope="col" className="py-2 pr-3 font-bold">
                Item
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">
                Qty
              </th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-bold sm:table-cell print:table-cell">
                Unit price
              </th>
              <th scope="col" className="py-2 text-right font-bold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.productId} className="border-b border-line align-top" style={{ breakInside: "avoid" }}>
                <td className="py-3 pr-2">
                  <span aria-hidden className="mt-0.5 block h-3.5 w-3.5 rounded-[3px] border border-ink" />
                </td>
                <td className="py-3 pr-3">
                  <p className="font-bold">{l.name}</p>
                  <p className="text-[12px] text-muted">
                    {l.spec} · SKU {l.productId}
                  </p>
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">{l.qty}</td>
                <td className="hidden py-3 pr-3 text-right tabular-nums sm:table-cell print:table-cell">
                  {l.finalUnitPrice < l.unitPrice && <s className="mr-1 text-muted">{money(l.unitPrice)}</s>}
                  {money(l.finalUnitPrice)}
                </td>
                <td className="py-3 text-right font-bold tabular-nums">{money(l.finalUnitPrice * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end" style={{ breakInside: "avoid" }}>
          <dl className="w-full max-w-[300px] space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">
                Subtotal ({n} item{n === 1 ? "" : "s"})
              </dt>
              <dd className="tabular-nums">{money(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Discount{order.offerCode && <span className="ml-1 font-bold uppercase">({order.offerCode})</span>}</dt>
                <dd className="tabular-nums">−{money(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">{order.delivery === "pickup" ? "Pickup" : "Delivery"}</dt>
              <dd className="tabular-nums">{order.deliveryFee ? money(order.deliveryFee) : "Free"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-ink pt-2">
              <dt className="font-bold">Total</dt>
              <dd className="display text-[20px] tabular-nums">{money(order.total)}</dd>
            </div>
            {paid && (
              <div className="flex justify-between gap-4 text-ok">
                <dt>Paid{order.payment.paidAt && ` ${day(order.payment.paidAt)}`}</dt>
                <dd className="font-bold tabular-nums">{money(order.total)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Payment + escrow */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2" style={{ breakInside: "avoid" }}>
          <div className="rounded-xl border border-line p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Payment</h2>
            <p className="mt-1.5">
              <b>{PAYMENT_LABEL[order.payment.method]}</b> · {payState}
            </p>
            {order.payment.reference && <p className="break-all text-ink-2">Ref: {order.payment.reference}</p>}
            {showBank && (
              <p className="mt-2 leading-relaxed text-ink-2">
                Pay to <b className="text-ink">{bank.accountName}</b>
                <br />
                {bank.bankName} · <b className="text-ink">{bank.accountNumber}</b>
                <br />
                Use {order.id} as the narration.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-stage p-4 print:bg-white">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Escrow protection</h2>
            <p className="mt-1.5 leading-relaxed text-ink-2">
              Your payment is held by {settings.storeName} in escrow and only released to the seller after you confirm the item is as described. Nobody has to go first.
            </p>
          </div>
        </section>

        {order.customerNote && (
          <section className="mt-4 rounded-xl border border-line p-4" style={{ breakInside: "avoid" }}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Customer note</h2>
            <p className="mt-1.5 whitespace-pre-line break-words text-ink-2">{order.customerNote}</p>
          </section>
        )}

        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-line pt-4 text-[11px] text-muted sm:flex-row">
          <span>Thank you for shopping with {settings.storeName}. Trade with certainty.</span>
          <span>
            {order.id} · Packed by ________
          </span>
        </footer>
      </article>
    </div>
  );
}
