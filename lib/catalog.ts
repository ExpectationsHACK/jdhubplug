import { models } from "./models";
import { photoPage as commonsPage, photoUrl as commonsUrl } from "./photos";

// JDHub reference data: categories, grades, states, trade-in pricing, and the seed
// generator that turns `models.ts` into the initial product catalog. The live catalog
// lives in the store (see lib/store) and is edited from /admin.

import type { Category, CategorySlug, Grade, Product } from "./types";

export type { ArtKind, Category, CategorySlug, Grade, Listing, Product } from "./types";

export const categories: Category[] = [
  {
    slug: "phones",
    name: "Phones",
    tagline: "Graded. Checked. Guaranteed.",
    blurb: "iPhone and Android flagships, IMEI-checked and battery-tested before they list.",
    art: "phone",
    brands: ["Apple", "Samsung", "Google", "Tecno"],
  },
  {
    slug: "accessories",
    name: "Accessories",
    tagline: "The right fit, every time.",
    blurb: "Chargers, cases, earbuds and power banks, tagged for the devices they fit.",
    art: "earbuds",
    brands: ["Apple", "Samsung", "JBL", "Anker"],
  },
  {
    slug: "gadgets",
    name: "Gadgets",
    tagline: "Work. Play. Create.",
    blurb: "Laptops, tablets, watches, drones, consoles and cameras on one grading standard.",
    art: "laptop",
    brands: ["Apple", "Sony", "Microsoft", "DJI", "Canon", "Samsung", "Nintendo"],
  },
  {
    slug: "cars",
    name: "Cars",
    tagline: "Drive away with certainty.",
    blurb: "VIN-checked vehicles with inspection reports, financing and swap-up options.",
    art: "car",
    brands: ["Toyota", "Lexus", "Honda", "Mercedes-Benz", "Hyundai", "Kia", "Ford"],
  },
];

export const grades: { id: Grade; name: string; letter: string; summary: string; detail: string; carDetail: string }[] = [
  {
    id: "like-new",
    name: "Like New",
    letter: "A",
    summary: "No visible wear",
    detail: "Flawless screen and body. Battery health 90%+ (or equivalent for non-phones). Original parts only.",
    carDetail: "Showroom paint and interior, full service history, no accident record. Passed 152-point inspection.",
  },
  {
    id: "great",
    name: "Great",
    letter: "B",
    summary: "Light signs of use",
    detail: "Faint micro-scratches only visible up close. Fully functional. Battery health 85%+.",
    carDetail: "Minor stone chips or light interior wear. Mechanically sound with documented servicing.",
  },
  {
    id: "good",
    name: "Good",
    letter: "C",
    summary: "Visible wear",
    detail: "Noticeable scratches or scuffs on the body, screen clear when on. Fully functional.",
    carDetail: "Visible scratches, dents or worn upholstery. Drives well; inspection report lists every defect.",
  },
  {
    id: "fair",
    name: "Fair",
    letter: "D",
    summary: "Heavy wear, fully working",
    detail: "Dents, deep scratches or cosmetic damage. Every function tested and working.",
    carDetail: "Heavy cosmetic wear or pending minor repairs, priced accordingly. Inspect at a JDHub Auto hub.",
  },
];

export const gradeName = (g: Grade) => grades.find((x) => x.id === g)!.name;

export const states = ["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Kano", "Enugu"];

