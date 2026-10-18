"use client";

import { compare, useCompare, type CompareItem } from "./store";

/** "Compare" checkbox on product cards and the product page. */
export function CompareToggle({ product, className = "" }: { product: CompareItem; className?: string }) {
  const { items } = useCompare();
  const on = items.some((i) => i.id === product.id);
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-bold text-ink-2 hover:text-ink ${className}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={() => compare.toggle(product)}
        className="h-4 w-4 cursor-pointer rounded accent-ink"
        aria-label={`Compare ${product.name}`}
      />
      Compare
    </label>
  );
}
