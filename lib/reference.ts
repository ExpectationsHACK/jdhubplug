// Reference data shared by the storefront, admin and seed: categories, grades,
// states, money formatting and trade-in pricing. Small and side-effect free, so
// client components can import it without pulling in the seed catalog.

import type { Category, Grade } from "./types";

export type { ArtKind, Category, CategorySlug, Grade, Product } from "./types";

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

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);

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
