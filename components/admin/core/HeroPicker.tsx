"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import type { Product } from "@/lib/types";
import { naira } from "./format";
import { IconBtn } from "./HubsEditor";
import { AdminIcon } from "./icons";
import { LIMITS } from "./settings-schema";

export type PickerProduct = Pick<Product, "id" | "name" | "spec" | "price" | "brand" | "category" | "stock" | "status" | "photo" | "imageUrl" | "art" | "tint">;

/**
 * Ordered picker for the home hero showcase (up to 10). Searchable by name, brand,
 * category or id. Selected ids submit as repeated `hero` fields, in order.
 */
export function HeroPicker({
  products,
  initial,
  error,
  disabled,
  onChange,
}: {
  products: PickerProduct[];
  initial: string[];
  error?: string;
  disabled?: boolean;
  onChange?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const searchId = useId();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const full = selected.length >= LIMITS.heroProducts;

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return products
      .filter((p) => p.status === "active" && !selected.includes(p.id))
      .filter((p) => {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.spec} ${p.id}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [deferred, products, selected]);

  const set = (next: string[]) => {
    setSelected(next);
    onChange?.();
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  return (
    <div>
      {selected.map((id) => (
        <input key={id} type="hidden" name="hero" value={id} />
      ))}

      {selected.length ? (
        <ol className="flex flex-col gap-2" aria-label="Hero showcase order">
          {selected.map((id, i) => {
            const p = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2 pr-1">
                <span className="w-5 shrink-0 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stage">
                  {p ? (
                    <ProductImage item={p} width={120} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-muted">
                      <AdminIcon name="alert" size={18} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{p?.name ?? "Removed product"}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {p ? `${naira(p.price)} · ${p.stock > 0 ? `${p.stock} in stock` : "Sold out"}${p.status !== "active" ? ` · ${p.status}` : ""}` : id}
                  </span>
                </span>
                {!disabled && (
                  <span className="flex shrink-0 items-center">
                    <IconBtn label={`Move ${p?.name ?? id} up`} icon="arrowUp" onClick={() => move(i, -1)} disabled={i === 0} />
                    <IconBtn label={`Move ${p?.name ?? id} down`} icon="arrowDown" onClick={() => move(i, 1)} disabled={i === selected.length - 1} />
                    <IconBtn label={`Remove ${p?.name ?? id}`} icon="close" onClick={() => set(selected.filter((x) => x !== id))} danger />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-2">
          No products picked. The home page automatically showcases the newest top-grade items.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12px] font-bold text-sale">
          {error}
        </p>
      )}

      {!disabled && (
        <div className="mt-4">
          <label htmlFor={searchId} className="mb-1.5 block text-[13px] font-bold text-ink-2">
            Add a product {full && <span className="font-normal text-muted">(limit of {LIMITS.heroProducts} reached)</span>}
          </label>
          <div className="relative">
            <AdminIcon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the top match instead of submitting the settings form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (results[0] && !full) {
                    set([...selected, results[0].id]);
                    setQuery("");
                  }
                }
              }}
              disabled={full}
              placeholder="Search by name, brand or category"
              autoComplete="off"
              aria-controls={`${searchId}-results`}
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-transparent focus:ring-2 focus:ring-accent disabled:bg-stage"
            />
          </div>
          <ul id={`${searchId}-results`} aria-live="polite" className="mt-2 flex flex-col gap-1">
            {deferred.trim() && !results.length && <li className="px-2 py-2 text-[13px] text-muted">No matching live products.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    set([...selected, p.id]);
                    setQuery("");
                  }}
                  disabled={full}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-stage focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stage">
                    <ProductImage item={p} width={120} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">{p.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {p.brand} · {naira(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : "Sold out"}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-white">
                    <AdminIcon name="plus" size={12} strokeWidth={2} /> Add
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