const sellersByState: Record<string, string[]> = {
  Lagos: ["JDHub Certified", "Ikeja Mobile Hub", "Lekki Tech Store", "Computer Village Plug", "Lens & Light", "JDHub Auto", "Lekki Prestige Cars"],
  "Abuja (FCT)": ["JDHub Certified", "Wuse Accessories", "Game Zone Abuja", "Banex Gadgets", "Capital Autos"],
  Rivers: ["PH Gadget Plug", "Garden City Motors", "JDHub Certified"],
  Oyo: ["Ibadan Phone Mart", "JDHub Certified"],
  Kano: ["Kano Phones Plaza", "Farm Centre Gadgets"],
  Enugu: ["Coal City Gadgets", "Ogui Road Autos"],
};

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
      const state = m.car && i === 0 ? "Lagos" : pick(states);
      const pool = sellersByState[state].filter((n) => (isCar ? /Auto|Motors|Cars/.test(n) || n === "JDHub Certified" : !/Auto|Motors|Cars/.test(n)));
      const seller = isCar && pool[0] === "JDHub Certified" ? "JDHub Auto" : pick(pool.length ? pool : ["JDHub Certified"]);
      const price = round((m.price + (tier?.add ?? 0)) * gradePrice[grade] * (0.97 + r() * 0.06), isCar ? 50_000 : 5_000);
      const onOffer = r() < 0.2;

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
        was: onOffer ? round(price * 1.08, isCar ? 50_000 : 5_000) : undefined,
        grade,
        state,
        seller,
        verified: seller.startsWith("JDHub") || r() < 0.7,
        rating: Math.round((4.2 + r() * 0.8) * 10) / 10,
        reviews: Math.floor(isCar ? 2 + r() * 30 : 8 + r() * 420),
        art: m.art,
        tint: m.tint,
        photo: m.photo,
        badge: onOffer ? "Hot deal" : i === 0 && r() < 0.35 ? "Best seller" : r() < 0.08 ? "New" : m.category === "phones" && r() < 0.1 ? "Swap pick" : undefined,
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

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getListing = (id: string) => listings.find((l) => l.id === id);
export const listingsIn = (slug: CategorySlug) => listings.filter((l) => l.category === slug);
/** First listing of each model, in catalog order: one card per model for showcases. */
export const featuredIn = (slug: CategorySlug, n: number) =>
  listings.filter((l) => l.category === slug && l.id.endsWith("-1")).slice(0, n);

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
export const formatNaira = (n: number) => naira.format(n);

// Sell / swap estimator: base cash offers (Like New, by storage) for phones JDHub buys.
export const tradeInModels: { model: string; storage: Record<string, number> }[] = [
  { model: "iPhone 16 Pro Max", storage: { "256GB": 1250000, "512GB": 1360000, "1TB": 1470000 } },
  { model: "iPhone 16 Pro", storage: { "128GB": 1020000, "256GB": 1090000, "512GB": 1180000 } },
  { model: "iPhone 15 Pro Max", storage: { "256GB": 960000, "512GB": 1040000, "1TB": 1120000 } },
  { model: "iPhone 15 Pro", storage: { "128GB": 790000, "256GB": 850000, "512GB": 920000 } },
  { model: "iPhone 15", storage: { "128GB": 560000, "256GB": 610000 } },
  { model: "iPhone 14 Pro Max", storage: { "128GB": 720000, "256GB": 770000, "512GB": 830000 } },
  { model: "iPhone 14", storage: { "128GB": 420000, "256GB": 460000 } },
  { model: "iPhone 13", storage: { "128GB": 310000, "256GB": 345000 } },
  { model: "iPhone 12", storage: { "64GB": 195000, "128GB": 220000 } },
  { model: "iPhone 11", storage: { "64GB": 150000, "128GB": 170000 } },
];

export const gradeMultiplier: Record<Grade, number> = {
  "like-new": 1,
  great: 0.9,
  good: 0.78,
  fair: 0.6,
};

export const estimateOffer = (model: string, storage: string, grade: Grade) => {
  const m = tradeInModels.find((x) => x.model === model);
  const base = m?.storage[storage];
  if (!base) return 0;
  // Round to the nearest ₦5,000 so offers read cleanly.
  return Math.round((base * gradeMultiplier[grade]) / 5000) * 5000;
};

export const WHATSAPP_NUMBER = "2348000000000";
export const whatsappLink = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
