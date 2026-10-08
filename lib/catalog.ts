// JDHub catalog data. One shared listing shape with a flexible, category-specific
// `attrs` object (a car needs VIN/mileage/year; a phone needs storage/battery health).

export type CategorySlug = "phones" | "accessories" | "gadgets" | "cars";

export type Grade = "like-new" | "great" | "good" | "fair";

export type ArtKind =
  | "phone"
  | "earbuds"
  | "charger"
  | "case"
  | "powerbank"
  | "laptop"
  | "tablet"
  | "watch"
  | "drone"
  | "console"
  | "camera"
  | "car";

export type Category = {
  slug: CategorySlug;
  name: string;
  tagline: string;
  blurb: string;
  art: ArtKind;
  brands: string[];
};

export type Listing = {
  id: string;
  category: CategorySlug;
  brand: string;
  name: string;
  /** Short spec line shown under the name on cards. */
  spec: string;
  price: number;
  /** Price before discount, when the item is on offer. */
  was?: number;
  grade: Grade;
  state: string;
  seller: string;
  verified: boolean;
  rating: number;
  reviews: number;
  art: ArtKind;
  /** Hex colour used to tint the device illustration. */
  tint: string;
  badge?: "New" | "Best seller" | "Hot deal" | "Swap pick";
  attrs: Record<string, string>;
  options?: { label: string; values: string[] }[];
};

export const categories: Category[] = [
  {
    slug: "phones",
    name: "Phones",
    tagline: "Graded. Checked. Guaranteed.",
    blurb: "iPhone and Android flagships, IMEI-checked and battery-tested before they list.",
    art: "phone",
    brands: ["Apple", "Samsung", "Google", "Tecno", "Infinix"],
  },
  {
    slug: "accessories",
    name: "Accessories",
    tagline: "The right fit, every time.",
    blurb: "Chargers, cases, earbuds and power banks, tagged for the devices they fit.",
    art: "earbuds",
    brands: ["Apple", "Anker", "Oraimo", "Samsung", "Spigen"],
  },
  {
    slug: "gadgets",
    name: "Gadgets",
    tagline: "Work. Play. Create.",
    blurb: "Laptops, tablets, watches, drones, consoles and cameras on one grading standard.",
    art: "laptop",
    brands: ["Apple", "Sony", "DJI", "HP", "Samsung", "Canon"],
  },
  {
    slug: "cars",
    name: "Cars",
    tagline: "Drive away with certainty.",
    blurb: "VIN-checked vehicles with inspection reports, financing and swap-up options.",
    art: "car",
    brands: ["Toyota", "Lexus", "Honda", "Mercedes-Benz", "Hyundai"],
  },
];

export const grades: { id: Grade; name: string; letter: string; summary: string; detail: string }[] = [
  {
    id: "like-new",
    name: "Like New",
    letter: "A",
    summary: "No visible wear",
    detail: "Flawless screen and body. Battery health 90%+ (or equivalent for non-phones). Original parts only.",
  },
  {
    id: "great",
    name: "Great",
    letter: "B",
    summary: "Light signs of use",
    detail: "Faint micro-scratches only visible up close. Fully functional. Battery health 85%+.",
  },
  {
    id: "good",
    name: "Good",
    letter: "C",
    summary: "Visible wear",
    detail: "Noticeable scratches or scuffs on the body, screen clear when on. Fully functional.",
  },
  {
    id: "fair",
    name: "Fair",
    letter: "D",
    summary: "Heavy wear, fully working",
    detail: "Dents, deep scratches or cosmetic damage. Every function tested and working.",
  },
];

export const gradeName = (g: Grade) => grades.find((x) => x.id === g)!.name;

export const states = ["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Kano", "Enugu"];

