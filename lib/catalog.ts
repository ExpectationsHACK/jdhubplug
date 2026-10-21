import { models } from "./models";
import { photoPage as commonsPage, photoUrl as commonsUrl } from "./photos";

// JDHub reference data: categories, grades, states, trade-in pricing, and the seed
// generator that turns `models.ts` into the initial product catalog. The live catalog
// lives in the store (see lib/store) and is edited from /admin.

import { getCategory } from "./reference";
import { storeSellerFor } from "./seller";
import type { CategorySlug, Grade, Product } from "./types";

export * from "./reference";
export { getCategory };

export type { ArtKind, Category, CategorySlug, Grade, Listing, Product } from "./types";

// Every seeded listing is JDHub's own stock, shipped from one of its hubs. No invented
// third-party sellers, ratings, review counts or sales badges.
const hubStates = ["Lagos", "Abuja (FCT)", "Rivers"];

const gradeCycle: Grade[] = ["like-new", "great", "good", "great", "fair", "like-new", "good"];
const gradePrice: Record<Grade, number> = { "like-new": 1.08, great: 1, good: 0.9, fair: 0.8 };
const batteryRange: Record<Grade, [number, number]> = { "like-new": [92, 100], great: [86, 91], good: [80, 85], fair: [76, 79] };

/** Deterministic PRNG so every build produces the same catalog. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const round = (n: number, to: number) => Math.round(n / to) * to;

const SEED_TIME = Date.UTC(2026, 9, 1, 9, 0, 0);

/** Units in stock for a freshly seeded listing: used phones and cars are one-offs. */
function seedStock(category: CategorySlug, r: () => number) {
  if (category === "accessories") return 3 + Math.floor(r() * 6);
  if (category === "gadgets") return 1 + Math.floor(r() * 3);
  return 1;
}

export function buildSeedProducts(): Product[] {
  const out: Product[] = [];
  let n = 0;
  for (const m of models) {
    const r = rng(m.slug);
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    for (let i = 0; i < m.stock; i++) {
      // The first unit of each model is the one showcased on the home page, so keep it top-grade.
      const cycled = gradeCycle[(i + Math.floor(r() * gradeCycle.length)) % gradeCycle.length];
      const grade: Grade = i === 0 ? (r() < 0.5 ? "like-new" : "great") : cycled;
      const tier = m.tiers?.[i % m.tiers.length];
      const color = m.colors?.[(i + 1) % m.colors.length];
      const isCar = m.category === "cars";
      const state = m.car && i === 0 ? "Lagos" : pick(hubStates);
      const seller = storeSellerFor(m.category);
      const price = round((m.price + (tier?.add ?? 0)) * gradePrice[grade] * (0.97 + r() * 0.06), isCar ? 50_000 : 5_000);
      const onOffer = r() < 0.2;
      // Only show a compare-at price when rounding leaves it above the selling price.
      const wasPrice = round(price * 1.08, isCar ? 50_000 : 5_000);
      const was = onOffer && wasPrice > price ? wasPrice : undefined;

      let spec: string;
      let attrs: Record<string, string>;
      let name = m.name;
      if (m.car) {
        const km = round(m.car.km[0] + r() * (m.car.km[1] - m.car.km[0]), 100);
        name = `${m.name} ${m.car.year}`;
        spec = `${km.toLocaleString("en-NG")} km · Automatic · ${m.car.origin}`;
        attrs = {
          Year: String(m.car.year),
          Mileage: `${km.toLocaleString("en-NG")} km`,
          Engine: m.car.engine,
          Transmission: "Automatic",
          Origin: m.car.origin,
          VIN: "Clean history · checked",
          Inspection: grade === "fair" ? "Booked at JDHub Auto hub" : "152-point passed",
        };
      } else if (m.category === "phones") {
        const [lo, hi] = batteryRange[grade];
        const battery = Math.floor(lo + r() * (hi - lo + 1));
        spec = [tier?.label, color, `Battery ${battery}%`].filter(Boolean).join(" · ");
        attrs = {
          Storage: tier?.label ?? "",
          Colour: color ?? "",
          "Battery health": `${battery}%`,
          IMEI: "Clean · checked",
          Network: "Factory unlocked",
        };
      } else {
        spec = [tier?.label ?? m.spec, color].filter(Boolean).join(" · ");
        attrs = { ...(tier ? { Configuration: tier.label } : {}), ...(color ? { Colour: color } : {}), ...m.attrs };
      }

      out.push({
        id: `${m.slug}-${i + 1}`,
        model: m.slug,
        category: m.category,
        brand: m.brand,
        name,
        spec,
        price,
        was,
        grade,
        state,
        seller,
        verified: true,
        // Real ratings come from verified-purchase reviews (lib/reviews.ts), never the seed.
        rating: 0,
        reviews: 0,
        art: m.art,
        tint: m.tint,
        photo: m.photo,
        badge: was ? "Hot deal" : undefined,
        attrs,
        stock: seedStock(m.category, r),
        sold: 0,
        status: "active",
        featured: i === 0 && r() < 0.25,
        createdAt: new Date(SEED_TIME - n * 60_000).toISOString(),
        updatedAt: new Date(SEED_TIME - n * 60_000).toISOString(),
      });
      n++;
    }
  }
  return out;
}

/**
 * The seed catalog. Storefront code should read the live catalog from the store
 * (lib/data.ts); this export exists for the seed and for static reference only.
 */
export const listings: Product[] = buildSeedProducts();

export const photoUrl = commonsUrl;
export const photoPage = commonsPage;

export const getListing = (id: string) => listings.find((l) => l.id === id);
export const listingsIn = (slug: CategorySlug) => listings.filter((l) => l.category === slug);
/** First listing of each model, in catalog order: one card per model for showcases. */
export const featuredIn = (slug: CategorySlug, n: number) =>
  listings.filter((l) => l.category === slug && l.id.endsWith("-1")).slice(0, n);
