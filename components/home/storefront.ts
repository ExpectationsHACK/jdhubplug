import "server-only";

import { categories } from "@/lib/catalog";
import { getCatalog, getStoreSettings } from "@/lib/data";
import type { CategorySlug, Product, Settings } from "@/lib/types";

// Storefront view of the live catalog: what shoppers may see, in the order they
// should see it. Every public page lists products through these helpers so
// `settings.hideSoldOut` and the "sold out sorts last" rule apply everywhere.

/** In-stock first, otherwise keep catalog order (newest first). Stable. */
export function inStockFirst<T extends Pick<Product, "stock">>(items: T[]): T[] {
  return items
    .map((p, i) => [p, i] as const)
    .sort(([a, i], [b, j]) => Number(b.stock > 0) - Number(a.stock > 0) || i - j)
    .map(([p]) => p);
}

/** Apply the sold-out visibility setting and ordering to a product list. */
export function visible(items: Product[], settings: Pick<Settings, "hideSoldOut">): Product[] {
  return inStockFirst(settings.hideSoldOut ? items.filter((p) => p.stock > 0) : items);
}

/** The live catalog and settings, already filtered for the storefront. */
export async function getStorefront() {
  const [all, settings] = await Promise.all([getCatalog(), getStoreSettings()]);
  return { products: visible(all, settings), settings };
}

/**
 * One card per model: the representative unit of each model in a category (a
 * featured or in-stock unit wins), in catalog order. Used for showcases.
 */
export function modelReps(items: Product[], slug?: CategorySlug): Product[] {
  const byModel = new Map<string, Product>();
  for (const p of items) {
    if (slug && p.category !== slug) continue;
    const cur = byModel.get(p.model);
    if (!cur || score(p) > score(cur)) byModel.set(p.model, p);
  }
  // Keep the order in which each model first appears in the list.
  const order = new Map<string, number>();
  items.forEach((p, i) => order.has(p.model) || order.set(p.model, i));
  return inStockFirst([...byModel.values()].sort((a, b) => order.get(a.model)! - order.get(b.model)!));
}

const score = (p: Product) => (p.stock > 0 ? 4 : 0) + (p.featured ? 2 : 0) + (p.imageUrl || p.photo ? 1 : 0);

export const featuredIn = (items: Product[], slug: CategorySlug, n: number) => modelReps(items, slug).slice(0, n);

/**
 * Products for the home hero ring: the admin's pick (settings.heroProductIds) when
 * set, otherwise featured and high-value in-stock models with photos, interleaved
 * across categories so the ring shows the whole range.
 */
export function heroProducts(items: Product[], settings: Pick<Settings, "heroProductIds">, n = 10): Product[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  const picked = settings.heroProductIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  if (picked.length >= 6) return picked.slice(0, 12);

  const withPhoto = items.filter((p) => p.stock > 0 && (p.imageUrl || p.photo) && !picked.includes(p));
  const lanes = categories.map((c) =>
    modelReps(withPhoto, c.slug).sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.price - a.price),
  );
  // Phones lead, so give them a double share of the ring.
  const pattern: number[] = [0, 2, 0, 3, 1, 0, 2, 3, 0, 1, 2, 0];
  const out = [...picked];
  const cursor = lanes.map(() => 0);
  for (let k = 0; out.length < n && k < 48; k++) {
    const lane = pattern[k % pattern.length];
    const p = lanes[lane][cursor[lane]++];
    if (p) out.push(p);
  }
  return out.slice(0, n);
}

/** Slim product shape for client components that don't need the full record. */
export type SlimProduct = Pick<
  Product,
  "id" | "name" | "brand" | "spec" | "price" | "photo" | "imageUrl" | "art" | "tint" | "category" | "stock"
>;

export const slim = (p: Product): SlimProduct => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  spec: p.spec,
  price: p.price,
  photo: p.photo,
  imageUrl: p.imageUrl,
  art: p.art,
  tint: p.tint,
  category: p.category,
  stock: p.stock,
});

/** Category reference data that the client header needs. */
export type NavCategory = { slug: CategorySlug; name: string; brands: string[]; featured: SlimProduct[] };

export function navCategories(items: Product[]): NavCategory[] {
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    brands: c.brands,
    featured: featuredIn(items, c.slug, 4).map(slim),
  }));
}
