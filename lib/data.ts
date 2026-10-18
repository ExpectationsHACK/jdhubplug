import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getAggregate, getRatingSummaries, listPublishedReviews, summarize, toPublicReview, type PublicReview } from "./reviews";
import { getOffer, getOfferStats, getProduct, getSettings, listProducts } from "./store";
import type { Product, RatingSummary } from "./types";

// Cached reads for the storefront. Every function is tagged so admin edits and
// purchases can refresh the site immediately (see lib/revalidate.ts).
//
// Pages that render the current time or per-visitor data must do so outside these
// cached functions (e.g. offer countdowns run on the client).

export const TAGS = {
  catalog: "catalog",
  settings: "settings",
  offers: "offers",
  reviews: "reviews",
} as const;

/**
 * Storefront copy of a product: legacy seeded rating fields are zeroed and the real
 * published-review summary for its model is attached (undefined when there are none).
 */
function withRatings(p: Product, summaries: Record<string, RatingSummary>): Product {
  const ratingSummary = summaries[p.model];
  return { ...p, rating: 0, reviews: 0, ...(ratingSummary ? { ratingSummary } : {}) };
}

/** Products visible on the storefront (status "active"), newest first. Includes sold-out items. */
export async function getCatalog(): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.reviews);
  cacheLife("minutes");
  const [products, summaries] = await Promise.all([listProducts(), getRatingSummaries()]);
  return products.filter((p) => p.status === "active").map((p) => withRatings(p, summaries));
}

/** One storefront product, or null if it doesn't exist or isn't active. */
export async function getCatalogProduct(id: string): Promise<Product | null> {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.reviews);
  cacheLife("minutes");
  const p = await getProduct(id);
  if (!p || p.status !== "active") return null;
  const summary = summarize(await getAggregate(p.model));
  return withRatings(p, summary ? { [p.model]: summary } : {});
}

/** Published reviews of a model (newest first, at most 200) and their star distribution. */
export async function getModelReviews(model: string): Promise<{ reviews: PublicReview[]; dist: number[]; summary?: RatingSummary }> {
  "use cache";
  cacheTag(TAGS.reviews);
  cacheLife("minutes");
  const [reviews, agg] = await Promise.all([listPublishedReviews(model), getAggregate(model)]);
  return { reviews: reviews.slice(0, 200).map(toPublicReview), dist: agg.dist, summary: summarize(agg) };
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
