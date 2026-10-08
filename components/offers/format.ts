// Small isomorphic helpers shared by the offer landing page, the offer client
// components and the admin offer screens. No heavy imports, so client bundles stay lean.

import type { Offer, OfferState } from "@/lib/types";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** ₦1,185,000 */
export const formatNaira = (n: number) => naira.format(n);

/** Fields of an offer that are safe to show the public (no stats, no internal flags). */
export type PublicOffer = Pick<
  Offer,
  "code" | "title" | "headline" | "description" | "discount" | "scope" | "startsAt" | "endsAt" | "minSubtotal"
>;

export type PublicOfferPayload = { offer: PublicOffer; state: OfferState };

export function toPublicOffer(o: Offer): PublicOffer {
  return {
    code: o.code,
    title: o.title,
    headline: o.headline,
    description: o.description,
    discount: o.discount,
    scope: o.scope,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    ...(o.minSubtotal ? { minSubtotal: o.minSubtotal } : {}),
  };
}

/** Rebuild an Offer-shaped object from public fields so lib/pricing helpers accept it. */
export function fromPublicOffer(p: PublicOffer, state: OfferState): Offer {
  return { ...p, active: state !== "paused", createdAt: "", updatedAt: "" };
}

/** "2d 4h", "3h 12m", "8m", "under a minute". */
export function shortDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min}m`;
  return "under a minute";
}

/** Date and time in Lagos, e.g. "12 Oct 2026, 09:00". */
export function lagosDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** ₦450k, ₦1.2m: for tight spaces like badges. */
export function compactNaira(n: number): string {
  if (n >= 1_000_000) return `₦${+(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}m`;
  if (n >= 1_000) return `₦${+(n / 1_000).toFixed(n % 1_000 && n < 10_000 ? 1 : 0)}k`;
  return `₦${n}`;
}

/** Two-line sticker text for a discount, e.g. { main: "15%", sub: "off" }. */
export function discountSticker(d: Offer["discount"]): { main: string; sub: string } {
  if (d.type === "percent") return { main: `${d.value}%`, sub: "off" };
  if (d.type === "fixed") return { main: compactNaira(d.value), sub: "off" };
  return { main: compactNaira(d.value), sub: "flash price" };
}

export const STATE_LABEL: Record<OfferState, string> = {
  scheduled: "Scheduled",
  live: "Live",
  expired: "Expired",
  paused: "Paused",
  exhausted: "Sold out",
};
