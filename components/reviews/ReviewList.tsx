"use client";

import { useMemo, useState } from "react";
import type { PublicReview } from "@/lib/reviews-shared";
import { Icon } from "../Icon";
import { Stars } from "./Stars";

// Sortable, paginated list of published reviews on the product page. All text is
// rendered as React text nodes (escaped); nothing is injected as HTML.

type Sort = "newest" | "highest" | "lowest";

const PAGE = 5;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);

  const sorted = useMemo(() => {
    const r = [...reviews];
    const newest = (a: PublicReview, b: PublicReview) => b.createdAt.localeCompare(a.createdAt);
    if (sort === "highest") r.sort((a, b) => b.rating - a.rating || newest(a, b));
    else if (sort === "lowest") r.sort((a, b) => a.rating - b.rating || newest(a, b));
    else r.sort(newest);
    return r;
  }, [reviews, sort]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <p className="text-[14px] text-ink-2">
          Showing {Math.min(limit, sorted.length)} of {sorted.length}
        </p>
        <label className="flex items-center gap-2 text-[14px]">
          <span className="hidden text-ink-2 sm:inline">Sort by</span>
          <select
            aria-label="Sort reviews"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setLimit(PAGE);
            }}
            className="rounded-full border border-line bg-white px-4 py-2 font-bold"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </label>
      </div>
      <ul className="divide-y divide-line">
        {sorted.slice(0, limit).map((r) => (
          <li key={r.id} className="py-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars value={r.rating} size={15} />
              {r.title && <h3 className="text-[15px] font-bold">{r.title}</h3>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              <span className="font-bold text-ink">{r.name}</span>
              <span className="inline-flex items-center gap-0.5 font-bold text-ok">
                <Icon name="checkCircle" size={14} /> Verified purchase
              </span>
              <span>· {fmt(r.createdAt)}</span>
            </p>
            <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-2">{r.body}</p>
            {r.reply && (
              <div className="mt-4 rounded-xl bg-stage p-4 text-[14px]">
                <p className="font-bold">Reply from JDHub</p>
                <p className="mt-1 whitespace-pre-line break-words text-ink-2">{r.reply.text}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {limit < sorted.length && (
        <div className="pt-2 text-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE * 2)} className="btn btn-outline">
            Show more reviews
          </button>
        </div>
      )}
    </div>
  );
}
