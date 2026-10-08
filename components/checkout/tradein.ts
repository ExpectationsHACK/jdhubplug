// Trade-in helpers shared by the sell estimator and the swap planner. Isomorphic.

import { models, type Model } from "@/lib/models";
import type { Product } from "@/lib/types";

/**
 * The seed catalog model that best matches a trade-in model name, for its photo.
 * Exact name first, then the closest sibling (e.g. "iPhone 12" -> "iPhone 12 Pro").
 */
export function tradeInModel(name: string): Model | undefined {
  const phones = models.filter((m) => m.category === "phones");
  const n = name.trim().toLowerCase();
  return (
    phones.find((m) => m.name.toLowerCase() === n) ??
    phones.find((m) => m.name.toLowerCase().startsWith(`${n} `)) ??
    phones.find((m) => n.startsWith(m.name.toLowerCase()))
  );
}

/** Props for <ProductImage> showing a trade-in model. */
export function tradeInImage(name: string): Pick<Product, "photo" | "imageUrl" | "art" | "tint" | "name"> {
  const m = tradeInModel(name);
  return { photo: m?.photo, art: m?.art ?? "phone", tint: m?.tint ?? "#2e4a6b", name };
}
