// Review types and pure helpers. Isomorphic: safe for client components, the server
// and scripts. Storage and eligibility live in lib/reviews.ts (server only).

import type { Order, OrderStatus, RatingSummary } from "./types";

export type { RatingSummary };

export type ReviewStatus = "pending" | "published" | "hidden";

export type Review = {
  id: string;
  /** Model slug (Product.model). Every unit of a model shares its reviews. */
  productModel: string;
  /** The unit that was bought. */
  productId: string;
  /** Line name at the time of purchase, for the admin queue. */
  productName: string;
  orderId: string;
  customerId?: string;
  /** Shown publicly: first name + last initial, derived from the order, e.g. "Ada O." */
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  status: ReviewStatus;
  adminReply?: { text: string; at: string; by: string };
  /** Always true: reviews can only be written from a delivered order. */
  verified: true;
  moderatedBy?: string;
  moderatedAt?: string;
};

/** What the storefront may show: no order, customer or staff details. */
export type PublicReview = Pick<Review, "id" | "name" | "rating" | "title" | "body" | "createdAt" | "verified"> & {
  reply?: { text: string; at: string };
};

export const toPublicReview = (r: Review): PublicReview => ({
  id: r.id,
  name: r.name,
  rating: r.rating,
  title: r.title,
  body: r.body,
  createdAt: r.createdAt,
  verified: true,
  ...(r.adminReply ? { reply: { text: r.adminReply.text, at: r.adminReply.at } } : {}),
});

/** Stored aggregate for one model: published reviews only. */
export type ReviewAggregate = {
  count: number;
  sum: number;
  /** dist[0] = number of 1-star reviews … dist[4] = 5-star. */
  dist: [number, number, number, number, number];
};

export type ReviewSettings = {
  /** Publish new reviews immediately instead of holding them for moderation. */
  autoPublish: boolean;
};

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = { autoPublish: false };

/** Order statuses whose lines may be reviewed: the buyer has the item. */
export const REVIEWABLE_STATUSES: OrderStatus[] = ["delivered", "completed"];

export const isReviewable = (status: OrderStatus) => REVIEWABLE_STATUSES.includes(status);

export const REVIEW_LIMITS = { title: 80, bodyMin: 10, body: 1500, reply: 1000 } as const;

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Awaiting approval",
  published: "Published",
  hidden: "Hidden",
};

export const emptyAggregate = (): ReviewAggregate => ({ count: 0, sum: 0, dist: [0, 0, 0, 0, 0] });

/** Public summary of an aggregate, or undefined when there are no published reviews. */
export function summarize(a: ReviewAggregate | null | undefined): RatingSummary | undefined {
  if (!a || a.count <= 0) return undefined;
  return { count: a.count, average: Math.round((a.sum / a.count) * 10) / 10 };
}

// Control characters (keeping \n and \t in bodies), bidi overrides and zero-width
// characters that could disguise text. React escapes everything else on render.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g;

/** One-line text: control characters removed, whitespace collapsed, trimmed and capped. */
export function cleanLine(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input.replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Multi-line text: control characters removed, at most one blank line in a row, capped. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/\t/g, " ")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** "Ada Okafor" → "Ada O.", "ada" → "Ada". Never more than first name + initial. */
export function displayName(full: string): string {
  const parts = cleanLine(full, 120)
    .split(" ")
    .map((p) => p.replace(/[^\p{L}\p{M}'-]/gu, ""))
    .filter(Boolean);
  if (!parts.length) return "Verified buyer";
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase("en-NG") + s.slice(1);
  const first = cap(parts[0].slice(0, 24));
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toLocaleUpperCase("en-NG") : "";
  return last ? `${first} ${last}.` : first;
}

/** Path on this site where the buyer of `order` can rate its items (token-verified, works for guests). */
export function reviewPathFor(order: Pick<Order, "id" | "token">, productId?: string) {
  return `/order/${encodeURIComponent(order.id)}?t=${encodeURIComponent(order.token)}#${productId ? reviewAnchor(productId) : "review"}`;
}

/**
 * Absolute "Rate your purchase" link for an order, for the delivered email/SMS.
 * Only meaningful once the order is delivered or completed (see isReviewable).
 */
export function reviewLinkFor(order: Pick<Order, "id" | "token">, origin = process.env.NEXT_PUBLIC_SITE_URL || "https://jdhub.ng") {
  return `${origin.replace(/\/+$/, "")}${reviewPathFor(order)}`;
}

export const reviewAnchor = (productId: string) => `review-${productId.replace(/[^A-Za-z0-9_-]/g, "")}`;

export const starsLabel = (rating: number) => `${rating} out of 5 stars`;
