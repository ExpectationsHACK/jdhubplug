import "server-only";

import {
  cleanLine,
  cleanText,
  DEFAULT_REVIEW_SETTINGS,
  displayName,
  emptyAggregate,
  isReviewable,
  REVIEW_LIMITS,
  summarize,
  type Review,
  type ReviewAggregate,
  type ReviewSettings,
  type ReviewStatus,
} from "./reviews-shared";
import { getDriver } from "./store/driver";
import { getOrder, getProduct, rateLimit, withLock } from "./store";
import type { Order, RatingSummary } from "./types";

// Verified-purchase reviews. Only the buyer of a delivered (or completed) order line
// can review it, once. Reviews attach to the model slug (Product.model) so every unit
// of a model shares them. Aggregates only count published reviews and are kept in
// step on every status change.
//
// Data layout:
//   jd:reviews:items     hash  id -> Review JSON
//   jd:reviews:line      hash  "{orderId}:{productId}" -> review id (one review per order line)
//   jd:reviews:agg       hash  model slug -> ReviewAggregate JSON (published only)
//   jd:reviews:settings  string ReviewSettings JSON
//   jd:reviews:seq       counter for review ids

export * from "./reviews-shared";

const K = {
  items: "jd:reviews:items",
  line: "jd:reviews:line",
  agg: "jd:reviews:agg",
  settings: "jd:reviews:settings",
  seq: "jd:reviews:seq",
};

const parse = <T>(s: string | null | undefined): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

const lineKey = (orderId: string, productId: string) => `${orderId.toUpperCase()}:${productId}`;

// ------------------------------------------------------------------ Settings

export async function getReviewSettings(): Promise<ReviewSettings> {
  return { ...DEFAULT_REVIEW_SETTINGS, ...(parse<Partial<ReviewSettings>>(await getDriver().get(K.settings)) ?? {}) };
}

export async function saveReviewSettings(s: ReviewSettings) {
  await getDriver().set(K.settings, JSON.stringify({ autoPublish: !!s.autoPublish }));
}

// --------------------------------------------------------------------- Reads

export async function getReview(id: string): Promise<Review | null> {
  return parse<Review>(await getDriver().hget(K.items, id));
}

