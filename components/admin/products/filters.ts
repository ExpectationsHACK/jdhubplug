// Products list view state (filters, sort, page). Plain module so the server page can
// read the URL into the same shape the client table uses.

import type { CategorySlug, Grade, ProductStatus } from "@/lib/types";
import { CATEGORY_OPTIONS, GRADE_OPTIONS, STATUS_OPTIONS, type StockState } from "./validate";

export type SortKey = "newest" | "oldest" | "updated" | "price-desc" | "price-asc" | "stock-asc" | "stock-desc" | "sold" | "name";

export type Filters = {
  q: string;
  status: "" | ProductStatus;
  stock: "" | StockState;
  category: "" | CategorySlug;
  brand: string;
  grade: "" | Grade;
  sort: SortKey;
  page: number;
};

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "stock-asc", label: "Stock: low to high" },
  { value: "stock-desc", label: "Stock: high to low" },
  { value: "sold", label: "Best selling" },
  { value: "name", label: "Name A–Z" },
];

export const EMPTY_FILTERS: Filters = { q: "", status: "", stock: "", category: "", brand: "", grade: "", sort: "newest", page: 1 };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Read list filters from URL search params, ignoring anything unexpected. */
export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const pick = <T extends string>(v: string, allowed: readonly T[]): T | "" => (allowed.includes(v as T) ? (v as T) : "");
  const page = Number(one(sp.page));
  return {
    ...EMPTY_FILTERS,
    q: one(sp.q).slice(0, 100),
    status: pick(one(sp.status), STATUS_OPTIONS.map((s) => s.value)),
    stock: pick(one(sp.stock), ["in", "low", "out"] as const),
    category: pick(one(sp.category), CATEGORY_OPTIONS.map((c) => c.value)),
    brand: one(sp.brand).slice(0, 60),
    grade: pick(one(sp.grade), GRADE_OPTIONS.map((g) => g.value)),
    sort: pick(one(sp.sort), SORTS.map((s) => s.value)) || "newest",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Filters → "?q=…&stock=low" (empty string when everything is default). */
export function toQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  for (const k of ["status", "stock", "category", "brand", "grade"] as const) if (f[k]) p.set(k, f[k]);
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
