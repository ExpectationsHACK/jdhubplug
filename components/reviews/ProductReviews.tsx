import type { PublicReview, RatingSummary } from "@/lib/reviews-shared";
import { Icon } from "../Icon";
import { ReviewList } from "./ReviewList";
import { Stars } from "./Stars";

// Reviews section on the product page: verified-purchase reviews shared by every unit
// of the model. With none yet, it says so plainly instead of showing a score.

export function ProductReviews({
  reviews,
  dist,
  summary,
  modelName,
}: {
  reviews: PublicReview[];
  dist: number[];
  summary?: RatingSummary;
  modelName: string;
}) {
  return (
    <section id="reviews" className="wrap scroll-mt-24 pt-20" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="display text-[24px] md:text-[32px]">
        Reviews
      </h2>
      {!summary || !reviews.length ? (
        <div className="mt-6 rounded-tile bg-stage p-6 md:p-8">
          <p className="text-[16px] font-bold">No reviews yet for the {modelName}.</p>
          <p className="mt-1 max-w-xl text-[14px] text-ink-2">
            Only buyers whose JDHub order was delivered can leave a review, so every rating here comes from a real purchase.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-tile bg-stage p-6">
              <p className="display text-[48px] leading-none">{summary.average.toFixed(1)}</p>
              <Stars value={summary.average} size={20} className="mt-3" />
              <p className="mt-2 text-[14px] text-ink-2">
                {summary.count} verified review{summary.count === 1 ? "" : "s"}
              </p>
              <ul className="mt-5 space-y-2" aria-label="Rating distribution">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = dist[star - 1] ?? 0;
                  const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                  return (
                    <li key={star} className="flex items-center gap-3 text-[13px]">
                      <span className="flex w-8 items-center gap-0.5 font-bold">
                        {star} <Icon name="star" size={12} className="fill-current" />
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white" aria-hidden>
                        <span className="block h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 text-right text-muted">
                        {n}
                        <span className="sr-only"> {star}-star review{n === 1 ? "" : "s"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[12px] text-muted">
                <Icon name="checkCircle" size={16} className="shrink-0 text-ok" />
                Every review is from a buyer whose order was delivered. Shared by all units of this model.
              </p>
            </div>
          </div>
          <ReviewList reviews={reviews} />
        </div>
      )}
    </section>
  );
}