/** Every review (any status), newest first. */
export async function listReviews(): Promise<Review[]> {
  const all = await getDriver().hgetall(K.items);
  return Object.values(all)
    .map((j) => parse<Review>(j))
    .filter((r): r is Review => !!r)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Published reviews of one model, newest first. */
export async function listPublishedReviews(model: string): Promise<Review[]> {
  return (await listReviews()).filter((r) => r.status === "published" && r.productModel === model);
}

/** Reviews already written for order lines, keyed by "{orderId}:{productId}". */
export async function reviewsForLines(lines: { orderId: string; productId: string }[]): Promise<Map<string, Review>> {
  const out = new Map<string, Review>();
  if (!lines.length) return out;
  const d = getDriver();
  const keys = [...new Set(lines.map((l) => lineKey(l.orderId, l.productId)))];
  const ids = await d.hmget(K.line, keys);
  const found = keys.map((k, i) => [k, ids[i]] as const).filter((x): x is readonly [string, string] => !!x[1]);
  if (!found.length) return out;
  const json = await d.hmget(K.items, found.map(([, id]) => id));
  found.forEach(([k], i) => {
    const r = parse<Review>(json[i]);
    if (r) out.set(k, r);
  });
  return out;
}

export const reviewKeyFor = lineKey;

export async function getAggregate(model: string): Promise<ReviewAggregate> {
  return parse<ReviewAggregate>(await getDriver().hget(K.agg, model)) ?? emptyAggregate();
}

/** Published-review summaries for every model that has at least one. */
export async function getRatingSummaries(): Promise<Record<string, RatingSummary>> {
  const all = await getDriver().hgetall(K.agg);
  const out: Record<string, RatingSummary> = {};
  for (const [model, json] of Object.entries(all)) {
    const s = summarize(parse<ReviewAggregate>(json));
    if (s) out[model] = s;
  }
  return out;
}

// ------------------------------------------------------------- Eligibility

export type LineEligibility =
  | { ok: true; order: Order; line: Order["lines"][number] }
  | { ok: false; error: string; existing?: Review };

/** Can this order line be reviewed now? Checks the order, its status and duplicates. */
export async function checkEligibility(order: Order | null, productId: string): Promise<LineEligibility> {
  if (!order) return { ok: false, error: "Order not found." };
  const line = order.lines.find((l) => l.productId === productId);
  if (!line) return { ok: false, error: "That item isn't part of this order." };
  if (!isReviewable(order.status)) {
    return { ok: false, error: "You can rate this item once it has been delivered." };
  }
  const existing = (await reviewsForLines([{ orderId: order.id, productId }])).get(lineKey(order.id, productId));
  if (existing) return { ok: false, error: "You've already reviewed this item. Thank you!", existing };
  return { ok: true, order, line };
}

// -------------------------------------------------------------------- Writes

export type ReviewInput = {
  orderId: string;
  /** The order's secret token (from the customer link). Required. */
  token: string;
  productId: string;
  rating: unknown;
  title: unknown;
  body: unknown;
  /** Signed-in customer, if any (from getCurrentCustomer(), never from the client). */
  customerId?: string;
};

export type SubmitResult = { ok: true; review: Review } | { ok: false; error: string; field?: "rating" | "title" | "body" };

/** Validate and store a review for a delivered order line. */
export async function submitReview(input: ReviewInput): Promise<SubmitResult> {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose a star rating from 1 to 5.", field: "rating" };
  // Clean without a cap first, so over-long input is rejected rather than silently cut.
  const title = cleanLine(input.title, 10_000);
  const body = cleanText(input.body, 100_000);
  if (title.length > REVIEW_LIMITS.title) {
    return { ok: false, error: `Keep the headline under ${REVIEW_LIMITS.title} characters.`, field: "title" };
  }
  if (body.length > REVIEW_LIMITS.body) {
    return { ok: false, error: `Keep your review under ${REVIEW_LIMITS.body} characters.`, field: "body" };
  }
  if (body.length < REVIEW_LIMITS.bodyMin) {
    return { ok: false, error: `Tell other buyers a little more (at least ${REVIEW_LIMITS.bodyMin} characters).`, field: "body" };
  }

  const order = await getOrder(input.orderId);
  if (!order || !input.token || order.token !== input.token) return { ok: false, error: "Order not found." };
  // Per order: enough for a large basket, not enough to hammer the store.
  if (!(await rateLimit(`review:order:${order.id}`, 20, 3600))) {
    return { ok: false, error: "Too many attempts. Please try again in an hour." };
  }

  return withLock(`review:line:${lineKey(order.id, input.productId)}`, async () => {
    const fresh = await getOrder(order.id);
    const check = await checkEligibility(fresh, input.productId);
    if (!check.ok) return { ok: false as const, error: check.error };
    const product = await getProduct(input.productId);
    if (!product) return { ok: false as const, error: "This item is no longer listed, so it can't be reviewed." };

    const settings = await getReviewSettings();
    const now = new Date().toISOString();
    const d = getDriver();
    const id = `rv_${(await d.incr(K.seq)).toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const review: Review = {
      id,
      productModel: product.model,
      productId: product.id,
      productName: check.line.name,
      orderId: check.order.id,
      ...(input.customerId || check.order.customerId ? { customerId: input.customerId || check.order.customerId } : {}),
      name: displayName(check.order.customer.name),
      rating: rating as Review["rating"],
      title,
      body,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      verified: true,
    };
    await d.hset(K.items, { [id]: JSON.stringify(review) });
    await d.hset(K.line, { [lineKey(review.orderId, review.productId)]: id });
    if (settings.autoPublish) {
      const published = await setReviewStatus(id, "published", "auto-publish");
      return { ok: true as const, review: published ?? review };
    }
    return { ok: true as const, review };
  });
}

/** Apply a status change to an aggregate. Returns a new aggregate. */
export function applyToAggregate(a: ReviewAggregate, rating: number, from: ReviewStatus, to: ReviewStatus): ReviewAggregate {
  const was = from === "published";
  const now = to === "published";
  if (was === now) return a;
  const sign = now ? 1 : -1;
  const dist = [...a.dist] as ReviewAggregate["dist"];
  dist[rating - 1] = Math.max(0, dist[rating - 1] + sign);
  const count = Math.max(0, a.count + sign);
  return { count, sum: count ? Math.max(0, a.sum + sign * rating) : 0, dist };
}

/**
 * Publish, hide or return a review to pending, keeping the model's aggregate in step.
 * Idempotent: setting the current status again changes nothing. Returns null if missing.
 */
export async function setReviewStatus(id: string, status: ReviewStatus, by: string): Promise<Review | null> {
  return withLock(`review:${id}`, async () => {
    const r = await getReview(id);
    if (!r) return null;
    if (r.status === status) return r;
    const updated: Review = { ...r, status, updatedAt: new Date().toISOString(), moderatedBy: by, moderatedAt: new Date().toISOString() };
    await withLock(`review:agg:${r.productModel}`, async () => {
      const d = getDriver();
      const next = applyToAggregate(await getAggregate(r.productModel), r.rating, r.status, status);
      await d.hset(K.items, { [id]: JSON.stringify(updated) });
      if (next.count) await d.hset(K.agg, { [r.productModel]: JSON.stringify(next) });
      else await d.hdel(K.agg, [r.productModel]);
    });
    return updated;
  });
}

/** Set (or clear, with empty text) the store's public reply to a review. */
export async function setReviewReply(id: string, text: string, by: string): Promise<Review | null> {
  return withLock(`review:${id}`, async () => {
    const r = await getReview(id);
    if (!r) return null;
    const clean = cleanText(text, REVIEW_LIMITS.reply);
    const updated: Review = { ...r, updatedAt: new Date().toISOString() };
    if (clean) updated.adminReply = { text: clean, at: new Date().toISOString(), by };
    else delete updated.adminReply;
    await getDriver().hset(K.items, { [id]: JSON.stringify(updated) });
    return updated;
  });
}

/** Recompute every model's aggregate from the stored reviews (repair tool). */
export async function rebuildAggregates(): Promise<number> {
  const d = getDriver();
  const byModel = new Map<string, ReviewAggregate>();
  for (const r of await listReviews()) {
    byModel.set(r.productModel, applyToAggregate(byModel.get(r.productModel) ?? emptyAggregate(), r.rating, "hidden", r.status));
  }
  const stale = Object.keys(await d.hgetall(K.agg)).filter((m) => !byModel.get(m)?.count);
  if (stale.length) await d.hdel(K.agg, stale);
  const live = [...byModel].filter(([, a]) => a.count > 0);
  if (live.length) await d.hset(K.agg, Object.fromEntries(live.map(([m, a]) => [m, JSON.stringify(a)])));
  return live.length;
}
