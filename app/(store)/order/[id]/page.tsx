import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommerceMotion } from "@/components/checkout/Motion";
import { Celebration, CopyButton, Countdown, PayNowButton } from "@/components/checkout/OrderClient";
import { OrderTracker } from "@/components/checkout/OrderTracker";
import { PAYMENT_LABEL } from "@/components/checkout/shared";
import { Icon, WhatsAppGlyph } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { formatNaira } from "@/lib/reference";
import { getCatalog, getStoreSettings } from "@/lib/data";
import { getOrderForCustomer, STATUS_LABEL } from "@/lib/orders";
import { paystackEnabled } from "@/lib/paystack";
import { waLink } from "@/lib/settings";
import type { Order, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default function OrderPage({ params, searchParams }: PageProps<"/order/[id]">) {
  return (
    <section className="wrap pb-24 pt-8">
      <CommerceMotion />
      <Suspense fallback={<OrderSkeleton />}>
        <OrderView params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

async function OrderView({ params, searchParams }: Pick<PageProps<"/order/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  if (!/^[A-Za-z0-9-]{3,30}$/.test(id) || !/^[a-f0-9]{16,64}$/i.test(token)) notFound();
  const [order, settings, catalog] = await Promise.all([getOrderForCustomer(id, token), getStoreSettings(), getCatalog()]);
  if (!order) notFound();
  // Illustration fallback for lines whose photo can't load.
  const art = new Map(catalog.map((p) => [p.id, { art: p.art, tint: p.tint }]));

  const payFailed = sp.pay === "failed";
  const pending = order.status === "pending";
  const firstName = order.customer.name.split(/\s+/)[0];
  const itemCount = order.lines.reduce((s, l) => s + l.qty, 0);
  const help = waLink(settings.whatsapp, `Hi JDHub, I have a question about order ${order.id}.`);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="jdc-in-up flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Celebration orderId={order.id} />
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-muted">
            Order {order.id} · {fmtDate(order.createdAt)}
          </p>
          <h1 className="display mt-1 text-[28px] md:text-[40px]">
            {order.status === "cancelled"
              ? "Order cancelled."
              : order.status === "refunded"
                ? "Order refunded."
                : pending
                  ? `Thank you, ${firstName}. Your items are reserved.`
                  : order.status === "completed"
                    ? "All done. Enjoy it."
                    : `Thank you, ${firstName}. ${STATUS_LABEL[order.status]}.`}
          </h1>
        </div>
      </div>

      {payFailed && pending && (
        <p role="alert" className="jdc-shake mt-6 flex items-start gap-2 rounded-xl bg-sale/10 p-4 text-[14px] font-bold text-sale">
          <Icon name="alert" size={20} className="shrink-0" /> The payment didn&apos;t go through. Your items are still reserved; try again below
          or choose another way to pay.
        </p>
      )}

      {/* Progress */}
      <div className="jdc-in-up mt-8 rounded-tile border border-line p-5 sm:p-8" style={{ animationDelay: "80ms" }}>
        <h2 className="sr-only">Order progress</h2>
        <OrderTracker status={order.status} delivery={order.delivery} history={order.history} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {pending && <PaymentCard order={order} settings={settings} />}

          {/* Items */}
          <section className="jdc-in-up rounded-tile border border-line p-5 sm:p-6" style={{ animationDelay: "160ms" }} aria-labelledby="items-h">
            <h2 id="items-h" className="text-[18px] font-bold">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {order.lines.map((l, i) => (
                <li key={l.productId} className="jdc-in-right flex items-center gap-4 py-4" style={{ animationDelay: `${240 + i * 70}ms` }}>
                  <Link href={`/product/${l.productId}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stage">
                    <ProductImage item={{
                        photo: l.photo,
                        imageUrl: l.imageUrl,
                        art: art.get(l.productId)?.art ?? "phone",
                        tint: art.get(l.productId)?.tint ?? "#cfcfcf",
                        name: l.name,
                      }} width={250} className="h-20 w-20" artClassName="h-16 w-16" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${l.productId}`} className="line-clamp-1 text-[15px] font-bold hover:underline">
                      {l.name}
                    </Link>
                    <p className="line-clamp-1 text-[12px] text-muted">{l.spec}</p>
                    <p className="mt-1 text-[13px] text-ink-2">Qty {l.qty}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold">{formatNaira(l.finalUnitPrice * l.qty)}</p>
                    {l.finalUnitPrice < l.unitPrice && <p className="text-[12px] text-muted line-through">{formatNaira(l.unitPrice * l.qty)}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-2 border-t border-line pt-4 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="font-bold">{formatNaira(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Offer{order.offerCode ? ` · ${order.offerCode.toUpperCase()}` : ""}</dt>
                  <dd className="font-bold text-accent">−{formatNaira(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">{order.delivery === "pickup" ? "Hub pickup" : "Delivery"}</dt>
                <dd className="font-bold">{order.deliveryFee ? formatNaira(order.deliveryFee) : "Free"}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-bold">Total</dt>
                <dd className="display text-[24px]">{formatNaira(order.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="jdc-in-up rounded-tile bg-stage p-5 sm:p-6" style={{ animationDelay: "200ms" }} aria-labelledby="del-h">
            <h2 id="del-h" className="flex items-center gap-2 text-[16px] font-bold">
              <Icon name={order.delivery === "pickup" ? "store" : "truck"} size={20} />
              {order.delivery === "pickup" ? "Hub pickup" : "Delivery"}
            </h2>
            <div className="mt-3 text-[14px] leading-relaxed text-ink-2">
              <p className="font-bold text-ink">{order.customer.name}</p>
              <p>{order.customer.phone}</p>
              {order.delivery === "pickup" ? (
                <HubAddress settings={settings} city={order.pickupHub} />
              ) : (
                <p className="mt-2">
                  {order.customer.address}
                  <br />
                  {[order.customer.city, order.customer.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            {order.customerNote && (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2">
                <span className="font-bold text-ink">Note:</span> {order.customerNote}
              </p>
            )}
            <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2">
              <span className="font-bold text-ink">Payment:</span> {PAYMENT_LABEL[order.payment.method]}
              {order.payment.paidAt && ` · paid ${fmtDate(order.payment.paidAt)}`}
            </p>
          </section>

          <section className="jdc-in-up rounded-tile bg-ink p-5 text-white sm:p-6" style={{ animationDelay: "260ms" }} aria-labelledby="esc-h">
            <h2 id="esc-h" className="flex items-center gap-2 text-[16px] font-bold">
              <Icon name="shield" size={20} /> How escrow protects you
            </h2>
            <ol className="mt-4 space-y-3 text-[13px] text-white/80">
              {[
                "You pay JDHub, not the seller. The money is held safely.",
                "We inspect, pack and ship (or hold it at the hub for you).",
                "You get 7 days to check it matches its grade.",
                "Only then is the seller paid. Not as described? Full refund.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-bold text-white">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </section>

          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className="jdc-in-up flex items-center gap-3 rounded-tile border border-line p-5 transition-colors hover:border-ink"
            style={{ animationDelay: "320ms" }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-wa text-white">
              <WhatsAppGlyph size={22} />
            </span>
            <span className="flex-1 text-[14px]">
              <span className="block font-bold">Questions about this order?</span>
              <span className="text-muted">Chat with us on WhatsApp</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </a>
          <p className="px-1 text-[12px] text-muted">
            Bookmark this page to check on your order, or find it any time at{" "}
            <Link href="/track" className="underline underline-offset-2">
              Track order
            </Link>{" "}
            with your order number and phone.
          </p>
        </aside>
      </div>
    </div>
  );
}

function HubAddress({ settings, city }: { settings: Settings; city?: string }) {
  const hub = settings.hubs.find((h) => h.city === city);
  return (
    <p className="mt-2">
      <span className="font-bold text-ink">JDHub {city}</span>
      {hub && (
        <>
          <br />
          {hub.address}
          <br />
          <span className="text-muted">{hub.hours}</span>
        </>
      )}
    </p>
  );
}

function PaymentCard({ order, settings }: { order: Order; settings: Settings }) {
  const method = order.payment.method;
  const total = formatNaira(order.total);
  const wa = waLink(settings.whatsapp, `Hi JDHub, I just placed order ${order.id} for ${total}. I'd like to pay via WhatsApp.`);
  const bank = settings.bank;
  const hasBank = !!(bank.accountNumber && bank.bankName);
  const paystack = method === "paystack" && paystackEnabled();

  return (
    <section className="jdc-in-up overflow-hidden rounded-tile border-2 border-ink" style={{ animationDelay: "120ms" }} aria-labelledby="pay-h">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white sm:px-6">
        <h2 id="pay-h" className="text-[18px] font-bold">
          Complete your payment
        </h2>
        <span className="display text-[22px]">{total}</span>
      </div>
      <div className="p-5 sm:p-6">
        {order.reservedUntil && (
          <p className="flex items-start gap-2 rounded-xl bg-stage p-3 text-[14px]">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <Countdown until={order.reservedUntil} />
          </p>
        )}

        {paystack && (
          <div className="mt-5">
            <p className="text-[14px] text-ink-2">Pay securely by card, bank transfer or USSD on Paystack. We confirm it instantly.</p>
            <div className="mt-4">
              <PayNowButton id={order.id} token={order.token} total={total} />
            </div>
          </div>
        )}

        {(method === "transfer" || (method === "paystack" && !paystack)) && (
          <div className="mt-5">
            {hasBank ? (
              <>
                <p className="text-[14px] text-ink-2">
                  Transfer exactly <span className="font-bold text-ink">{total}</span> to JDHub&apos;s escrow account. Use your order number as the
                  reference so we can match it.
                </p>
                <dl className="mt-4 divide-y divide-line rounded-xl border border-line text-[14px]">
                  {[
                    ["Bank", bank.bankName, false],
                    ["Account name", bank.accountName, false],
                    ["Account number", bank.accountNumber, true],
                    ["Amount", String(order.total), true],
                    ["Reference", order.id, true],
                  ].map(([k, v, copy]) => (
                    <div key={k as string} className="flex items-center justify-between gap-3 px-4 py-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="flex min-w-0 items-center gap-2 text-right font-bold">
                        <span className="truncate">{k === "Amount" ? total : (v as string)}</span>
                        {copy && <CopyButton value={v as string} label={(k as string).toLowerCase()} />}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[13px] text-ink-2">Sent it? Share the receipt on WhatsApp and we&apos;ll confirm within minutes.</p>
              </>
            ) : (
              <p className="text-[14px] text-ink-2">
                Our team will send JDHub&apos;s escrow account details on WhatsApp. Use <span className="font-bold text-ink">{order.id}</span> as the
                transfer reference.
              </p>
            )}
          </div>
        )}

        {method === "whatsapp" && (
          <p className="mt-5 text-[14px] text-ink-2">
            Tap below to open WhatsApp with your order details. Our team will confirm payment options and delivery with you.
          </p>
        )}

        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-lg mt-5 w-full sm:w-auto ${method === "whatsapp" || (!paystack && !hasBank) ? "btn-primary" : "btn-outline"}`}
        >
          <WhatsAppGlyph size={20} /> {method === "whatsapp" ? "Pay via WhatsApp" : "Send receipt on WhatsApp"}
        </a>
      </div>
    </section>
  );
}

function OrderSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-label="Loading order">
      <div className="flex items-center gap-5">
        <div className="jdc-skeleton h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="jdc-skeleton h-4 w-48 rounded" />
          <div className="jdc-skeleton h-9 w-3/4 rounded" />
        </div>
      </div>
      <div className="jdc-skeleton mt-8 h-36 rounded-tile" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="jdc-skeleton h-80 rounded-tile" />
        <div className="jdc-skeleton h-80 rounded-tile" />
      </div>
    </div>
  );
}
