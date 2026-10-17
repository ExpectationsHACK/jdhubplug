"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { formatNaira } from "@/components/offers/format";
import type { Product } from "@/lib/types";
import { inputCls } from "../ui";

export type PickerProduct = Pick<
  Product,
  "id" | "name" | "spec" | "brand" | "category" | "price" | "stock" | "status" | "photo" | "imageUrl" | "art" | "tint"
>;

const MAX_ROWS = 80;

/**
 * Searchable product list with thumbnails. Multi-select (checkboxes) or single-select
 * (radio). Selected items show as removable chips above the list.
 */
export function ProductPicker({
  products,
  selected,
  onChange,
  multiple = true,
  label,
  emptyHint = "No products match.",
  invalid = false,
}: {
  products: PickerProduct[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  label: string;
  emptyHint?: string;
  invalid?: boolean;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const matches = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = terms.length
      ? products.filter((p) => {
          const hay = `${p.name} ${p.brand} ${p.spec} ${p.category} ${p.id}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
      : products;
    return list;
  }, [products, q]);

  const toggle = (pid: string) => {
    if (!multiple) return onChange(selected[0] === pid ? [] : [pid]);
    onChange(selected.includes(pid) ? selected.filter((x) => x !== pid) : [...selected, pid]);
  };

  const visibleIds = matches.slice(0, MAX_ROWS).map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((x) => selected.includes(x));

  return (
    <div className={`rounded-xl border ${invalid ? "border-sale" : "border-line"} bg-white`}>
      {selected.length > 0 && (
        <ul aria-label={`Selected for ${label}`} className="flex flex-wrap gap-1.5 border-b border-line p-2.5">
          {selected.map((sid) => {
            const p = byId.get(sid);
            return (
              <li key={sid} className="flex max-w-full items-center gap-1.5 rounded-full bg-stage py-1 pl-1 pr-1.5 text-[12px] font-bold">
                {p && (
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
                    <ProductImage item={p} width={120} className="h-5 w-5" artClassName="h-4 w-4" />
                  </span>
                )}
                <span className="truncate">{p?.name ?? sid}</span>
                <button type="button" onClick={() => toggle(sid)} className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-white" aria-label={`Remove ${p?.name ?? sid}`}>
                  <Icon name="close" size={12} strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-2 p-2.5">
        <label htmlFor={`${id}-q`} className="sr-only">
          Search products for {label}
        </label>
        <div className="relative flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, brand or spec"
            className={`${inputCls} py-2 pl-9`}
            autoComplete="off"
          />
        </div>
        {multiple && visibleIds.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange(allVisibleSelected ? selected.filter((x) => !visibleIds.includes(x)) : [...new Set([...selected, ...visibleIds])])
            }
            className="shrink-0 rounded-full px-3 py-2 text-[12px] font-bold text-accent hover:bg-[#eef3ff]"
          >
            {allVisibleSelected ? "Clear shown" : `Select ${visibleIds.length}`}
          </button>
        )}
      </div>
      <ul aria-label={label} className="max-h-80 overflow-y-auto border-t border-line">
        {matches.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">{emptyHint}</li>}
        {matches.slice(0, MAX_ROWS).map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:bg-[#eef3ff] focus-visible:outline-none ${on ? "bg-[#f3f6ff]" : "hover:bg-[#fafbfc]"}`}
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 shrink-0 place-items-center border-2 transition ${multiple ? "rounded-md" : "rounded-full"} ${
                    on ? "border-accent bg-accent text-white" : "border-line bg-white"
                  }`}
                >
                  {on && (multiple ? <Icon name="check" size={13} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-white" />)}
                </span>
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stage">
                  <ProductImage item={p} width={120} className="h-10 w-10" artClassName="h-8 w-8" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {p.spec} · {p.brand}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-bold">{formatNaira(p.price)}</span>
                  <span className={`block text-[11px] ${p.stock > 0 ? "text-muted" : "font-bold text-sale"}`}>
                    {p.status !== "active" ? p.status : p.stock > 0 ? `${p.stock} in stock` : "Sold out"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {matches.length > MAX_ROWS && (
          <li className="px-4 py-3 text-center text-[12px] text-muted">
            Showing {MAX_ROWS} of {matches.length}. Search to narrow down.
          </li>
        )}
      </ul>
    </div>
  );
}
