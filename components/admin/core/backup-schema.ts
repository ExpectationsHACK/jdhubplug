// Backup file format and restore validation. Every record from an uploaded file is
// rebuilt field by field from known keys with checked types, so nothing unexpected
// (extra keys, wrong types, scripts in URLs) reaches the store.

import type {
  ArtKind,
  Badge,
  CategorySlug,
  Grade,
  Lead,
  LeadType,
  Offer,
  OfferDiscount,
  OfferScope,
  OfferStats,
  Order,
  Product,
  ProductStatus,
  Settings,
} from "@/lib/types";
import { validateSettings } from "./settings-schema";

export const BACKUP_FORMAT = "jdhub-backup";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  exportedBy: string;
  counts: { products: number; orders: number; offers: number; leads: number };
  products: Product[];
  orders: Order[];
  offers: Offer[];
  offerStats: Record<string, OfferStats>;
  leads: Lead[];
  settings: Settings;
};

const CATEGORIES = ["phones", "accessories", "gadgets", "cars"] as const satisfies readonly CategorySlug[];
const GRADES = ["like-new", "great", "good", "fair"] as const satisfies readonly Grade[];
const ARTS = ["phone", "earbuds", "charger", "case", "powerbank", "laptop", "tablet", "watch", "drone", "console", "camera", "car"] as const satisfies readonly ArtKind[];
const BADGES = ["New", "Best seller", "Hot deal", "Swap pick"] as const satisfies readonly Badge[];
const STATUSES = ["active", "draft", "archived"] as const satisfies readonly ProductStatus[];
const LEAD_TYPES = ["sell", "swap", "contact", "vendor"] as const satisfies readonly LeadType[];
const LEAD_STATUSES = ["new", "contacted", "closed"] as const satisfies readonly Lead["status"][];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};

function str(o: Obj, key: string, max: number, opts: { required?: boolean; fallback?: string } = {}): string {
  const v = o[key];
  if (v === undefined || v === null || v === "") {
    if (opts.required) fail(`"${key}" is missing`);
    return opts.fallback ?? "";
  }
  if (typeof v !== "string") fail(`"${key}" must be text`);
  const s = (v as string).trim();
  if (s.length > max) fail(`"${key}" is longer than ${max} characters`);
  return s;
}

function optStr(o: Obj, key: string, max: number) {
  const s = str(o, key, max);
  return s || undefined;
}

