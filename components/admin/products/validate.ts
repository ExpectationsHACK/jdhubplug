// Product field rules shared by the admin form (instant feedback), the Server Actions
// and the CSV import (authoritative). Isomorphic and dependency-free apart from
// reference data, so the same checks run in the browser and on the server.

import { states } from "@/lib/reference";
import type { ArtKind, Badge, CategorySlug, Grade, Product, ProductStatus } from "@/lib/types";

export const CATEGORY_OPTIONS: { value: CategorySlug; label: string }[] = [
  { value: "phones", label: "Phones" },
  { value: "accessories", label: "Accessories" },
  { value: "gadgets", label: "Gadgets" },
  { value: "cars", label: "Cars" },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label])) as Record<CategorySlug, string>;

export const GRADE_OPTIONS: { value: Grade; label: string; letter: string }[] = [
  { value: "like-new", label: "Like New", letter: "A" },
  { value: "great", label: "Great", letter: "B" },
  { value: "good", label: "Good", letter: "C" },
  { value: "fair", label: "Fair", letter: "D" },
];
export const GRADE_LABEL = Object.fromEntries(GRADE_OPTIONS.map((g) => [g.value, g.label])) as Record<Grade, string>;

export const STATUS_OPTIONS: { value: ProductStatus; label: string; hint: string }[] = [
  { value: "active", label: "Active", hint: "Listed on the store and can be bought." },
  { value: "draft", label: "Draft", hint: "Hidden from the store while you finish it." },
  { value: "archived", label: "Archived", hint: "Hidden and kept for order history." },
];

export const BADGES: Badge[] = ["New", "Best seller", "Hot deal", "Swap pick"];

export const ART_KINDS: ArtKind[] = ["phone", "earbuds", "charger", "case", "powerbank", "laptop", "tablet", "watch", "drone", "console", "camera", "car"];

export const DEFAULT_ART: Record<CategorySlug, ArtKind> = { phones: "phone", accessories: "earbuds", gadgets: "laptop", cars: "car" };

/** Attribute keys suggested for each category in the editor. */
export const ATTR_TEMPLATES: Record<CategorySlug, string[]> = {
  phones: ["Storage", "Colour", "Battery health", "IMEI", "Network"],
  cars: ["Year", "Mileage", "Engine", "Transmission", "Origin", "VIN", "Inspection"],
  gadgets: ["Configuration", "Compatibility", "Serial", "Warranty"],
  accessories: ["Configuration", "Compatibility", "Serial", "Warranty"],
};

export const SHIP_STATES = states;

export const MAX_PRICE = 2_000_000_000;
export const MAX_STOCK = 100_000;
export const MAX_ATTRS = 30;

/** Product ids: lowercase letters, digits and dashes (what newProductId produces). */
export const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Round naira to the nearest ₦500 (never below ₦500). */
export const roundTo500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

export type StockState = "in" | "low" | "out";

export function stockState(stock: number, lowThreshold: number): StockState {
  if (stock <= 0) return "out";
  return stock <= lowThreshold ? "low" : "in";
}

/** Parse a whole naira / unit amount typed by a person: "₦1,250,000" → 1250000. */
export function parseWhole(raw: string): number | null {
  const s = raw.replace(/[\s,₦_]/g, "").replace(/^NGN/i, "");
  if (!/^\d{1,13}$/.test(s)) return null;
  return Number(s);
}

/**
 * Normalise a Wikimedia Commons reference to a bare file name. Accepts
 * "File:Foo.jpg", a commons.wikimedia.org file page URL, or a Special:FilePath URL.
 */
