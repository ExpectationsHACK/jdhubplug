import type { Metadata } from "next";
import Link from "next/link";
import { OfferLinkTools } from "@/components/admin/offers/OfferLinkTools";
import { OfferRowActions } from "@/components/admin/offers/OfferRowActions";
import { describeScope } from "@/components/admin/offers/offerInput";
import { qrSvg, siteOrigin, specialLink } from "@/components/admin/offers/server";
import { AdminPage, Badge, EmptyState, PageHeader, StatCard, inputCls, type Tone } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { STATE_LABEL, formatNaira, lagosDateTime, shortDuration } from "@/components/offers/format";
import { can, requireAdmin } from "@/lib/auth";
import { describeDiscount, offerAppliesTo, offerState } from "@/lib/pricing";
import { getAllOfferStats, listOffers, listProducts } from "@/lib/store";
import type { Offer, OfferState, OfferStats } from "@/lib/types";

export const metadata: Metadata = { title: "Offers & links" };

const STATE_TONE: Record<OfferState, Tone> = {
  live: "green",
  scheduled: "blue",
  paused: "amber",
  expired: "neutral",
  exhausted: "purple",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "scheduled", label: "Scheduled" },
  { id: "paused", label: "Paused" },
  { id: "ended", label: "Ended" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const ORDER: Record<OfferState, number> = { live: 0, scheduled: 1, paused: 2, exhausted: 3, expired: 4 };

const matches = (f: Filter, s: OfferState) => f === "all" || (f === "ended" ? s === "expired" || s === "exhausted" : s === f);

/** Read the clock in a helper so render stays pure (the page is already request-time). */
const currentTime = () => Date.now();

export default async function OffersPage({ searchParams }: PageProps<"/admin/offers">) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.id === sp.show) ? (sp.show as Filter) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60).toLowerCase() : "";
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const deleted = sp.deleted === "1";
  const canWrite = can(session.role, "offers:write");

  const [offers, allStats, origin] = await Promise.all([listOffers(), getAllOfferStats(), siteOrigin()]);
  const now = currentTime();
  const statsOf = (code: string): OfferStats => allStats[code] ?? { views: 0, orders: 0, revenue: 0 };
  const rows = offers
    .map((o) => ({ o, stats: statsOf(o.code), state: offerState(o, now, statsOf(o.code)) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.o.createdAt.localeCompare(a.o.createdAt));

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => matches(f.id, r.state)).length])) as Record<Filter, number>;
  const visible = rows.filter((r) => matches(filter, r.state) && (!q || r.o.title.toLowerCase().includes(q) || r.o.code.includes(q)));

  // Products for thumbnails and single-product scope names.
  // Products for thumbnails (the chosen hero, else the first eligible item with a photo).
  const all = offers.length ? await listProducts() : [];
  const products = new Map(all.map((p) => [p.id, p]));
  const heroOf = (o: Offer) =>
    (o.heroProductId && products.get(o.heroProductId)) ||
    all.find((p) => p.status === "active" && (p.photo || p.imageUrl) && offerAppliesTo(o, p));
  const qrs = await Promise.all(visible.map((r) => qrSvg(specialLink(origin, r.o.code))));

  const totals = rows.reduce((t, r) => ({ views: t.views + r.stats.views, orders: t.orders + r.stats.orders, revenue: t.revenue + r.stats.revenue }), {
    views: 0,
    orders: 0,
    revenue: 0,
  });

  return (
    <AdminPage>
      <PageHeader
        title="Offers & links"
        description="Discounts with a shareable special link, QR code and their own landing page."
        actions={
          canWrite && (
            <Link href="/admin/offers/new" className="btn btn-primary">
              <span aria-hidden className="text-[18px] leading-none">+</span> Create offer
            </Link>
          )
        }
      />

      {saved && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-[#bfe6cf] bg-[#effaf3] px-4 py-3 text-[14px] text-ok">
          <Icon name="checkCircle" size={18} /> Offer <b className="font-mono">{saved}</b> saved. Its link is live as soon as the schedule starts.
        </p>
      )}
      {deleted && (
        <p role="status" className="mb-5 rounded-xl border border-line bg-white px-4 py-3 text-[14px] text-ink-2">
          Offer deleted.
        </p>
      )}

      {offers.length === 0 ? (
        <OffersEmpty canWrite={canWrite} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard label="Live now" value={counts.live} hint={`${counts.scheduled} scheduled`} tone={counts.live ? "good" : "default"} />
            <StatCard label="Link views" value={totals.views.toLocaleString("en-NG")} hint="All offers, all time" />
            <StatCard label="Orders" value={totals.orders.toLocaleString("en-NG")} hint={`${pct(totals.orders, totals.views)} conversion`} />
            <StatCard label="Revenue" value={formatNaira(totals.revenue)} hint="From orders using an offer" />
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Filter offers" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={{ pathname: "/admin/offers", query: { ...(f.id !== "all" ? { show: f.id } : {}), ...(q ? { q } : {}) } }}
                  aria-current={filter === f.id ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                    filter === f.id ? "bg-ink text-white" : "bg-white text-ink-2 ring-1 ring-line hover:ring-ink"
                  }`}
                >
                  {f.label}
                  <span className={`text-[12px] ${filter === f.id ? "text-white/70" : "text-muted"}`}>{counts[f.id]}</span>
                </Link>
              ))}
            </nav>
            <form role="search" className="flex gap-2 md:w-72">
              {filter !== "all" && <input type="hidden" name="show" value={filter} />}
              <label className="sr-only" htmlFor="offer-q">
                Search offers
              </label>
              <input id="offer-q" name="q" defaultValue={q} placeholder="Search title or code" className={`${inputCls} py-2`} />
            </form>
          </div>

          {visible.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No offers match" body="Try another filter or search." action={<Link href="/admin/offers" className="btn btn-outline">Clear filters</Link>} />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {visible.map(({ o, stats, state }, i) => (
                <OfferRow
                  key={o.code}
                  offer={o}
                  stats={stats}
                  state={state}
                  now={now}
                  url={specialLink(origin, o.code)}
                  qr={qrs[i]}
                  hero={heroOf(o) || undefined}
                  scope={describeScope(o.scope, (id) => products.get(id)?.name)}
                  highlight={o.code === saved}
                  canWrite={canWrite}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPage>
  );
}

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");

function OfferRow({
  offer: o,
  stats,
  state,
  now,
  url,
  qr,
  hero,
  scope,
  highlight,
  canWrite,
}: {
  offer: Offer;
  stats: OfferStats;
  state: OfferState;
  now: number;
  url: string;
  qr: string;
  hero?: Parameters<typeof ProductImage>[0]["item"];
  scope: string;
  highlight: boolean;
  canWrite: boolean;
}) {
  const timing =
    state === "scheduled"
      ? `Starts in ${shortDuration(Date.parse(o.startsAt) - now)}`
      : state === "live"
        ? `Ends in ${shortDuration(Date.parse(o.endsAt) - now)}`
        : state === "expired"
          ? `Ended ${lagosDateTime(o.endsAt)}`
          : null;
  const limitLeft = o.usageLimit !== undefined ? Math.max(0, o.usageLimit - stats.orders) : null;

  return (
    <li
      className={`rounded-2xl border bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] md:p-5 ${
        highlight ? "border-accent ring-2 ring-accent/20" : "border-line"
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6">
        {/* Identity */}
        <div className="flex min-w-0 gap-4">
          <Link href={`/admin/offers/${encodeURIComponent(o.code)}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stage" tabIndex={-1} aria-hidden>
            {hero ? (
              <ProductImage item={hero} width={250} className="h-20 w-20" artClassName="h-14 w-14" />
            ) : (
              <span className="grid h-full w-full place-items-center bg-ink text-white">
                <Icon name="gift" size={28} strokeWidth={1.25} />
              </span>
            )}
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/offers/${encodeURIComponent(o.code)}`} className="truncate text-[16px] font-bold hover:underline">
                {o.title}
              </Link>
              <Badge tone={STATE_TONE[state]}>
                {state === "live" && <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ok motion-reduce:animate-none" />}
                {STATE_LABEL[state]}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
              <span className="rounded-md bg-stage px-1.5 py-0.5 font-mono text-[12px] font-bold uppercase">{o.code}</span>
              <span className="font-bold text-sale">{describeDiscount(o)}</span>
              <span className="text-muted">·</span>
              <span>{scope}</span>
            </p>
            <p className="mt-1.5 text-[12px] text-muted">
              {lagosDateTime(o.startsAt)} → {lagosDateTime(o.endsAt)}
              {timing && <span className="font-bold text-ink-2"> · {timing}</span>}
            </p>
            {(o.minSubtotal || limitLeft !== null) && (
              <p className="mt-1 text-[12px] text-muted">
                {o.minSubtotal ? `Min. order ${formatNaira(o.minSubtotal)}` : ""}
                {o.minSubtotal && limitLeft !== null ? " · " : ""}
                {limitLeft !== null ? `${limitLeft} of ${o.usageLimit} uses left` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-4 gap-2 self-start rounded-xl bg-[#fafbfc] p-3 text-center lg:grid-cols-2 xl:grid-cols-4">
          {[
            ["Views", stats.views.toLocaleString("en-NG")],
            ["Orders", stats.orders.toLocaleString("en-NG")],
            ["Revenue", stats.revenue >= 1_000_000 ? `₦${(stats.revenue / 1_000_000).toFixed(1)}m` : formatNaira(stats.revenue)],
            ["Conv.", pct(stats.orders, stats.views)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{k}</dt>
              <dd className="mt-0.5 truncate text-[15px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Link + actions */}
        <div className="min-w-0">
          <OfferLinkTools url={url} code={o.code} qrSvg={qr} shareText={`${o.title}: ${describeDiscount(o)} at JDHub. ${o.headline !== o.title ? o.headline : ""}`.trim()} />
          {canWrite && (
            <div className="mt-3 border-t border-line pt-3">
              <OfferRowActions code={o.code} title={o.title} active={o.active} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function OffersEmpty({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="grid gap-8 p-6 md:grid-cols-[1.1fr_1fr] md:p-10">
        <div>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white">
            <Icon name="gift" size={28} strokeWidth={1.25} />
          </span>
          <h2 className="display mt-5 text-[24px] md:text-[28px]">Run your first offer.</h2>
          <p className="mt-2 max-w-md text-[15px] text-ink-2">
            An offer is a timed discount (percent off, naira off or a flash price) on all products, chosen categories, brands or specific items. Each one
            gets a special link and QR code to share on WhatsApp, Instagram or flyers.
          </p>
          {canWrite && (
            <Link href="/admin/offers/new" className="btn btn-primary mt-6">
              Create offer
            </Link>
          )}
        </div>
        <ol className="flex flex-col gap-3 self-center">
          {[
            ["Share the link", "Shoppers who open /o/your-code land on a branded page with a live countdown."],
            ["Discount applies itself", "The code is saved to their cart and taken off at checkout, on eligible items only."],
            ["Track what works", "See views, orders, revenue and conversion for every link."],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-3 rounded-xl bg-stage p-4">
              <span className="display grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[13px]">{i + 1}</span>
              <div>
                <p className="text-[14px] font-bold">{t}</p>
                <p className="text-[13px] text-ink-2">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
