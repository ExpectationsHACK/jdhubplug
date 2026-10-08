import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getOffer, getOfferStats, getProduct, getSettings, listProducts } from "./store";
import type { Product } from "./types";

// Cached reads for the storefront. Every function is tagged so admin edits and
// purchases can refresh the site immediately (see lib/revalidate.ts).
//
// Pages that render the current time or per-visitor data must do so outside these
// cached functions (e.g. offer countdowns run on the client).

export const TAGS = {
  catalog: "catalog",
  settings: "settings",
  offers: "offers",
} as const;

/** Products visible on the storefront (status "active"), newest first. Includes sold-out items. */
export async function getCatalog(): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("minutes");
  return (await listProducts()).filter((p) => p.status === "active");
}

/** One storefront product, or null if it doesn't exist or isn't active. */
export async function getCatalogProduct(id: string): Promise<Product | null> {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("minutes");
  const p = await getProduct(id);
  return p && p.status === "active" ? p : null;
}

export async function getStoreSettings() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("minutes");
  return getSettings();
}

/** An offer and its usage stats, regardless of whether it's live (check with offerState). */
export async function getPublicOffer(code: string) {
  "use cache";
  cacheTag(TAGS.offers);
  cacheLife("minutes");
  const offer = await getOffer(code);
  if (!offer) return null;
  return { offer, stats: await getOfferStats(offer.code) };
}