export function normaliseCommonsFile(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  const m = s.match(/commons\.wikimedia\.org\/wiki\/(?:File:|Special:FilePath\/)([^?#]+)/i) ?? s.match(/upload\.wikimedia\.org\/.+\/([^/?#]+)$/i);
  if (m) {
    try {
      s = decodeURIComponent(m[1]);
    } catch {
      s = m[1];
    }
  }
  // Spaces and underscores are equivalent on Commons; keep whichever was typed.
  s = s.replace(/^(File|Image):/i, "").trim();
  return s;
}

/** Raw (untrusted) input, as typed into the form or read from a CSV row. */
export type ProductInput = {
  name: string;
  brand: string;
  category: string;
  model: string;
  grade: string;
  price: string;
  was: string;
  stock: string;
  status: string;
  featured: boolean;
  badge: string;
  seller: string;
  verified: boolean;
  state: string;
  spec: string;
  attrs: [string, string][];
  photo: string;
  imageUrl: string;
  art: string;
  tint: string;
};

/** The validated, normalised fields a product is built from. */
export type ProductFields = Pick<
  Product,
  | "name"
  | "brand"
  | "category"
  | "model"
  | "grade"
  | "price"
  | "was"
  | "stock"
  | "status"
  | "featured"
  | "badge"
  | "seller"
  | "verified"
  | "state"
  | "spec"
  | "attrs"
  | "photo"
  | "imageUrl"
  | "art"
  | "tint"
>;

export type FieldErrors = Partial<Record<keyof ProductInput, string>>;

export type ValidationResult = { ok: true; value: ProductFields } | { ok: false; errors: FieldErrors };

// Control characters and markup-ish characters are never useful in catalog text.
const BAD_TEXT = /[\u0000-\u001f\u007f<>]/;

function text(v: string, label: string, min: number, max: number, errors: FieldErrors, key: keyof ProductInput): string {
  const s = v.replace(/\s+/g, " ").trim();
  if (s.length < min) errors[key] = min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`;
  else if (s.length > max) errors[key] = `${label} can be at most ${max} characters.`;
  else if (BAD_TEXT.test(s)) errors[key] = `${label} can't contain < or > or control characters.`;
  return s;
}

export function validateProduct(input: ProductInput): ValidationResult {
  const errors: FieldErrors = {};

  const name = text(input.name ?? "", "Name", 2, 120, errors, "name");
  const brand = text(input.brand ?? "", "Brand", 1, 60, errors, "brand");
  const seller = text(input.seller ?? "", "Seller", 1, 80, errors, "seller");
  const spec = text(input.spec ?? "", "Spec line", 0, 160, errors, "spec");

  const category = input.category as CategorySlug;
  if (!CATEGORY_OPTIONS.some((c) => c.value === category)) errors.category = "Choose a category.";

  const grade = input.grade as Grade;
  if (!GRADE_OPTIONS.some((g) => g.value === grade)) errors.grade = "Choose a grade.";

  const status = input.status as ProductStatus;
  if (!STATUS_OPTIONS.some((s) => s.value === status)) errors.status = "Choose a status.";

  const state = (input.state ?? "").trim();
  if (!SHIP_STATES.includes(state)) errors.state = `Choose where it ships from (${SHIP_STATES.join(", ")}).`;

  let model = (input.model ?? "").trim().toLowerCase();
  if (!model) model = slugify(name) || "item";
  else if (model.length > 60 || !SLUG_RE.test(model)) errors.model = "Use lowercase letters, numbers and dashes, e.g. iphone-15-pro.";

  const price = parseWhole(input.price ?? "");
  if (price === null) errors.price = "Enter the price in whole naira, e.g. 450000.";
  else if (price <= 0) errors.price = "Price must be more than ₦0.";
  else if (price > MAX_PRICE) errors.price = "That price is too high.";

  let was: number | undefined;
  if ((input.was ?? "").trim()) {
    const w = parseWhole(input.was);
    if (w === null) errors.was = "Enter the compare-at price in whole naira, or leave it empty.";
    else if (w > MAX_PRICE) errors.was = "That price is too high.";
    else if (price !== null && w <= price) errors.was = "The compare-at price must be higher than the price.";
    else was = w;
  }

  const stock = parseWhole(input.stock ?? "");
  if (stock === null) errors.stock = "Enter stock as a whole number (0 or more).";
  else if (stock > MAX_STOCK) errors.stock = `Stock can be at most ${MAX_STOCK.toLocaleString("en-NG")}.`;

  let badge: Badge | undefined;
  if ((input.badge ?? "").trim()) {
    const b = BADGES.find((x) => x.toLowerCase() === input.badge.trim().toLowerCase());
    if (!b) errors.badge = `Badge must be one of: ${BADGES.join(", ")}.`;
    else badge = b;
  }

  // Attributes: skip blank rows, reject duplicates and over-long values.
  const attrs: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [k0, v0] of input.attrs ?? []) {
    const k = (k0 ?? "").replace(/\s+/g, " ").trim();
    const v = (v0 ?? "").replace(/\s+/g, " ").trim();
    if (!k && !v) continue;
    if (!k) {
      errors.attrs = "Every attribute needs a name.";
      break;
    }
    if (k.length > 40 || v.length > 200) {
      errors.attrs = `"${k.slice(0, 40)}" is too long (names up to 40 characters, values up to 200).`;
      break;
    }
    if (BAD_TEXT.test(k) || BAD_TEXT.test(v)) {
      errors.attrs = "Attributes can't contain < or > or control characters.";
      break;
    }
    if (seen.has(k.toLowerCase())) {
      errors.attrs = `"${k}" appears twice.`;
      break;
    }
    seen.add(k.toLowerCase());
    attrs[k] = v;
  }
  if (!errors.attrs && seen.size > MAX_ATTRS) errors.attrs = `Use at most ${MAX_ATTRS} attributes.`;

  const photo = normaliseCommonsFile(input.photo ?? "");
  if (photo) {
    if (photo.length > 240) errors.photo = "That file name is too long.";
    else if (/[#<>[\]|{}\u0000-\u001f]/.test(photo)) errors.photo = "That doesn't look like a Commons file name.";
    else if (!/\.(jpe?g|png|webp|gif|svg|tiff?)$/i.test(photo)) errors.photo = "Commons file names end in .jpg, .png, .webp, .gif, .svg or .tif.";
  }

  let imageUrl = (input.imageUrl ?? "").trim();
  if (imageUrl) {
    let u: URL | null = null;
    try {
      u = new URL(imageUrl);
    } catch {
      u = null;
    }
    if (!u || !u.hostname) errors.imageUrl = "Enter a full image URL starting with https://";
    else if (u.protocol !== "https:") errors.imageUrl = "Use an https:// URL (http images are blocked on secure pages).";
    else if (imageUrl.length > 2000) errors.imageUrl = "That URL is too long.";
    else imageUrl = u.toString();
  }

  const category0 = errors.category ? "phones" : category;
  const art = (ART_KINDS.includes(input.art as ArtKind) ? input.art : DEFAULT_ART[category0]) as ArtKind;
  const tint = /^#[0-9a-f]{6}$/i.test((input.tint ?? "").trim()) ? input.tint.trim().toLowerCase() : "#2a2a2a";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      brand,
      category,
      model,
      grade,
      price: price!,
      was,
      stock: stock!,
      status,
      featured: !!input.featured,
      badge,
      seller,
      verified: !!input.verified,
      state,
      spec,
      attrs,
      photo: photo || undefined,
      imageUrl: imageUrl || undefined,
      art,
      tint,
    },
  };
}

/** A stored product with any meaningless compare-at price removed. */
export const withValidWas = <T extends Pick<Product, "price" | "was">>(p: T): T => (p.was && p.was <= p.price ? { ...p, was: undefined } : p);

/** Turn a stored product back into form input. */
export function productToInput(p: Product): ProductInput {
  return {
    name: p.name,
    brand: p.brand,
    category: p.category,
    model: p.model,
    grade: p.grade,
    price: String(p.price),
    // A compare-at price at or below the price is meaningless (older data has a few); drop it.
    was: p.was && p.was > p.price ? String(p.was) : "",
    stock: String(p.stock),
    status: p.status,
    featured: !!p.featured,
    badge: p.badge ?? "",
    seller: p.seller,
    verified: p.verified,
    state: p.state,
    spec: p.spec,
    attrs: Object.entries(p.attrs ?? {}),
    photo: p.photo ?? "",
    imageUrl: p.imageUrl ?? "",
    art: p.art,
    tint: p.tint,
  };
}

const TRACKED: (keyof ProductFields)[] = [
  "name",
  "brand",
  "category",
  "model",
  "grade",
  "price",
  "was",
  "status",
  "featured",
  "badge",
  "seller",
  "verified",
  "state",
  "spec",
  "photo",
  "imageUrl",
  "art",
  "tint",
];

const show = (v: unknown) => {
  if (v === undefined || v === null || v === "") return "—";
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
};

/**
 * Human-readable field changes between two versions of a product, for the activity
 * log and the import preview ("price 450000 → 430000"). Stock is reported separately.
 */
export function describeChanges(before: Pick<Product, keyof ProductFields>, after: Pick<Product, keyof ProductFields>): string[] {
  const out: string[] = [];
  for (const k of TRACKED) {
    const a = before[k] ?? undefined;
    const b = after[k] ?? undefined;
    if ((a || undefined) === (b || undefined) || (k === "featured" && !!a === !!b)) continue;
    out.push(`${k} ${show(a)} → ${show(b)}`);
  }
  if (JSON.stringify(before.attrs ?? {}) !== JSON.stringify(after.attrs ?? {})) out.push("attributes updated");
  return out;
}