export const listings: Listing[] = [
  // Phones
  {
    id: "iphone-15-pro-max-256",
    category: "phones",
    brand: "Apple",
    name: "iPhone 15 Pro Max",
    spec: "256GB · Natural Titanium · Battery 94%",
    price: 1185000,
    was: 1260000,
    grade: "like-new",
    state: "Lagos",
    seller: "JDHub Certified",
    verified: true,
    rating: 4.9,
    reviews: 212,
    art: "phone",
    tint: "#8a8378",
    badge: "Best seller",
    attrs: { Storage: "256GB", "Battery health": "94%", IMEI: "Clean · checked", Network: "Factory unlocked" },
    options: [
      { label: "Storage", values: ["256GB", "512GB", "1TB"] },
      { label: "Colour", values: ["Natural Titanium", "Black Titanium", "Blue Titanium"] },
    ],
  },
  {
    id: "iphone-14-128",
    category: "phones",
    brand: "Apple",
    name: "iPhone 14",
    spec: "128GB · Midnight · Battery 88%",
    price: 545000,
    grade: "great",
    state: "Abuja (FCT)",
    seller: "JDHub Certified",
    verified: true,
    rating: 4.8,
    reviews: 341,
    art: "phone",
    tint: "#1f2630",
    badge: "Swap pick",
    attrs: { Storage: "128GB", "Battery health": "88%", IMEI: "Clean · checked", Network: "Factory unlocked" },
    options: [{ label: "Storage", values: ["128GB", "256GB"] }],
  },
  {
    id: "galaxy-s24-ultra-256",
    category: "phones",
    brand: "Samsung",
    name: "Galaxy S24 Ultra",
    spec: "256GB · Titanium Gray · Battery 92%",
    price: 1020000,
    grade: "like-new",
    state: "Lagos",
    seller: "Ikeja Mobile Hub",
    verified: true,
    rating: 4.7,
    reviews: 96,
    art: "phone",
    tint: "#5b5e63",
    badge: "New",
    attrs: { Storage: "256GB", "Battery health": "92%", IMEI: "Clean · checked", Network: "Dual SIM" },
    options: [{ label: "Storage", values: ["256GB", "512GB"] }],
  },
  {
    id: "iphone-13-128",
    category: "phones",
    brand: "Apple",
    name: "iPhone 13",
    spec: "128GB · Blue · Battery 84%",
    price: 395000,
    was: 430000,
    grade: "good",
    state: "Rivers",
    seller: "PH Gadget Plug",
    verified: true,
    rating: 4.6,
    reviews: 158,
    art: "phone",
    tint: "#2e4a6b",
    badge: "Hot deal",
    attrs: { Storage: "128GB", "Battery health": "84%", IMEI: "Clean · checked", Network: "Factory unlocked" },
  },
  {
    id: "pixel-8-pro-128",
    category: "phones",
    brand: "Google",
    name: "Pixel 8 Pro",
    spec: "128GB · Bay · Battery 90%",
    price: 610000,
    grade: "great",
    state: "Lagos",
    seller: "Lekki Tech Store",
    verified: false,
    rating: 4.5,
    reviews: 41,
    art: "phone",
    tint: "#7fa6c9",
    attrs: { Storage: "128GB", "Battery health": "90%", IMEI: "Clean · checked", Network: "Factory unlocked" },
  },
  {
    id: "iphone-12-64",
    category: "phones",
    brand: "Apple",
    name: "iPhone 12",
    spec: "64GB · White · Battery 81%",
    price: 255000,
    grade: "fair",
    state: "Oyo",
    seller: "JDHub Certified",
    verified: true,
    rating: 4.4,
    reviews: 77,
    art: "phone",
    tint: "#e7e4de",
    attrs: { Storage: "64GB", "Battery health": "81%", IMEI: "Clean · checked", Network: "Factory unlocked" },
  },
  // Accessories
  {
    id: "airpods-pro-2",
    category: "accessories",
    brand: "Apple",
    name: "AirPods Pro (2nd gen)",
    spec: "USB-C · Fits iPhone & Android",
    price: 215000,
    grade: "like-new",
    state: "Lagos",
    seller: "JDHub Certified",
    verified: true,
    rating: 4.9,
    reviews: 188,
    art: "earbuds",
    tint: "#f4f4f4",
    badge: "Best seller",
    attrs: { Compatibility: "iPhone 11 and later, Android", Connector: "USB-C", Warranty: "90 days" },
  },
  {
    id: "anker-20w-charger",
    category: "accessories",
    brand: "Anker",
    name: "Nano 20W USB-C Charger",
    spec: "Fits iPhone 12 – 16",
    price: 18500,
    grade: "like-new",
    state: "Abuja (FCT)",
    seller: "Wuse Accessories",
    verified: true,
    rating: 4.7,
    reviews: 402,
    art: "charger",
    tint: "#ffffff",
    attrs: { Compatibility: "iPhone 12 – 16, Galaxy S-series", Output: "20W PD", Warranty: "12 months" },
  },
  {
    id: "spigen-case-15pro",
    category: "accessories",
    brand: "Spigen",
    name: "Ultra Hybrid MagFit Case",
    spec: "Fits iPhone 15 Pro",
    price: 24000,
    grade: "like-new",
    state: "Lagos",
    seller: "Ikeja Mobile Hub",
    verified: true,
    rating: 4.6,
    reviews: 129,
    art: "case",
    tint: "#2c2c2c",
    badge: "New",
    attrs: { Compatibility: "iPhone 15 Pro", MagSafe: "Yes", Warranty: "6 months" },
  },
  {
    id: "oraimo-powerbank-20k",
    category: "accessories",
    brand: "Oraimo",
    name: "Traveller 20,000mAh Power Bank",
    spec: "22.5W fast charge · 3 ports",
    price: 26500,
    was: 31000,
    grade: "like-new",
    state: "Kano",
    seller: "Kano Phones Plaza",
    verified: false,
    rating: 4.5,
    reviews: 87,
    art: "powerbank",
    tint: "#1d6b3a",
    badge: "Hot deal",
    attrs: { Capacity: "20,000mAh", Output: "22.5W", Warranty: "12 months" },
  },
  // Gadgets
  {
    id: "macbook-air-m2",
    category: "gadgets",
    brand: "Apple",
    name: 'MacBook Air 13" M2',
    spec: "8GB · 256GB SSD · 41 cycles",
    price: 985000,
    grade: "like-new",
    state: "Lagos",
    seller: "JDHub Certified",
    verified: true,
    rating: 4.9,
    reviews: 64,
    art: "laptop",
    tint: "#b9bcc1",
    badge: "Best seller",
    attrs: { Memory: "8GB", Storage: "256GB SSD", "Battery cycles": "41", Serial: "Checked" },
    options: [{ label: "Memory", values: ["8GB", "16GB"] }],
  },
  {
    id: "ps5-slim",
    category: "gadgets",
    brand: "Sony",
    name: "PlayStation 5 Slim",
    spec: "1TB · Disc edition · 2 controllers",
    price: 720000,
    grade: "great",
    state: "Abuja (FCT)",
    seller: "Game Zone Abuja",
    verified: true,
    rating: 4.8,
    reviews: 53,
    art: "console",
    tint: "#f2f2f2",
    badge: "Swap pick",
    attrs: { Storage: "1TB", Edition: "Disc", Controllers: "2", Serial: "Checked" },
  },
  {
    id: "dji-mini-4-pro",
    category: "gadgets",
    brand: "DJI",
    name: "DJI Mini 4 Pro",
    spec: "Fly More Combo · 4K/60fps",
    price: 1150000,
    grade: "like-new",
    state: "Lagos",
    seller: "SkyShot NG",
    verified: true,
    rating: 4.7,
    reviews: 22,
    art: "drone",
    tint: "#7d7f82",
    badge: "New",
    attrs: { Video: "4K/60fps HDR", Batteries: "3", "Flight time": "34 min", Serial: "Checked" },
  },
  {
    id: "galaxy-watch-6",
    category: "gadgets",
    brand: "Samsung",
    name: "Galaxy Watch6 Classic",
    spec: "47mm · Bluetooth · Black",
    price: 245000,
    grade: "great",
    state: "Enugu",
    seller: "Coal City Gadgets",
    verified: false,
    rating: 4.5,
    reviews: 31,
    art: "watch",
    tint: "#232323",
    attrs: { Size: "47mm", Connectivity: "Bluetooth", Battery: "Excellent" },
  },
  {
    id: "ipad-air-m1",
    category: "gadgets",
    brand: "Apple",
    name: "iPad Air (5th gen) M1",
    spec: "64GB · Wi-Fi · Space Gray",
    price: 465000,
    grade: "good",
    state: "Rivers",
    seller: "PH Gadget Plug",
    verified: true,
    rating: 4.6,
    reviews: 48,
    art: "tablet",
    tint: "#55585d",
    attrs: { Storage: "64GB", Connectivity: "Wi-Fi", Battery: "88%" },
  },
  {
    id: "canon-r50",
    category: "gadgets",
    brand: "Canon",
    name: "Canon EOS R50",
    spec: "RF-S 18-45mm kit · 9k shutter",
    price: 890000,
    grade: "like-new",
    state: "Lagos",
    seller: "Lens & Light",
    verified: true,
    rating: 4.8,
    reviews: 17,
    art: "camera",
    tint: "#1b1b1b",
    attrs: { Lens: "RF-S 18-45mm", "Shutter count": "9,120", Serial: "Checked" },
  },
  // Cars
  {
    id: "toyota-camry-2019",
    category: "cars",
    brand: "Toyota",
    name: "Toyota Camry SE 2019",
    spec: "62,400 km · Automatic · Foreign used",
    price: 21500000,
    grade: "great",
    state: "Lagos",
    seller: "JDHub Auto",
    verified: true,
    rating: 4.8,
    reviews: 19,
    art: "car",
    tint: "#9c9fa3",
    badge: "Best seller",
    attrs: { Year: "2019", Mileage: "62,400 km", Transmission: "Automatic", VIN: "Clean history · checked", Inspection: "152-point passed" },
  },
  {
    id: "lexus-rx350-2017",
    category: "cars",
    brand: "Lexus",
    name: "Lexus RX 350 2017",
    spec: "88,900 km · Automatic · Nigerian used",
    price: 27800000,
    grade: "good",
    state: "Abuja (FCT)",
    seller: "Capital Autos",
    verified: true,
    rating: 4.6,
    reviews: 11,
    art: "car",
    tint: "#1e2a38",
    attrs: { Year: "2017", Mileage: "88,900 km", Transmission: "Automatic", VIN: "Clean history · checked", Inspection: "152-point passed" },
  },
  {
    id: "honda-accord-2018",
    category: "cars",
    brand: "Honda",
    name: "Honda Accord EX 2018",
    spec: "71,200 km · Automatic · Foreign used",
    price: 18900000,
    was: 19800000,
    grade: "great",
    state: "Rivers",
    seller: "Garden City Motors",
    verified: true,
    rating: 4.7,
    reviews: 8,
    art: "car",
    tint: "#7a1f24",
    badge: "Hot deal",
    attrs: { Year: "2018", Mileage: "71,200 km", Transmission: "Automatic", VIN: "Clean history · checked", Inspection: "152-point passed" },
  },
  {
    id: "mercedes-c300-2016",
    category: "cars",
    brand: "Mercedes-Benz",
    name: "Mercedes-Benz C300 2016",
    spec: "94,000 km · Automatic · Nigerian used",
    price: 16400000,
    grade: "fair",
    state: "Lagos",
    seller: "Lekki Prestige Cars",
    verified: false,
    rating: 4.3,
    reviews: 6,
    art: "car",
    tint: "#f1f1f1",
    attrs: { Year: "2016", Mileage: "94,000 km", Transmission: "Automatic", VIN: "Clean history · checked", Inspection: "Pending" },
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getListing = (id: string) => listings.find((l) => l.id === id);
export const listingsIn = (slug: CategorySlug) => listings.filter((l) => l.category === slug);

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