function num(o: Obj, key: string, opts: { min?: number; max?: number; int?: boolean; required?: boolean; fallback?: number } = {}): number {
  const v = o[key];
  if (v === undefined || v === null) {
    if (opts.required) fail(`"${key}" is missing`);
    return opts.fallback ?? 0;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`"${key}" must be a number`);
  const n = v as number;
  if (opts.int && !Number.isInteger(n)) fail(`"${key}" must be a whole number`);
  if (opts.min !== undefined && n < opts.min) fail(`"${key}" is below ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) fail(`"${key}" is above ${opts.max}`);
  return n;
}

function optNum(o: Obj, key: string, opts: { min?: number; max?: number; int?: boolean } = {}) {
  return o[key] === undefined || o[key] === null ? undefined : num(o, key, opts);
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[], fallback?: T): T {
  const v = o[key];
  if ((v === undefined || v === null) && fallback !== undefined) return fallback;
  if (typeof v !== "string" || !allowed.includes(v as T)) fail(`"${key}" must be one of ${allowed.join(", ")}`);
  return v as T;
}

function bool(o: Obj, key: string, fallback = false) {
  const v = o[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") fail(`"${key}" must be true or false`);
  return v as boolean;
}

function date(o: Obj, key: string, fallback?: string): string {
  const v = o[key];
  if ((v === undefined || v === null || v === "") && fallback) return fallback;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) fail(`"${key}" must be a date`);
  return new Date(v as string).toISOString();
}

function strRecord(o: Obj, key: string, maxKeys: number, maxLen: number): Record<string, string> {
  const v = o[key];
  if (v === undefined || v === null) return {};
  if (!isObj(v)) fail(`"${key}" must be an object`);
  const entries = Object.entries(v as Obj);
  if (entries.length > maxKeys) fail(`"${key}" has more than ${maxKeys} entries`);
  const out: Record<string, string> = {};
  for (const [k, val] of entries) {
    if (k.length > 80) fail(`"${key}" has a key longer than 80 characters`);
    if (typeof val !== "string" && typeof val !== "number") fail(`"${key}.${k}" must be text`);
    const s = String(val);
    if (s.length > maxLen) fail(`"${key}.${k}" is too long`);
    out[k] = s;
  }
  return out;
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

/** http(s) URL or site path only. */
function imageUrl(o: Obj, key: string) {
  const s = optStr(o, key, 2000);
  if (!s) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return s;
  } catch {
    /* fall through */
  }
  return fail(`"${key}" must be an http(s) URL`);
}

export function sanitizeProduct(raw: unknown, now: string): Product {
  if (!isObj(raw)) return fail("not an object");
  const id = str(raw, "id", 120, { required: true });
  if (!ID_RE.test(id)) fail(`"id" has unsupported characters`);
  const price = num(raw, "price", { min: 0, max: 10_000_000_000, int: true, required: true });
  const was = optNum(raw, "was", { min: 0, max: 10_000_000_000, int: true });
  const badge = raw.badge === undefined || raw.badge === null || raw.badge === "" ? undefined : oneOf(raw, "badge", BADGES);
  const createdAt = date(raw, "createdAt", now);
  return {
    id,
    model: str(raw, "model", 120, { fallback: id }),
    category: oneOf(raw, "category", CATEGORIES),
    brand: str(raw, "brand", 60, { required: true }),
    name: str(raw, "name", 200, { required: true }),
    spec: str(raw, "spec", 300),
    price,
    ...(was !== undefined ? { was } : {}),
    grade: oneOf(raw, "grade", GRADES, "great"),
    state: str(raw, "state", 60, { fallback: "Lagos" }),
    seller: str(raw, "seller", 100, { fallback: "JDHub Certified" }),
    verified: bool(raw, "verified"),
    rating: num(raw, "rating", { min: 0, max: 5, fallback: 0 }),
    reviews: num(raw, "reviews", { min: 0, max: 10_000_000, int: true, fallback: 0 }),
    art: oneOf(raw, "art", ARTS, "phone"),
    tint: str(raw, "tint", 40, { fallback: "#2a2a2a" }),
    ...(optStr(raw, "photo", 300) ? { photo: optStr(raw, "photo", 300) } : {}),
    ...(imageUrl(raw, "imageUrl") ? { imageUrl: imageUrl(raw, "imageUrl") } : {}),
    ...(badge ? { badge } : {}),
    attrs: strRecord(raw, "attrs", 40, 300),
    stock: num(raw, "stock", { min: 0, max: 1_000_000, int: true, fallback: 0 }),
    sold: num(raw, "sold", { min: 0, max: 100_000_000, int: true, fallback: 0 }),
    status: oneOf(raw, "status", STATUSES, "active"),
    ...(raw.featured !== undefined ? { featured: bool(raw, "featured") } : {}),
    createdAt,
    updatedAt: date(raw, "updatedAt", createdAt),
  };
}

function sanitizeDiscount(raw: unknown): OfferDiscount {
  if (!isObj(raw)) return fail(`"discount" must be an object`);
  const type = oneOf(raw, "type", ["percent", "fixed", "price"] as const);
  const value = num(raw, "value", { min: 0, max: type === "percent" ? 100 : 10_000_000_000, required: true });
  return { type, value };
}

function strList(raw: Obj, key: string, max: number, itemMax: number): string[] {
  const v = raw[key];
  if (!Array.isArray(v)) return fail(`"${key}" must be a list`);
  if (v.length > max) fail(`"${key}" has more than ${max} items`);
  return v.map((x) => {
    if (typeof x !== "string" || !x.trim() || x.length > itemMax) fail(`"${key}" has an invalid item`);
    return (x as string).trim();
  });
}

function sanitizeScope(raw: unknown): OfferScope {
  if (!isObj(raw)) return fail(`"scope" must be an object`);
  const type = oneOf(raw, "type", ["all", "categories", "brands", "products"] as const);
  if (type === "all") return { type };
  if (type === "categories") {
    const cats = strList(raw, "categories", 10, 40);
    if (cats.some((c) => !(CATEGORIES as readonly string[]).includes(c))) fail(`"scope.categories" has an unknown category`);
    return { type, categories: cats as CategorySlug[] };
  }
  if (type === "brands") return { type, brands: strList(raw, "brands", 100, 60) };
  return { type, productIds: strList(raw, "productIds", 2000, 120) };
}

export function sanitizeOffer(raw: unknown, now: string): Offer {
  if (!isObj(raw)) return fail("not an object");
  const code = str(raw, "code", 40, { required: true });
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/i.test(code)) fail(`"code" must be letters, numbers and dashes`);
  const startsAt = date(raw, "startsAt");
  const endsAt = date(raw, "endsAt");
  if (Date.parse(endsAt) <= Date.parse(startsAt)) fail(`"endsAt" must be after "startsAt"`);
  const usageLimit = optNum(raw, "usageLimit", { min: 0, max: 10_000_000, int: true });
  const minSubtotal = optNum(raw, "minSubtotal", { min: 0, max: 10_000_000_000, int: true });
  const heroProductId = optStr(raw, "heroProductId", 120);
  const createdAt = date(raw, "createdAt", now);
  return {
    code: code.toLowerCase(),
    title: str(raw, "title", 120, { required: true }),
    headline: str(raw, "headline", 200),
    description: str(raw, "description", 2000),
    discount: sanitizeDiscount(raw.discount),
    scope: sanitizeScope(raw.scope),
    startsAt,
    endsAt,
    active: bool(raw, "active"),
    ...(usageLimit !== undefined ? { usageLimit } : {}),
    ...(minSubtotal !== undefined ? { minSubtotal } : {}),
    ...(heroProductId ? { heroProductId } : {}),
    createdAt,
    updatedAt: date(raw, "updatedAt", createdAt),
  };
}

export function sanitizeLead(raw: unknown, now: string): Lead {
  if (!isObj(raw)) return fail("not an object");
  const id = str(raw, "id", 80, { required: true });
  if (!ID_RE.test(id)) fail(`"id" has unsupported characters`);
  const details = raw.details === undefined || raw.details === null ? undefined : strRecord(raw, "details", 40, 1000);
  const email = optStr(raw, "email", 200);
  const createdAt = date(raw, "createdAt", now);
  return {
    id,
    type: oneOf(raw, "type", LEAD_TYPES),
    name: str(raw, "name", 120, { required: true }),
    phone: str(raw, "phone", 40),
    ...(email ? { email } : {}),
    message: str(raw, "message", 5000),
    ...(details ? { details } : {}),
    status: oneOf(raw, "status", LEAD_STATUSES, "new"),
    createdAt,
    updatedAt: date(raw, "updatedAt", createdAt),
  };
}

function sanitizeStats(raw: unknown): Record<string, OfferStats> {
  if (raw === undefined || raw === null) return {};
  if (!isObj(raw)) return fail(`"offerStats" must be an object`);
  const out: Record<string, OfferStats> = {};
  for (const [code, v] of Object.entries(raw).slice(0, 5000)) {
    if (!isObj(v)) continue;
    const n = (k: string) => (typeof v[k] === "number" && Number.isFinite(v[k]) ? Math.max(0, Math.round(v[k] as number)) : 0);
    out[code.toLowerCase()] = { views: n("views"), orders: n("orders"), revenue: n("revenue") };
  }
  return out;
}

export type ParsedBackup = {
  exportedAt: string;
  exportedBy: string;
  products: Product[];
  offers: Offer[];
  offerStats: Record<string, OfferStats>;
  leads: Lead[];
  settings: Settings | null;
  orderCount: number;
};

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; errors: string[] };

const MAX = { products: 20_000, offers: 2_000, leads: 50_000 };

/** Validate a whole backup file. Collects up to 10 problems so the owner can fix the file. */
export function parseBackup(raw: unknown): ParseResult {
  const now = new Date().toISOString();
  if (!isObj(raw)) return { ok: false, errors: ["This isn't a JDHub backup file."] };
  if (raw.format !== BACKUP_FORMAT) return { ok: false, errors: [`This isn't a JDHub backup file (expected format "${BACKUP_FORMAT}").`] };
  if (raw.version !== BACKUP_VERSION) return { ok: false, errors: [`Unsupported backup version ${String(raw.version)}. This admin reads version ${BACKUP_VERSION}.`] };

  const errors: string[] = [];
  const list = <T,>(key: string, max: number, fn: (r: unknown, now: string) => T, idOf: (r: unknown) => string): T[] => {
    const v = raw[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      errors.push(`"${key}" must be a list.`);
      return [];
    }
    if (v.length > max) {
      errors.push(`"${key}" has more than ${max.toLocaleString()} records.`);
      return [];
    }
    const out: T[] = [];
    const seen = new Set<string>();
    v.forEach((r, i) => {
      try {
        const rec = fn(r, now);
        const id = idOf(rec);
        if (seen.has(id)) throw new Invalid(`duplicate id "${id}"`);
        seen.add(id);
        out.push(rec);
      } catch (e) {
        if (!(e instanceof Invalid)) throw e;
        const label = isObj(r) && typeof r.id === "string" ? r.id : isObj(r) && typeof r.code === "string" ? r.code : `#${i + 1}`;
        if (errors.length < 10) errors.push(`${key} ${label}: ${e.message}.`);
      }
    });
    return out;
  };

  const products = list("products", MAX.products, sanitizeProduct, (p) => (p as Product).id);
  const offers = list("offers", MAX.offers, sanitizeOffer, (o) => (o as Offer).code);
  const leads = list("leads", MAX.leads, sanitizeLead, (l) => (l as Lead).id);

  let offerStats: Record<string, OfferStats> = {};
  try {
    offerStats = sanitizeStats(raw.offerStats);
  } catch (e) {
    if (!(e instanceof Invalid)) throw e;
    errors.push(e.message);
  }

  let settings: Settings | null = null;
  if (raw.settings !== undefined && raw.settings !== null) {
    if (!isObj(raw.settings)) errors.push(`"settings" must be an object.`);
    else {
      const res = validateSettings(raw.settings);
      if (res.ok) settings = res.settings;
      else errors.push(`settings: ${Object.entries(res.errors).slice(0, 3).map(([k, m]) => `${k}: ${m}`).join(" ")}`);
    }
  }

  if (errors.length) return { ok: false, errors };
  const exportedAt = typeof raw.exportedAt === "string" && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : "";
  const exportedBy = typeof raw.exportedBy === "string" ? raw.exportedBy.slice(0, 120) : "";
  return {
    ok: true,
    backup: {
      exportedAt,
      exportedBy,
      products,
      offers,
      offerStats,
      leads,
      settings,
      orderCount: Array.isArray(raw.orders) ? raw.orders.length : 0,
    },
  };
}
