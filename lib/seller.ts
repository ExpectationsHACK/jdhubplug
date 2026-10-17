// Who sells a listing, and which badge it may honestly show. Isomorphic.
//
// Every listing is sold by JDHub itself. Early seed data invented third-party shop
// names, random "verified" marks and random "Best seller" badges; products already in
// the store keep those fields, so the storefront reads them through these helpers.

import type { Badge, CategorySlug, Product } from "./types";

export const STORE_SELLER = "JDHub Certified";
export const STORE_AUTO_SELLER = "JDHub Auto";

/** The store's own seller name for a category. */
export const storeSellerFor = (category: CategorySlug) => (category === "cars" ? STORE_AUTO_SELLER : STORE_SELLER);

/** Fictional shop names from the original seed. Never shown to buyers. */
const LEGACY_SEED_SELLERS = new Set(
  [
    "Ikeja Mobile Hub",
    "Lekki Tech Store",
    "Computer Village Plug",
    "Lens & Light",
    "Lekki Prestige Cars",
    "Wuse Accessories",
    "Game Zone Abuja",
    "Banex Gadgets",
    "Capital Autos",
    "PH Gadget Plug",
    "Garden City Motors",
    "Ibadan Phone Mart",
    "Kano Phones Plaza",
    "Farm Centre Gadgets",
    "Coal City Gadgets",
    "Ogui Road Autos",
  ].map((s) => s.toLowerCase()),
);

export type SellerInfo = { name: string; verified: boolean; isStore: boolean };

/** The seller to show for a product. Legacy fictional names resolve to the store itself. */
export function sellerOf(p: Pick<Product, "seller" | "verified" | "category">): SellerInfo {
  const name = p.seller?.trim();
  if (!name || LEGACY_SEED_SELLERS.has(name.toLowerCase())) return { name: storeSellerFor(p.category), verified: true, isStore: true };
  if (/^jdhub\b/i.test(name)) return { name, verified: true, isStore: true };
  return { name, verified: !!p.verified, isStore: false };
}

/**
 * The badge to show, or undefined. "Hot deal" needs a real compare-at price and
 * "Best seller" needs real sales, so stale or seeded badges never mislead.
 */
export function badgeOf(p: Pick<Product, "badge" | "price" | "was" | "sold">): Badge | undefined {
  if (p.badge === "Hot deal") return p.was && p.was > p.price ? "Hot deal" : undefined;
  if (p.badge === "Best seller") return p.sold > 0 ? "Best seller" : undefined;
  return p.badge;
}
