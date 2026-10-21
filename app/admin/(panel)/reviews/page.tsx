import type { Metadata } from "next";
import Link from "next/link";
import { ReviewActions, ReviewSettingsForm } from "@/components/admin/reviews/ReviewActions";
import { FilterBar } from "@/components/admin/orders/FilterBar";
import { Avatar, Pagination, TabNav } from "@/components/admin/orders/parts";
import { requestNow } from "@/components/admin/orders/server";
import { AdminPage, Badge, Card, EmptyState, fmtDate, PageHeader, relTime, StatCard, type Tone } from "@/components/admin/ui";
import { Stars } from "@/components/reviews/Stars";
import { can, requireAdmin } from "@/lib/auth";
import { models } from "@/lib/models";
import { getReviewSettings, listReviews, REVIEW_STATUS_LABEL, type Review, type ReviewStatus } from "@/lib/reviews";

export const metadata: Metadata = { title: "Reviews" };

const PER_PAGE = 20;
const STATUS_KEYS = ["pending", "published", "hidden", "all"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const STATUS_TONE: Record<ReviewStatus, Tone> = { pending: "amber", published: "green", hidden: "neutral" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Start of the current calendar month in Lagos (UTC+1, no DST), as epoch ms. */
function monthStartLagos(now: number) {
  const lagos = new Date(now + 3_600_000);
  return Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 3_600_000;
}

const avg = (rs: Review[]) => (rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0);

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const session = await requireAdmin();
  const [reviews, settings, sp] = await Promise.all([listReviews(), getReviewSettings(), searchParams]);
  const now = await requestNow();
  const canWrite = can(session.role, "products:write");
  const canSettings = can(session.role, "settings:write");

  const modelName = new Map<string, string>(models.map((m) => [m.slug, m.name]));
  const nameOf = (r: Review) => modelName.get(r.productModel) ?? r.productName;
  const reviewedModels = [...new Set(reviews.map((r) => r.productModel))]
    .map((m) => ({ value: m, label: modelName.get(m) ?? reviews.find((r) => r.productModel === m)!.productName }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const statusParam = first(sp.status);
  const status: StatusKey = (STATUS_KEYS as readonly string[]).includes(statusParam) ? (statusParam as StatusKey) : "pending";
  const ratingParam = Number.parseInt(first(sp.rating), 10);
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : 0;
  const modelParam = first(sp.product);
  const model = reviewedModels.some((m) => m.value === modelParam) ? modelParam : "";
  const q = first(sp.q).trim().slice(0, 80);
  const pageParam = Number.parseInt(first(sp.page) || "1", 10);

  const needle = q.toLowerCase();
  const scoped = reviews.filter(
    (r) =>
      (!rating || r.rating === rating) &&
      (!model || r.productModel === model) &&
      (!q ||
        r.name.toLowerCase().includes(needle) ||
        r.title.toLowerCase().includes(needle) ||
        r.body.toLowerCase().includes(needle) ||
        r.orderId.toLowerCase().includes(needle) ||
        nameOf(r).toLowerCase().includes(needle)),
  );
  const rows = scoped.filter((r) => status === "all" || r.status === status);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, pages) : 1;
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const href = (patch: { status?: StatusKey; page?: number }) => {
    const u = new URLSearchParams();
    const s = patch.status ?? status;
    if (s !== "pending") u.set("status", s);
    if (rating) u.set("rating", String(rating));
    if (model) u.set("product", model);
    if (q) u.set("q", q);
    if (patch.page && patch.page > 1) u.set("page", String(patch.page));
    const str = u.toString();
    return `/admin/reviews${str ? `?${str}` : ""}`;
  };

  const published = reviews.filter((r) => r.status === "published");
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const monthStart = monthStartLagos(now);
  const thisMonth = reviews.filter((r) => Date.parse(r.createdAt) >= monthStart);

  return (
    <AdminPage>
      <PageHeader
        title="Reviews"
        description={
          pendingCount
            ? `${pendingCount} review${pendingCount === 1 ? "" : "s"} waiting for approval.`
            : "Verified-purchase reviews from delivered orders. Approve, hide or reply."
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average rating"
          value={published.length ? avg(published).toFixed(2) : "—"}
          hint={published.length ? `${published.length} published review${published.length === 1 ? "" : "s"}` : "No published reviews yet"}
        />
        <StatCard
          label="Reviews this month"
          value={thisMonth.length}
          hint={thisMonth.length ? `Average ${avg(thisMonth).toFixed(1)} across all statuses` : "Since the 1st"}
        />
        <StatCard label="Awaiting approval" value={pendingCount} tone={pendingCount ? "warn" : "default"} />
        <StatCard label="Hidden" value={reviews.filter((r) => r.status === "hidden").length} />
      </div>

      <TabNav
        label="Review status"
        tabs={STATUS_KEYS.map((s) => ({
          href: href({ status: s }),
          label: s === "all" ? "All" : REVIEW_STATUS_LABEL[s],
          count: scoped.filter((r) => s === "all" || r.status === s).length,
          active: s === status,
        }))}
      />

      <div className="mb-4">
        <FilterBar
          action="/admin/reviews"
          q={q}
          placeholder="Search name, text, product or order"
          hidden={{ status: status === "pending" ? "" : status }}
          selects={[
            {
              name: "rating",
              label: "Rating",
              value: rating ? String(rating) : "",
              options: [{ value: "", label: "All ratings" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` }))],
            },
            { name: "product", label: "Product", value: model, options: [{ value: "", label: "All products" }, ...reviewedModels] },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {visible.length === 0 ? (
            <EmptyState
              title={reviews.length ? "Nothing here" : "No reviews yet"}
              body={
                reviews.length
                  ? "No reviews match this tab and filter."
                  : "Buyers can rate their items from the order page once an order is marked delivered."
              }
            />
          ) : (
            <ul className="space-y-3">
              {visible.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{r.name}</span>
                          <Stars value={r.rating} size={14} />
                          <Badge tone={STATUS_TONE[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge>
                        </p>
                        <p className="mt-0.5 text-[13px] text-muted">
                          <Link href={`/product/${r.productId}`} target="_blank" className="font-bold text-ink-2 hover:underline">
                            {nameOf(r)}
                          </Link>{" "}
                          ·{" "}
                          <Link href={`/admin/orders/${r.orderId}`} className="hover:underline">
                            {r.orderId}
                          </Link>{" "}
                          ·{" "}
                          <time dateTime={r.createdAt} title={fmtDate(r.createdAt)}>
                            {relTime(r.createdAt, now)}
                          </time>
                        </p>
                      </div>
                    </div>
                  </div>

                  {r.title && <p className="mt-4 text-[15px] font-bold">{r.title}</p>}
                  <p className={`${r.title ? "mt-1" : "mt-4"} whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-2`}>{r.body}</p>

                  {r.adminReply && (
                    <div className="mt-4 rounded-xl bg-stage p-4 text-[13px]">
                      <p className="font-bold">
                        Reply by {r.adminReply.by} · <span className="font-normal text-muted">{relTime(r.adminReply.at, now)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line break-words text-ink-2">{r.adminReply.text}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <ReviewActions id={r.id} name={r.name} status={r.status} reply={r.adminReply?.text} canWrite={canWrite} />
                    {r.moderatedAt && (
                      <p className="text-[12px] text-muted">
                        {r.moderatedBy === "auto-publish" ? "Auto-published" : `Moderated by ${r.moderatedBy}`} {relTime(r.moderatedAt, now)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pages={pages} total={rows.length} perPage={PER_PAGE} href={(p) => href({ page: p })} />
        </div>

        <aside className="space-y-4">
          <Card title="Settings">
            <ReviewSettingsForm autoPublish={settings.autoPublish} canWrite={canSettings} />
          </Card>
          <Card title="How reviews work">
            <ul className="space-y-2 text-[13px] text-ink-2">
              <li>Only buyers of a delivered or completed order can review, once per item.</li>
              <li>Reviews are shared by every unit of a model and show a Verified purchase label.</li>
              <li>Only published reviews count towards the stars on cards and product pages.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </AdminPage>
  );
}
