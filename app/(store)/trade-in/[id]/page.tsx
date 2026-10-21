import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requestNow } from "@/components/admin/orders/server";
import { CommerceMotion } from "@/components/checkout/Motion";
import { CopyButton } from "@/components/checkout/OrderClient";
import { Icon, WhatsAppGlyph } from "@/components/Icon";
import { OfferResponse } from "@/components/tradein/OfferResponse";
import { getStoreSettings } from "@/lib/data";
import { formatNaira, gradeName } from "@/lib/reference";
import { waLink } from "@/lib/settings";
import { getLeadForCustomer } from "@/lib/tradein";
import { checklistRows, deviceOf, estimateLockedUntil, estimateOf, fmtSlot, PAYOUT_LABEL, STAGE_LABEL } from "@/lib/tradein-flow";
import type { Lead, LeadStatus, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Your trade-in", robots: { index: false, follow: false } };

export default function TradeInPage({ params, searchParams }: PageProps<"/trade-in/[id]">) {
  return (
    <section className="wrap pb-24 pt-8">
      <CommerceMotion />
      <Suspense fallback={<TradeInSkeleton />}>
        <TradeInView params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** Customer-facing progress steps. */
const STEPS: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Requested" },
  { key: "inspection_booked", label: "Inspection booked" },
  { key: "inspected", label: "Inspected" },
  { key: "offer_sent", label: "Final offer" },
  { key: "accepted", label: "Accepted" },
  { key: "paid", label: "Paid" },
];
const STEP_INDEX: Partial<Record<LeadStatus, number>> = { new: 0, contacted: 0, inspection_booked: 1, inspected: 2, offer_sent: 3, declined: 3, accepted: 4, paid: 5, closed: 5 };

const HEADLINE: Record<LeadStatus, string> = {
  new: "We've got your request.",
  contacted: "We're in touch about your trade-in.",
  inspection_booked: "Your inspection is booked.",
  inspected: "Inspection done. Your offer is on its way.",
  offer_sent: "Your final offer is ready.",
  accepted: "Offer accepted.",
  declined: "Offer declined.",
  paid: "You've been paid.",
  closed: "This trade-in is complete.",
  cancelled: "This trade-in was cancelled.",
};

async function TradeInView({ params, searchParams }: Pick<PageProps<"/trade-in/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const [lead, settings] = await Promise.all([getLeadForCustomer(decodeURIComponent(id), token), getStoreSettings()]);
  if (!lead) notFound();
  const now = await requestNow();

  const t = lead.trade ?? {};
  const device = deviceOf(lead) || (lead.type === "swap" ? "Swap request" : "Your device");
  const estimate = estimateOf(lead);
  const lockUntil = estimateLockedUntil(lead);
  const lockExpired = Date.parse(lockUntil) <= now;
  const finalOffer = t.inspection?.finalOffer;
  const showOffer = !!t.inspection && ["offer_sent", "accepted", "declined", "paid", "closed"].includes(lead.status);
  const help = waLink(settings.whatsapp, `Hi ${settings.storeName}, I have a question about my trade-in ${lead.id} (${device}).`);
  const step = STEP_INDEX[lead.status];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="jdc-in-up">
        <p className="text-[14px] font-bold text-muted">
          {lead.type === "swap" ? "Swap" : "Sell"} request {lead.id} · {fmtDate(lead.createdAt)}
        </p>
        <h1 className="display mt-1 text-[28px] md:text-[40px]">{HEADLINE[lead.status]}</h1>
        <p className="mt-2 text-[16px] text-ink-2">{device}</p>
      </div>

      <div className="jdc-in-up mt-8 rounded-tile border border-line p-5 sm:p-8" style={{ animationDelay: "80ms" }}>
        <h2 className="sr-only">Progress</h2>
        {lead.status === "cancelled" || step === undefined ? (
          <p className="flex items-start gap-2 text-[15px]">
            <Icon name="info" size={20} className="mt-0.5 shrink-0" />
            <span>
              This trade-in was cancelled{t.closeReason ? `: ${t.closeReason}` : "."} Questions? Message us on WhatsApp.
            </span>
          </p>
        ) : (
          <ol className="grid grid-cols-6 gap-1" aria-label="Trade-in progress">
            {STEPS.map((s, i) => {
              const done = i <= step;
              return (
                <li key={s.key} className="min-w-0" aria-current={i === step ? "step" : undefined}>
                  <div className={`h-1.5 rounded-full ${done ? "bg-ink" : "bg-line"}`} />
                  <p className={`mt-2 text-[11px] font-bold leading-tight sm:text-[13px] ${done ? "text-ink" : "text-muted"}`}>
                    {i === 3 && lead.status === "declined" ? "Declined" : s.label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {showOffer && finalOffer !== undefined && (
            <section className="jdc-in-up overflow-hidden rounded-tile border-2 border-ink" style={{ animationDelay: "120ms" }} aria-labelledby="offer-h">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-4 text-white sm:px-6">
                <h2 id="offer-h" className="text-[18px] font-bold">
                  Final offer
                </h2>
                <span className="display text-[26px]">{formatNaira(finalOffer)}</span>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                {estimate && (
                  <p className="text-[14px] text-ink-2">
                    Instant estimate was <b className="text-ink">{formatNaira(estimate)}</b>.{" "}
                    {finalOffer < estimate ? "The difference comes from what we found at inspection, below." : finalOffer > estimate ? "Good news: it came in above the estimate." : "It matches your estimate."}
                  </p>
                )}
                <Findings lead={lead} />
                {lead.status === "offer_sent" && (
                  <div className="border-t border-line pt-5">
                    <p className="mb-3 text-[14px] text-ink-2">Happy with it? Accept and we&apos;ll {lead.type === "swap" ? "issue your swap credit or pay you" : "pay you within 48 hours"}.</p>
                    <OfferResponse id={lead.id} token={token} type={lead.type} amount={formatNaira(finalOffer)} />
                  </div>
                )}
                {lead.status === "declined" && (
                  <p className="rounded-xl bg-stage p-4 text-[14px] text-ink-2">You declined this offer. Changed your mind? Message us and we can revisit it.</p>
                )}
              </div>
            </section>
          )}

          {t.credit && <CreditCard credit={t.credit} redeemed={!!t.credit.redeemedAt} />}

          {t.payout ? (
            <section className="jdc-in-up rounded-tile border border-line p-5 sm:p-6" aria-labelledby="paid-h">
              <h2 id="paid-h" className="flex items-center gap-2 text-[18px] font-bold">
                <Icon name="wallet" size={20} /> Payment
              </h2>
              <dl className="mt-4 divide-y divide-line rounded-xl border border-line text-[14px]">
                <Row label="Amount" value={formatNaira(t.payout.amount)} />
                <Row label="Method" value={PAYOUT_LABEL[t.payout.method]} />
                {t.payout.bank && <Row label="To" value={`${t.payout.bank.bankName} · ${t.payout.bank.accountMasked}`} />}
                {t.payout.reference && <Row label="Reference" value={t.payout.reference} />}
                <Row label="Paid" value={fmtDate(t.payout.paidAt)} />
              </dl>
            </section>
          ) : (
            lead.status === "accepted" &&
            t.payoutChoice && (
              <section className="jdc-in-up rounded-tile border border-line p-5 sm:p-6" aria-labelledby="payout-h">
                <h2 id="payout-h" className="flex items-center gap-2 text-[18px] font-bold">
                  <Icon name="wallet" size={20} /> Payout
                </h2>
                <p className="mt-2 text-[14px] text-ink-2">
                  {t.payoutChoice.method === "swap_credit"
                    ? "Your swap credit is ready. Use it at checkout on your next device."
                    : t.payoutChoice.bank
                      ? `We'll transfer ${formatNaira(finalOffer ?? 0)} to ${t.payoutChoice.bank.bankName} ${t.payoutChoice.bank.accountMasked} (${t.payoutChoice.bank.accountName}) within 48 hours.`
                      : `We'll pay you ${formatNaira(finalOffer ?? 0)} by ${PAYOUT_LABEL[t.payoutChoice.method].toLowerCase()}.`}
                </p>
              </section>
            )
          )}

          <section className="jdc-in-up rounded-tile border border-line p-5 sm:p-6" style={{ animationDelay: "160ms" }} aria-labelledby="tl-h">
            <h2 id="tl-h" className="text-[18px] font-bold">
              Timeline
            </h2>
            <Timeline lead={lead} />
          </section>
        </div>

        <aside className="space-y-6">
          {estimate && (
            <section className="jdc-in-up rounded-tile bg-ink p-5 text-white sm:p-6" style={{ animationDelay: "200ms" }} aria-labelledby="est-h">
              <h2 id="est-h" className="text-[14px] font-bold text-white/70">
                Instant estimate
              </h2>
              <p className="display mt-1 text-[32px]">{formatNaira(estimate)}</p>
              <p className="mt-2 flex items-start gap-2 text-[13px] text-white/80">
                <Icon name={lockExpired ? "info" : "check"} size={18} className="shrink-0" />
                {lockExpired ? `Estimate lock ended ${fmtDay(lockUntil)}. Your final offer is set at inspection.` : `Locked until ${fmtDate(lockUntil)}. Book your inspection before then to keep it.`}
              </p>
            </section>
          )}

          <BookingCard lead={lead} settings={settings} />

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
              <span className="block font-bold">Questions about your trade-in?</span>
              <span className="text-muted">Chat with us on WhatsApp</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </a>
          <p className="px-1 text-[12px] text-muted">Bookmark this page: it updates as your trade-in moves along. Keep the link private.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-bold">{value}</dd>
    </div>
  );
}

function Findings({ lead }: { lead: Lead }) {
  const insp = lead.trade?.inspection;
  if (!insp) return null;
  return (
    <div>
      <h3 className="text-[15px] font-bold">Inspection findings</h3>
      <p className="mt-1 text-[13px] text-muted">
        Graded <b className="text-ink">{gradeName(insp.grade)}</b> on {fmtDate(insp.inspectedAt)}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {checklistRows(insp.checklist).map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-stage px-3 py-2.5 text-[13px]">
            <span className="text-ink-2">{r.label}</span>
            <span className={`flex items-center gap-1 font-bold ${r.good ? "text-ok" : "text-sale"}`}>
              <Icon name={r.good ? "check" : "alert"} size={14} /> {r.value}
            </span>
          </li>
        ))}
      </ul>
      {insp.notes && <p className="mt-3 whitespace-pre-line break-words rounded-xl border border-line p-3 text-[13px] text-ink-2">{insp.notes}</p>}
    </div>
  );
}

function BookingCard({ lead, settings }: { lead: Lead; settings: Settings }) {
  const b = lead.trade?.booking;
  const hub = b?.hub ? settings.hubs.find((h) => h.city === b.hub) : undefined;
  return (
    <section className="jdc-in-up rounded-tile bg-stage p-5 sm:p-6" style={{ animationDelay: "260ms" }} aria-labelledby="book-h">
      <h2 id="book-h" className="flex items-center gap-2 text-[16px] font-bold">
        <Icon name={b?.method === "dropoff" ? "store" : "truck"} size={20} /> Inspection
      </h2>
      {b ? (
        <div className="mt-3 space-y-1 text-[14px] leading-relaxed text-ink-2">
          <p className="text-[16px] font-bold text-ink">{fmtSlot(b.at)}</p>
          {b.method === "pickup" ? (
            <p>
              Free pickup at <span className="text-ink">{b.address}</span>
            </p>
          ) : (
            <p>
              Drop-off at <span className="font-bold text-ink">JDHub {b.hub}</span>
              {hub && (
                <>
                  <br />
                  {hub.address}
                  <br />
                  <span className="text-muted">{hub.hours}</span>
                </>
              )}
            </p>
          )}
          {b.staff && <p>Inspector: {b.staff}</p>}
          <p className="pt-2 text-[12px] text-muted">Bring it charged, with your passcode, and signed out of iCloud / Google.</p>
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-ink-2">Not booked yet. We&apos;ll call or WhatsApp you to arrange a free pickup or a drop-off at a hub.</p>
      )}
    </section>
  );
}

function CreditCard({ credit, redeemed }: { credit: NonNullable<NonNullable<Lead["trade"]>["credit"]>; redeemed: boolean }) {
  const link = `/o/${credit.code}`;
  return (
    <section className="jdc-in-up rounded-tile bg-ink p-5 text-white sm:p-6" aria-labelledby="credit-h">
      <h2 id="credit-h" className="flex items-center gap-2 text-[18px] font-bold">
        <Icon name="gift" size={20} /> Your swap credit
      </h2>
      <p className="display mt-2 text-[32px]">{formatNaira(credit.amount)}</p>
      {redeemed ? (
        <p className="mt-2 text-[14px] text-white/80">Used{credit.orderId ? ` on order ${credit.orderId}` : ""}. Enjoy your new device.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-ink">
            <span className="font-mono text-[18px] font-bold tracking-wider">{credit.code.toUpperCase()}</span>
            <CopyButton value={credit.code.toUpperCase()} label="swap credit code" />
          </div>
          <p className="mt-3 text-[13px] text-white/75">One use, valid until {fmtDay(credit.expiresAt)}. The credit comes off your next device at checkout.</p>
          <Link href={link} className="btn btn-white mt-4 w-full sm:w-auto">
            Shop with my credit <Icon name="arrowRight" size={16} />
          </Link>
        </>
      )}
    </section>
  );
}

function Timeline({ lead }: { lead: Lead }) {
  // Only status changes are shown to the customer; staff notes and message logs stay internal.
  const events = (lead.history ?? []).filter((e) => (e.kind ?? "status") === "status").reverse();
  if (!events.length) {
    return <p className="mt-3 text-[14px] text-ink-2">Request received {fmtDate(lead.createdAt)}.</p>;
  }
  return (
    <ol className="relative mt-4 space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-4">
          <span aria-hidden className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${i === 0 ? "bg-ink" : "bg-line"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[14px] font-bold">{e.from === e.to && e.to === "new" ? "Request received" : STAGE_LABEL[e.to]}</p>
              <time dateTime={e.at} className="text-[12px] text-muted">
                {fmtDate(e.at)}
              </time>
            </div>
            {e.note && <p className="mt-1 break-words text-[13px] text-ink-2">{e.note}</p>}
            <p className="mt-0.5 text-[12px] text-muted">{e.by === "customer" ? "You" : "JDHub"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TradeInSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-label="Loading your trade-in">
      <div className="space-y-3">
        <div className="jdc-skeleton h-4 w-48 rounded" />
        <div className="jdc-skeleton h-9 w-3/4 rounded" />
      </div>
      <div className="jdc-skeleton mt-8 h-24 rounded-tile" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="jdc-skeleton h-80 rounded-tile" />
        <div className="jdc-skeleton h-80 rounded-tile" />
      </div>
    </div>
  );
}
