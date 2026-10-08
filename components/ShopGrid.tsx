"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { categories, grades, states, type Listing } from "@/lib/catalog";
import { Icon } from "./Icon";
import { ProductCard } from "./ProductCard";

const priceBands = [
  { id: "u100", label: "Under ₦100,000", min: 0, max: 100_000 },
  { id: "100-500", label: "₦100,000 – ₦500,000", min: 100_000, max: 500_000 },
  { id: "500-1m", label: "₦500,000 – ₦1,000,000", min: 500_000, max: 1_000_000 },
  { id: "1m-5m", label: "₦1,000,000 – ₦5,000,000", min: 1_000_000, max: 5_000_000 },
  { id: "5m+", label: "Over ₦5,000,000", min: 5_000_000, max: Infinity },
];

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

/** Reads `?brand=` so mega-menu brand links land pre-filtered. Must render inside <Suspense>. */
export function ShopGridFromParams(props: { items: Listing[]; showCategory?: boolean }) {
  const brand = useSearchParams().get("brand");
  return <ShopGrid {...props} initialBrand={brand ?? undefined} key={brand ?? ""} />;
}

export function ShopGrid({
  items,
  showCategory,
  initialBrand,
}: {
  items: Listing[];
  showCategory?: boolean;
  initialBrand?: string;
}) {
  const [cat, setCat] = useState<string[]>([]);
  const [brand, setBrand] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [grade, setGrade] = useState<string[]>([]);
  const [price, setPrice] = useState<string[]>([]);
  const [state, setState] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [panel, setPanel] = useState(false);

  const brands = useMemo(() => [...new Set(items.map((i) => i.brand))].sort(), [items]);

  const shown = useMemo(() => {
    const r = items.filter(
      (i) =>
        (!cat.length || cat.includes(i.category)) &&
        (!brand.length || brand.includes(i.brand)) &&
        (!grade.length || grade.includes(i.grade)) &&
        (!state.length || state.includes(i.state)) &&
        (!verifiedOnly || i.verified) &&
        (!price.length ||
          price.some((p) => {
            const b = priceBands.find((x) => x.id === p)!;
            return i.price >= b.min && i.price < b.max;
          })),
    );
    if (sort === "price-asc") r.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") r.sort((a, b) => b.price - a.price);
    if (sort === "rating") r.sort((a, b) => b.rating - a.rating);
    return r;
  }, [items, cat, brand, grade, price, state, verifiedOnly, sort]);

  const active = cat.length + brand.length + grade.length + price.length + state.length + (verifiedOnly ? 1 : 0);
  const reset = () => {
    setCat([]);
    setBrand([]);
    setGrade([]);
    setPrice([]);
    setState([]);
    setVerifiedOnly(false);
  };

  const filters = (
    <div className="divide-y divide-line">
      {showCategory && (
        <FilterGroup
          title="Category"
          options={categories.map((c) => [c.slug, c.name])}
          value={cat}
          onChange={setCat}
        />
      )}
      <FilterGroup title="Brand" options={brands.map((b) => [b, b])} value={brand} onChange={setBrand} />
      <FilterGroup title="Condition" options={grades.map((g) => [g.id, g.name])} value={grade} onChange={setGrade} />
      <FilterGroup title="Price" options={priceBands.map((p) => [p.id, p.label])} value={price} onChange={setPrice} />
      <FilterGroup title="Location" options={states.map((s) => [s, s])} value={state} onChange={setState} />
      <div className="py-5">
        <label className="flex cursor-pointer items-center justify-between text-[15px] font-bold">
          Verified sellers only
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <div className="flex items-center justify-between pb-2">
            <p className="text-[18px] font-bold">Filters</p>
            {active > 0 && (
              <button onClick={reset} className="text-[13px] font-bold underline underline-offset-4">
                Reset
              </button>
            )}
          </div>
          {filters}
        </div>
      </aside>

      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-[14px] text-ink-2">
            <span className="font-bold text-ink">{shown.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(true)} className="btn btn-outline lg:hidden">
              <Icon name="filter" size={18} /> Filters{active ? ` (${active})` : ""}
            </button>
            <label className="flex items-center gap-2 text-[14px]">
              <span className="hidden text-ink-2 sm:inline">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-line bg-white px-4 py-2 font-bold">
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
        </div>

        {shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((l) => (
              <ProductCard key={l.id} item={l} />
            ))}
          </div>
        ) : (
          <div className="rounded-tile bg-stage px-6 py-16 text-center">
            <p className="text-[18px] font-bold">Nothing matches those filters yet.</p>
            <p className="mt-2 text-[14px] text-ink-2">New graded stock lands every day. Try widening your search.</p>
            <button onClick={reset} className="btn btn-primary mt-6">
              Reset filters
            </button>
          </div>
        )}
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setPanel(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[20px] bg-white px-4 pb-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Filters"
          >
            <div className="sticky top-0 flex items-center justify-between bg-white py-4">
              <p className="text-[18px] font-bold">Filters</p>
              <button aria-label="Close filters" onClick={() => setPanel(false)}>
                <Icon name="close" />
              </button>
            </div>
            {filters}
            <div className="sticky bottom-0 flex gap-3 bg-white pt-4">
              <button onClick={reset} className="btn btn-outline flex-1">
                Reset
              </button>
              <button onClick={() => setPanel(false)} className="btn btn-primary flex-1">
                Show {shown.length} results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: [string, string][];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="py-5">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-[15px] font-bold">
        {title}
        <Icon name="chevronDown" size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-4 space-y-3">
          {options.map(([id, label]) => (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  checked={value.includes(id)}
                  onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((v) => v !== id))}
                  className="h-[18px] w-[18px] accent-[var(--accent)]"
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
