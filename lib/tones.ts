// Colour tones: one colour per category and storefront area. The colours themselves
// live in app/globals.css (--c-*); a container opts in with data-tone={tone} and the
// tone-* classes (tone-badge, tone-card, tone-chip, aurora) pick them up. Isomorphic.

import type { IconName } from "@/components/Icon";
import type { CategorySlug } from "./types";

export type Tone = CategorySlug | "sell" | "swap" | "trust" | "offers";

export const TONE_ICON: Record<Tone, IconName> = {
  phones: "smartphone",
  accessories: "headphones",
  gadgets: "laptop",
  cars: "car",
  sell: "wallet",
  swap: "swap",
  trust: "shield",
  offers: "tag",
};

export const TONE_LABEL: Record<Tone, string> = {
  phones: "Phones",
  accessories: "Accessories",
  gadgets: "Gadgets",
  cars: "Cars",
  sell: "Sell",
  swap: "Swap",
  trust: "Trust",
  offers: "Offers",
};

/** The tone for a product category, with a safe fallback for unknown values. */
export const toneOf = (category: string): Tone => (category in TONE_ICON ? (category as Tone) : "phones");

/** For rows of feature tiles: a different colour per tile, in a pleasing order. */
const CYCLE: Tone[] = ["phones", "sell", "accessories", "swap", "gadgets", "cars", "trust", "offers"];
export const toneAt = (i: number): Tone => CYCLE[i % CYCLE.length];
