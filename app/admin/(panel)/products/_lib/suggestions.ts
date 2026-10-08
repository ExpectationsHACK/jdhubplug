import "server-only";

import { categories } from "@/lib/catalog";
import type { Product } from "@/lib/types";

/** Autocomplete values for the product form, drawn from the live catalog. */
export function formSuggestions(products: Product[]) {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    brands: uniq([...categories.flatMap((c) => c.brands), ...products.map((p) => p.brand)]),
    sellers: uniq(products.map((p) => p.seller)).slice(0, 200),
    models: uniq(products.map((p) => p.model)).slice(0, 500),
  };
}

/** Whether photo uploads (Vercel Blob) are configured. Server-side only. */
export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
