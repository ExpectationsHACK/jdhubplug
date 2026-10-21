"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCategory } from "@/lib/reference";
import { Icon } from "../Icon";
import { ProductImage } from "../ProductImage";
import { compare, COMPARE_MAX, compareHref, useCompare } from "./store";

/** Sticky tray at the bottom of store pages while products are picked for comparison. */
export function CompareTray() {
  const { items, pending } = useCompare();
  const path = usePathname();
  if (path.startsWith("/compare") || (!items.length && !pending)) return null;
  const cat = items[0] ? getCategory(items[0].category)?.name.toLowerCase() : "";

  return (
    <aside
      aria-label="Compare products"
      className="fade-in fixed bottom-24 left-4 right-4 z-30 mx-auto max-w-xl rounded-tile border border-line bg-white/95 p-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur md:bottom-5 md:right-24"
    >
      {pending ? (
        <div role="alertdialog" aria-labelledby="compare-pending-title" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p id="compare-pending-title" className="flex-1 text-[14px]">
            {pending.reason === "category" ? (
              <>
                You can only compare items from one category. Replace your {cat} with <b>{pending.item.name}</b>?
              </>
            ) : (
              <>
                You can compare up to {COMPARE_MAX} items. Replace <b>{items[0]?.name}</b> with <b>{pending.item.name}</b>?
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" onClick={() => compare.dismissPending()}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary min-h-9 px-4 py-2 text-[13px]" onClick={() => compare.acceptPending()} autoFocus>
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <ul className="flex flex-1 gap-2" aria-label={`${items.length} of ${COMPARE_MAX} selected`}>
            {Array.from({ length: COMPARE_MAX }, (_, i) => items[i]).map((it, i) =>
              it ? (
                <li key={it.id} className="relative">
                  <ProductImage item={it} width={160} className="h-12 w-12 rounded-lg bg-stage sm:h-14 sm:w-14" artClassName="h-4/5 w-4/5" />
                  <button
                    type="button"
                    onClick={() => compare.remove(it.id)}
                    aria-label={`Remove ${it.name} from compare`}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Icon name="close" size={12} strokeWidth={2.5} />
                  </button>
                </li>
              ) : (
                <li key={`empty-${i}`} aria-hidden className="hidden h-12 w-12 rounded-lg border border-dashed border-line sm:block sm:h-14 sm:w-14" />
              ),
            )}
          </ul>
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
            <button type="button" onClick={() => compare.clear()} className="px-2 text-[13px] font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
              Clear
            </button>
            {items.length >= 2 ? (
              <Link href={compareHref(items.map((i) => i.id))} className="btn btn-primary min-h-9 px-4 py-2 text-[13px]">
                Compare now
              </Link>
            ) : (
              <span className="px-2 text-[12px] text-muted">Add one more</span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
