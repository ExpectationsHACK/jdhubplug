import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { customerWaLink, humanizeKey, LEAD_TYPE_LABEL, money, telHref } from "@/components/admin/orders/format";
import { LeadActions } from "@/components/admin/orders/LeadActions";
import { IconLink, WaGlyph } from "@/components/admin/orders/parts";
import { requestNow, siteOrigin } from "@/components/admin/orders/server";
import { CopyLinkButton } from "@/components/admin/orders/Widgets";
import { LeadNoteForm, ResendButtons, TradeInActions } from "@/components/admin/requests/TradeInActions";
import { STAGE_TONE } from "@/components/admin/requests/tones";
import { AdminPage, Badge, Card, fmtDate, PageHeader, relTime } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { gradeName, grades } from "@/lib/reference";
import { getLead, getSettings, listStaff } from "@/lib/store";
import { ensureLeadToken, getPayoutAccount, LEAD_ID_RE, syncCreditRedemptions } from "@/lib/tradein";
import {
  allowedNext,
  checklistRows,
  deviceOf,
  estimateLockedUntil,
  estimateOf,
  fmtSlot,
  isTradeIn,
  normalizeStatus,
  PAYOUT_LABEL,
  STAGE_LABEL,
  statusPath,
} from "@/lib/tradein-flow";
import type { Lead, LeadEvent, LeadStatus } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/admin/requests/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Request ${decodeURIComponent(id).slice(0, 24)}` };
}

const STEPS: LeadStatus[] = ["new", "contacted", "inspection_booked", "inspected", "offer_sent", "accepted", "paid", "closed"];

/** WhatsApp opener for the lead's current stage, with their status link. */
function waText(l: Lead, store: string, link: string) {
  const name = l.name.split(/\s+/)[0] || "there";
  const device = deviceOf(l) || "device";
  const t = l.trade ?? {};
  const hi = `Hi ${name}, this is ${store} about your ${l.type === "swap" ? "swap" : "sell"} request for your ${device}.`;
  const body: Partial<Record<LeadStatus, string>> = {
    new: "When is a good time to inspect it? We can pick it up or you can drop it at a hub.",
    contacted: "Shall we book your free inspection?",
    inspection_booked: t.booking ? `Your inspection is booked for ${fmtSlot(t.booking.at)}.` : "",
    inspected: "We've finished the inspection; your final offer is coming shortly.",
    offer_sent: t.inspection ? `Our final offer is ${money(t.inspection.finalOffer)}. You can accept or decline here:` : "",
    accepted: t.credit ? `Your swap credit code is ${t.credit.code.toUpperCase()}.` : "Thanks for accepting. We're processing your payment.",
    paid: t.payout ? `We've paid ${money(t.payout.amount)}${t.payout.reference ? ` (ref ${t.payout.reference})` : ""}.` : "",
  };
  return `${hi} ${body[l.status] ?? ""}\n\nYour trade-in status: ${link}`;
}

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const session = await requireAdmin();
  const id = decodeURIComponent((await params).id);
  if (!LEAD_ID_RE.test(id)) notFound();

  let lead = await ensureLeadToken(id);
  if (!lead) notFound();
  if (isTradeIn(lead) && (await syncCreditRedemptions([lead]))) lead = (await getLead(id)) ?? lead;
  lead = { ...lead, status: normalizeStatus(lead) };

  const canWrite = can(session.role, "leads:write");
  const [settings, staff, now, origin, account] = await Promise.all([
    getSettings(),
    listStaff(),
    requestNow(),
    siteOrigin(),
    canWrite && (lead.trade?.payoutChoice?.bank || lead.trade?.payout?.bank) ? getPayoutAccount(lead.id) : Promise.resolve(null),
  ]);

  const trade = isTradeIn(lead);
  const t = lead.trade ?? {};
  const path = trade ? statusPath(lead) : "";
  const wa = customerWaLink(lead.phone, trade ? waText(lead, settings.storeName, origin + path) : `Hi ${lead.name.split(/\s+/)[0] || "there"}, this is ${settings.storeName}, replying to your message.`);
  const estimate = estimateOf(lead);
  const device = deviceOf(lead);
  const details = Object.entries(lead.details ?? {}).filter(([, v]) => v);
  const detailGrade = grades.find((g) => g.name === lead.details?.grade || g.name === lead.details?.tradeInGrade)?.id;
  const lock = estimateLockedUntil(lead);
  const hub = t.booking?.hub ? settings.hubs.find((h) => h.city === t.booking!.hub) : undefined;

  return (
    <AdminPage>
      <PageHeader
        back={{ href: trade ? "/admin/requests" : "/admin/requests?view=other", label: "Requests" }}
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={lead.type === "swap" ? "purple" : lead.type === "sell" ? "green" : "neutral"}>{LEAD_TYPE_LABEL[lead.type]}</Badge>
            <Badge tone={STAGE_TONE[lead.status]}>{STAGE_LABEL[lead.status]}</Badge>
            <span>
              {device && <>{device} · </>}
              <time dateTime={lead.createdAt}>{fmtDate(lead.createdAt)}</time>
            </span>
          </span>
        }
        actions={
          trade ? (
            <>
              <CopyLinkButton path={path} label="Copy status link" />
              <Link href={path} target="_blank" className="btn btn-outline">
                Open status page
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {trade ? (
            <Card>
              {lead.status === "cancelled" || lead.status === "declined" ? (
                <div className="rounded-xl bg-stage p-4 text-[14px]">
                  <p className="font-bold">{STAGE_LABEL[lead.status]}</p>
                  <p className="text-ink-2">{lead.status === "declined" ? (t.response?.reason ?? "The customer declined the offer.") : (t.closeReason ?? "")}</p>
                </div>
              ) : (
                <Stepper status={lead.status} history={lead.history ?? []} />
              )}
              <div className="mt-5 border-t border-line pt-5">
                <p className="mb-3 text-[13px] font-bold text-muted">Next step</p>
                {canWrite ? (
                  <TradeInActions
                    id={lead.id}
                    type={lead.type}
                    status={lead.status}
                    allowed={allowedNext(lead)}
                    hubs={settings.hubs}
                    staffNames={[...new Set([session.name, ...staff.filter((u) => u.active).map((u) => u.name)])]}
                    estimate={estimate}
                    finalOffer={t.inspection?.finalOffer}
                    gradeId={t.inspection?.grade ?? detailGrade}
                    booking={t.booking}
                    pickupHint={lead.message.slice(0, 300) || undefined}
                    payoutChoice={t.payoutChoice ? { method: t.payoutChoice.method, hasBank: !!t.payoutChoice.bank } : undefined}
                    sent={{ inspection_booked: !!t.booking, offer_sent: !!t.offerSentAt, paid: !!t.payout, credit: !!t.credit }}
                  />
                ) : (
                  <p className="text-[14px] text-muted">Your role can view this request but not change it.</p>
                )}
              </div>
            </Card>
          ) : (
            <Card title="Status">
              <LeadActions id={lead.id} name={lead.name} status={lead.status} canWrite={canWrite} />
            </Card>
          )}

          {t.inspection && (
            <Card title="Inspection findings" actions={<span className="text-[13px] text-muted">by {t.inspection.inspectedBy} · {relTime(t.inspection.inspectedAt, now)}</span>}>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p>
                  <span className="text-[13px] text-muted">Grade </span>
                  <b>{gradeName(t.inspection.grade)}</b>
                  {lead.details?.grade && lead.details.grade !== gradeName(t.inspection.grade) && <span className="text-[13px] text-muted"> (customer said {lead.details.grade})</span>}
                </p>
                <p>
                  <span className="text-[13px] text-muted">Final offer </span>
                  <b className="display text-[20px]">{money(t.inspection.finalOffer)}</b>
                  {estimate && <Delta final={t.inspection.finalOffer} estimate={estimate} />}
                </p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checklistRows(t.inspection.checklist).map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-2 rounded-xl bg-stage px-3 py-2 text-[13px]">
                    <span className="text-ink-2">{r.label}</span>
                    <span className={`font-bold ${r.good ? "text-ok" : "text-sale"}`}>{r.value}</span>
                  </li>
                ))}
              </ul>
              {t.inspection.notes && <p className="mt-3 whitespace-pre-line break-words rounded-xl border border-line p-3 text-[13px] text-ink-2">{t.inspection.notes}</p>}
            </Card>
          )}

          <Card title="Timeline">
            {canWrite && (
              <div className="mb-6 space-y-4">
                <LeadNoteForm id={lead.id} />
                {trade && <ResendButtons id={lead.id} sent={{ inspection_booked: !!t.booking, offer_sent: !!t.offerSentAt, paid: !!t.payout, credit: !!t.credit }} />}
              </div>
            )}
            <Timeline lead={lead} now={now} />
          </Card>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Request details">
          <Card title="Customer">
            <p className="font-bold">{lead.name}</p>
            <p className="mt-0.5 text-[14px] text-ink-2">{lead.phone}</p>
            {lead.email && <p className="truncate text-[14px] text-ink-2">{lead.email}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <IconLink href={telHref(lead.phone)} label={`Call ${lead.name}`} kind="phone" />
              {lead.email && <IconLink href={`mailto:${lead.email}`} label={`Email ${lead.name}`} kind="mail" />}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn min-h-9 flex-1 bg-wa px-4 py-2 text-white hover:brightness-95">
                  <WaGlyph /> WhatsApp
                </a>
              )}
            </div>
            {wa && trade && <p className="mt-2 text-[12px] text-muted">Prefilled with a {STAGE_LABEL[lead.status].toLowerCase()} update and their status link.</p>}
          </Card>

          <Card title="Request">
            {lead.message && <p className="mb-4 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-2">{lead.message}</p>}
            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-stage p-4 text-[13px]">
                {details.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{humanizeKey(k)}</dt>
                    <dd className="mt-0.5 break-words font-bold">{k === "estimate" || k === "tradeInValue" || k === "topUp" ? money(Number(v) || 0) : v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {trade && estimate && (
              <p className="mt-3 text-[13px] text-ink-2">
                Estimate {money(estimate)} locked until <b>{fmtDate(lock)}</b>
                {Date.parse(lock) <= now && <span className="font-bold text-sale"> (expired)</span>}
              </p>
            )}
          </Card>

          {t.booking && (
            <Card title="Inspection booking">
              <p className="font-bold">{fmtSlot(t.booking.at)}</p>
              <p className="mt-1 text-[14px] text-ink-2">
                {t.booking.method === "pickup" ? (
                  <>Pickup at {t.booking.address}</>
                ) : (
                  <>
                    Drop-off at {t.booking.hub} hub{hub && <span className="block text-[13px] text-muted">{hub.address}</span>}
                  </>
                )}
              </p>
              {t.booking.staff && <p className="mt-1 text-[13px] text-muted">Inspector: {t.booking.staff}</p>}
            </Card>
          )}

          {(t.payoutChoice || t.payout) && (
            <Card title="Payout">
              <dl className="space-y-2 text-[14px]">
                <Row label="Method" value={PAYOUT_LABEL[(t.payout ?? t.payoutChoice)!.method]} />
                {t.payout && <Row label="Amount" value={<b>{money(t.payout.amount)}</b>} />}
                {(t.payout?.bank ?? t.payoutChoice?.bank) && (
                  <>
                    <Row label="Bank" value={(t.payout?.bank ?? t.payoutChoice?.bank)!.bankName} />
                    <Row label="Account name" value={(t.payout?.bank ?? t.payoutChoice?.bank)!.accountName} />
                    <Row
                      label="Account no."
                      value={<span className="font-mono">{account?.accountNumber ?? (t.payout?.bank ?? t.payoutChoice?.bank)!.accountMasked}</span>}
                    />
                  </>
                )}
                {t.payout?.reference && <Row label="Reference" value={<span className="break-all font-mono text-[12px]">{t.payout.reference}</span>} />}
                {t.payout && <Row label="Paid" value={`${fmtDate(t.payout.paidAt)} · ${t.payout.paidBy}`} />}
                {!t.payout && <p className="text-[13px] font-bold text-[#b45309]">Not paid yet</p>}
              </dl>
            </Card>
          )}

          {t.credit && (
            <Card title="Swap credit">
              <p className="font-mono text-[18px] font-bold tracking-wider">{t.credit.code.toUpperCase()}</p>
              <dl className="mt-3 space-y-2 text-[14px]">
                <Row label="Amount" value={money(t.credit.amount)} />
                <Row label="Expires" value={fmtDate(t.credit.expiresAt)} />
                <Row
                  label="Status"
                  value={
                    t.credit.redeemedAt ? (
                      <Link href={`/admin/orders/${t.credit.orderId}`} className="font-bold text-ok hover:underline">
                        Used on {t.credit.orderId}
                      </Link>
                    ) : Date.parse(t.credit.expiresAt) <= now ? (
                      <span className="font-bold text-sale">Expired</span>
                    ) : (
                      <span className="font-bold text-[#b45309]">Not used yet</span>
                    )
                  }
                />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyLinkButton path={`/o/${t.credit.code}`} label="Copy shop link" className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" />
                <Link href={`/admin/offers/${t.credit.code}`} className="btn btn-outline min-h-9 px-4 py-2 text-[13px]">
                  View offer
                </Link>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </AdminPage>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words text-right">{value}</dd>
    </div>
  );
}

function Delta({ final, estimate }: { final: number; estimate: number }) {
  const pct = Math.round(((final - estimate) / estimate) * 100);
  return (
    <span className={`ml-2 text-[12px] font-bold ${pct < 0 ? "text-sale" : "text-ok"}`}>
      {pct > 0 ? "+" : ""}
      {pct}% vs estimate
    </span>
  );
}

function Stepper({ status, history }: { status: LeadStatus; history: LeadEvent[] }) {
  const current = STEPS.indexOf(status);
  const reachedAt = (s: LeadStatus) => history.findLast((e) => e.to === s && e.kind !== "note" && e.kind !== "message")?.at;
  return (
    <ol className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-8" aria-label="Trade-in progress">
      {STEPS.map((s, i) => {
        const done = i <= current;
        const at = reachedAt(s);
        return (
          <li key={s} className="min-w-0" aria-current={i === current ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${done ? "bg-ink" : "bg-line"}`} />
            <p className={`mt-2 truncate text-[12px] font-bold ${done ? "text-ink" : "text-muted"}`} title={STAGE_LABEL[s]}>
              {STAGE_LABEL[s]}
            </p>
            <p className="truncate text-[11px] text-muted">{at ? new Date(at).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : " "}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Timeline({ lead, now }: { lead: Lead; now: number }) {
  const events = [...(lead.history ?? [])].reverse();
  if (!events.length) return <p className="text-[14px] text-muted">Received {fmtDate(lead.createdAt)}. No activity yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {events.map((e, i) => {
        const kind = e.kind ?? "status";
        const dot = kind === "note" ? "bg-white border-2 border-ink" : kind === "message" ? "bg-wa" : e.to === "cancelled" || e.to === "declined" ? "bg-sale" : e.to === "paid" ? "bg-ok" : "bg-accent";
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-4">
            <span aria-hidden className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[14px] font-bold">
                  {kind === "note" ? "Note" : kind === "message" ? "Customer message" : e.from === e.to ? STAGE_LABEL[e.to] : `${STAGE_LABEL[e.from]} → ${STAGE_LABEL[e.to]}`}
                </p>
                <time dateTime={e.at} title={fmtDate(e.at)} className="text-[12px] text-muted">
                  {relTime(e.at, now)}
                </time>
              </div>
              {e.note && <p className={`mt-1 whitespace-pre-line break-words text-[13px] ${kind === "note" ? "rounded-xl bg-stage px-3 py-2 text-ink" : "text-ink-2"}`}>{e.note}</p>}
              <p className="mt-0.5 text-[12px] text-muted">by {e.by}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
