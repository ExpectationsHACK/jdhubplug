import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { customerWaLink, humanizeKey, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, money, telHref } from "@/components/admin/orders/format";
import { LeadActions } from "@/components/admin/orders/LeadActions";
import { Avatar, IconLink, Pagination, StatMoney, TabNav } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { STAGE_TONE } from "@/components/admin/requests/tones";
import { AdminPage, Badge, EmptyState, fmtDate, PageHeader, relTime, StatCard, type Tone } from "@/components/admin/ui";
import { can, requireAdmin } from "@/lib/auth";
import { getSettings, listLeads } from "@/lib/store";
import { syncCreditRedemptions } from "@/lib/tradein";
import { deviceOf, estimateOf, fmtSlot, isTradeIn, normalizeStatus, OPEN_STAGES, STAGE_LABEL, STAGES, tradeStats } from "@/lib/tradein-flow";
import type { Lead, LeadStatus, LeadType } from "@/lib/types";

export const metadata: Metadata = { title: "Requests" };

const PER_PAGE = 20;
const STATUS_KEYS = ["new", "contacted", "closed", "all"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const OTHER_TYPES: LeadType[] = ["contact", "vendor"];
const TRADE_TYPES: LeadType[] = ["sell", "swap"];
const STAGE_KEYS = ["open", ...STAGES.filter((s) => s !== "cancelled"), "all"] as const;
type StageKey = "open" | "all" | LeadStatus;

const TYPE_TONE: Record<LeadType, Tone> = { sell: "green", swap: "purple", contact: "neutral", vendor: "blue" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Opening line for a WhatsApp reply, tailored to the request type. */
function replyText(l: Lead, store: string) {
  const name = l.name.split(/\s+/)[0] || "there";
  return l.type === "vendor"
    ? `Hi ${name}, this is ${store}. Thanks for your interest in selling on ${store}. Let's talk about your inventory.`
    : `Hi ${name}, this is ${store}, replying to your message.`;
}

function matches(l: Lead, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^(234|0)/, "");
  return (
    l.id.toLowerCase().includes(needle) ||
    l.name.toLowerCase().includes(needle) ||
    l.message.toLowerCase().includes(needle) ||
    !!l.email?.toLowerCase().includes(needle) ||
    Object.values(l.details ?? {}).some((v) => v.toLowerCase().includes(needle)) ||
    (digits.length >= 4 && l.phone.replace(/\D/g, "").includes(digits))
  );
}

export default async function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const session = await requireAdmin();
  const [stored, settings, sp] = await Promise.all([listLeads(), getSettings(), searchParams]);
  let leads = stored;
  const now = await requestNow();
  const canWrite = can(session.role, "leads:write");
  // Swap credits used at checkout mark their trade-in paid.
  if (await syncCreditRedemptions(leads)) leads = await listLeads();
  leads = leads.map((l) => ({ ...l, status: normalizeStatus(l) }));

  const view = first(sp.view) === "other" ? "other" : "trade";
  const q = first(sp.q).trim().slice(0, 80);
  const pageParam = Number.parseInt(first(sp.page) || "1", 10);
  const typeParam = first(sp.type);

  const trades = leads.filter(isTradeIn);
  const others = leads.filter((l) => !isTradeIn(l));
  const openTrades = trades.filter((l) => OPEN_STAGES.includes(l.status)).length;
  const newOthers = others.filter((l) => l.status === "new").length;

  const viewTabs = (
    <TabNav
      label="Request kind"
      tabs={[
        { href: "/admin/requests", label: "Trade-ins (sell & swap)", count: openTrades, active: view === "trade" },
        { href: "/admin/requests?view=other", label: "Contact & vendor", count: newOthers, active: view === "other" },
      ]}
    />
  );

  if (view === "trade") {
    const stageParam = first(sp.stage);
    const stage: StageKey = (STAGE_KEYS as readonly string[]).includes(stageParam) || stageParam === "cancelled" ? (stageParam as StageKey) : "open";
    const type: LeadType | "all" = TRADE_TYPES.includes(typeParam as LeadType) ? (typeParam as LeadType) : "all";
    const scoped = trades.filter((l) => (type === "all" || l.type === type) && matches(l, q));
    const inStage = (l: Lead, s: StageKey) => s === "all" || (s === "open" ? OPEN_STAGES.includes(l.status) : s === "closed" ? l.status === "closed" || l.status === "cancelled" : l.status === s);
    const rows = scoped
      .filter((l) => inStage(l, stage))
      // Booked inspections soonest first; everything else newest first.
      .sort((a, b) => (stage === "inspection_booked" ? Date.parse(a.trade?.booking?.at ?? "") - Date.parse(b.trade?.booking?.at ?? "") : b.createdAt.localeCompare(a.createdAt)));
    const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
    const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const stats = tradeStats(leads, now);

    const href = (patch: { stage?: StageKey; page?: number }) => {
      const u = new URLSearchParams();
      const s = patch.stage ?? stage;
      if (s !== "open") u.set("stage", s);
      if (type !== "all") u.set("type", type);
      if (q) u.set("q", q);
      if (patch.page && patch.page > 1) u.set("page", String(patch.page));
      const str = u.toString();
      return `/admin/requests${str ? `?${str}` : ""}`;
    };

    return (
      <AdminPage>
        <PageHeader title="Requests" description="Sell and swap trade-ins from lead to inspection to payout, plus contact and vendor requests." />
        {viewTabs}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Open trade-ins" value={stats.open} hint={`${trades.filter((l) => l.status === "new").length} new`} tone={stats.open ? "warn" : "default"} />
          <StatCard label="Inspections this week" value={stats.inspectionsThisWeek} hint="Mon–Sun, Lagos time" />
          <StatCard label="Paid out this month" value={<StatMoney>{money(stats.paidThisMonth)}</StatMoney>} hint={`${stats.paidCountThisMonth} payout${stats.paidCountThisMonth === 1 ? "" : "s"}`} />
          <StatCard
            label="Avg final offer vs estimate"
            value={stats.ratio === null ? "—" : `${Math.round(stats.ratio * 100)}%`}
            hint={stats.compared ? `${money(stats.avgFinal)} vs ${money(stats.avgEstimate)} over ${stats.compared}` : "No inspections yet"}
            tone={stats.ratio !== null && stats.ratio < 0.85 ? "bad" : "default"}
          />
        </div>

        <TabNav
          label="Trade-in stage"
          tabs={STAGE_KEYS.map((s) => ({
            href: href({ stage: s }),
            label: s === "open" ? "Open" : s === "all" ? "All" : s === "closed" ? "Closed & cancelled" : STAGE_LABEL[s],
            count: scoped.filter((l) => inStage(l, s)).length,
            active: s === stage || (stage === "cancelled" && s === "closed"),
          }))}
        />

        <div className="mb-4">
          <FilterBar
            action="/admin/requests"
            q={q}
            placeholder="Search name, phone, device or request id"
            hidden={{ stage: stage === "open" ? "" : stage }}
            selects={[{ name: "type", label: "Request type", value: type, options: [{ value: "all", label: "Sell & swap" }, ...TRADE_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))] }]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={trades.length ? "Nothing here" : "No trade-ins yet"}
            body={trades.length ? "No sell or swap requests match this stage and filter." : "Requests from the sell estimator and swap planner land here."}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((l) => (
              <TradeRow key={l.id} lead={l} now={now} />
            ))}
          </ul>
        )}

        <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => href({ page: p })} />
      </AdminPage>
    );
  }

  // ------------------------------------------------- Contact & vendor (unchanged)

  const statusParam = first(sp.status);
  const status: StatusKey = (STATUS_KEYS as readonly string[]).includes(statusParam) ? (statusParam as StatusKey) : "new";
  const type: LeadType | "all" = OTHER_TYPES.includes(typeParam as LeadType) ? (typeParam as LeadType) : "all";
  const scoped = others.filter((l) => (type === "all" || l.type === type) && matches(l, q));
  const rows = scoped.filter((l) => status === "all" || l.status === status);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const href = (patch: { status?: StatusKey; page?: number }) => {
    const u = new URLSearchParams({ view: "other" });
    const s = patch.status ?? status;
    if (s !== "new") u.set("status", s);
    if (type !== "all") u.set("type", type);
    if (q) u.set("q", q);
    if (patch.page && patch.page > 1) u.set("page", String(patch.page));
    return `/admin/requests?${u.toString()}`;
  };

  return (
    <AdminPage>
      <PageHeader
        title="Requests"
        description={newOthers ? `${newOthers} new request${newOthers === 1 ? "" : "s"} waiting for a reply.` : "Contact and vendor requests from the store."}
      />
      {viewTabs}

      <TabNav
        label="Request status"
        tabs={STATUS_KEYS.map((s) => ({
          href: href({ status: s }),
          label: s === "all" ? "All" : LEAD_STATUS_LABEL[s],
          count: scoped.filter((l) => s === "all" || l.status === s).length,
          active: s === status,
        }))}
      />

      <div className="mb-4">
        <FilterBar
          action="/admin/requests"
          q={q}
          placeholder="Search name, phone, message or device"
          hidden={{ view: "other", status: status === "new" ? "" : status }}
          selects={[{ name: "type", label: "Request type", value: type, options: [{ value: "all", label: "All types" }, ...OTHER_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))] }]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={others.length ? "Nothing here" : "No requests yet"}
          body={others.length ? "No requests match this tab and filter." : "Contact and vendor forms on the store land here."}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((l) => {
            const wa = customerWaLink(l.phone, replyText(l, settings.storeName));
            const details = Object.entries(l.details ?? {}).filter(([, v]) => v);
            return (
              <li key={l.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={l.name} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{l.name}</span>
                        <Badge tone={TYPE_TONE[l.type]}>{LEAD_TYPE_LABEL[l.type]}</Badge>
                        <Badge tone={STAGE_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {l.phone}
                        {l.email && <> · {l.email}</>} ·{" "}
                        <time dateTime={l.createdAt} title={fmtDate(l.createdAt)}>
                          {relTime(l.createdAt, now)}
                        </time>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <IconLink href={telHref(l.phone)} label={`Call ${l.name}`} kind="phone" />
                    {l.email && <IconLink href={`mailto:${l.email}`} label={`Email ${l.name}`} kind="mail" />}
                    {wa && <IconLink href={wa} label={`Reply to ${l.name} on WhatsApp`} kind="wa" external />}
                  </div>
                </div>

                {l.message && <p className="mt-4 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-2">{l.message}</p>}

                {details.length > 0 && (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-stage p-4 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
                    {details.map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{humanizeKey(k)}</dt>
                        <dd className="mt-0.5 break-words font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <LeadActions id={l.id} name={l.name} status={l.status} canWrite={canWrite} />
                  {l.updatedAt !== l.createdAt && <p className="text-[12px] text-muted">Updated {relTime(l.updatedAt, now)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => href({ page: p })} />
    </AdminPage>
  );
}

function TradeRow({ lead: l, now }: { lead: Lead; now: number }) {
  const t = l.trade ?? {};
  const estimate = estimateOf(l);
  const device = deviceOf(l);
  const next: Partial<Record<LeadStatus, string>> = {
    new: "Contact and book an inspection",
    contacted: "Book an inspection",
    inspection_booked: t.booking ? `Inspect ${fmtSlot(t.booking.at)}${t.booking.staff ? ` · ${t.booking.staff}` : ""}` : "Inspect",
    inspected: "Send the final offer",
    offer_sent: "Waiting for the customer",
    accepted: t.credit ? "Swap credit issued, waiting for checkout" : "Pay the customer",
    declined: "Revise the offer or close",
    paid: "Close when the device is in",
  };
  const overdue = l.status === "inspection_booked" && t.booking && Date.parse(t.booking.at) < now;
  return (
    <li>
      <Link
        href={`/admin/requests/${encodeURIComponent(l.id)}`}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:flex-row md:items-center md:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={l.name} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{l.name}</span>
              <Badge tone={TYPE_TONE[l.type]}>{LEAD_TYPE_LABEL[l.type]}</Badge>
              <Badge tone={STAGE_TONE[l.status]}>{STAGE_LABEL[l.status]}</Badge>
            </p>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {device || "Device not specified"} · {l.phone} ·{" "}
              <time dateTime={l.createdAt} title={fmtDate(l.createdAt)}>
                {relTime(l.createdAt, now)}
              </time>
            </p>
            {next[l.status] && <p className={`mt-1 text-[13px] font-bold ${overdue ? "text-sale" : "text-ink-2"}`}>{overdue ? "Inspection time has passed: record it or rebook" : next[l.status]}</p>}
          </div>
        </div>
        <dl className="flex shrink-0 gap-6 text-[13px] md:text-right">
          <div>
            <dt className="text-muted">Estimate</dt>
            <dd className="font-bold tabular-nums">{estimate ? money(estimate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.payout ? "Paid" : "Final offer"}</dt>
            <dd className="font-bold tabular-nums">{t.payout ? money(t.payout.amount) : t.inspection ? money(t.inspection.finalOffer) : "—"}</dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}
