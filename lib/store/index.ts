import "server-only";

import { buildSeedProducts } from "../catalog";
import { withDefaults } from "../settings";
import type { AuditEntry, Customer, Lead, Offer, OfferStats, Order, Product, Settings, StaffUser } from "../types";
import { getDriver, storageStatus } from "./driver";

export { storageStatus };

// Data layout (same keys in Redis and in the memory driver):
//   jd:products   hash  id -> Product JSON (without stock/sold)
//   jd:stock      hash  id -> units available (atomic counter)
//   jd:sold       hash  id -> units sold
//   jd:orders     hash  id -> Order JSON
//   jd:offers     hash  code -> Offer JSON
//   jd:offerstats hash  "{code}:views|orders|revenue" -> number
//   jd:leads      hash  id -> Lead JSON
//   jd:staff      hash  id -> StaffUser JSON
//   jd:settings   string Settings JSON
//   jd:audit      list  AuditEntry JSON, newest first, capped at 1000
//   jd:customers  hash  id -> Customer JSON
//   jd:customer:by hash "phone:+234..." | "email:..." -> customer id
//   jd:otp:{key}  string one-time code record (hashed code, expiry, attempts)
//   jd:rl:{key}   string rate-limit window record
//   jd:meta       hash  seeded -> seed version
//   jd:seq:order  counter for order numbers

const K = {
  products: "jd:products",
  stock: "jd:stock",
  sold: "jd:sold",
  orders: "jd:orders",
  offers: "jd:offers",
  offerStats: "jd:offerstats",
  leads: "jd:leads",
  staff: "jd:staff",
  settings: "jd:settings",
  audit: "jd:audit",
  meta: "jd:meta",
  orderSeq: "jd:seq:order",
  seedLock: "jd:seed-lock",
  loginFail: (who: string) => `jd:loginfail:${who}`,
  customers: "jd:customers",
  customerIndex: "jd:customer:by",
  otp: (key: string) => `jd:otp:${key}`,
  rateLimit: (key: string) => `jd:rl:${key}`,
  sessionEpoch: "jd:session-epoch",
};

const SEED_VERSION = "1";

const parse = <T>(s: string | null | undefined): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------- Seed

const g = globalThis as unknown as { __jdhubSeeded?: Promise<void> };

/** Write the seed catalog the first time the store is used. Safe to call often. */
export function ensureSeeded(): Promise<void> {
  if (!g.__jdhubSeeded) {
    g.__jdhubSeeded = seed().catch((e) => {
      g.__jdhubSeeded = undefined;
      throw e;
    });
  }
  return g.__jdhubSeeded;
}

async function seed() {
  const d = getDriver();
  if (await d.hget(K.meta, "seeded")) return;
  if (!(await d.setNx(K.seedLock, "1", 60))) {
    // Another instance is seeding; wait for it.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await d.hget(K.meta, "seeded")) return;
    }
    throw new Error("Timed out waiting for the store to be seeded");
  }
  const products = buildSeedProducts();
  await writeProducts(products, true);
  await d.hset(K.meta, { seeded: SEED_VERSION, seededAt: now() });
}

// ------------------------------------------------------------------ Products

function stripCounters(p: Product): Omit<Product, "stock" | "sold"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stock, sold, ...rest } = p;
  return rest;
}

async function writeProducts(products: Product[], withStock: boolean) {
  const d = getDriver();
  if (!products.length) return;
  await d.hset(K.products, Object.fromEntries(products.map((p) => [p.id, JSON.stringify(stripCounters(p))])));
  if (withStock) {
    await d.hset(K.stock, Object.fromEntries(products.map((p) => [p.id, String(Math.max(0, Math.floor(p.stock)))])));
  }
}

function merge(json: string | null, stock: string | null, sold: string | null): Product | null {
  const p = parse<Product>(json);
  if (!p) return null;
  return { ...p, stock: Math.max(0, Number(stock ?? 0)), sold: Math.max(0, Number(sold ?? 0)) };
}

/** Every product (any status), newest first. Uncached: use lib/data.ts on the storefront. */
export async function listProducts(): Promise<Product[]> {
  await ensureSeeded();
  const d = getDriver();
  const [all, stock, sold] = await Promise.all([d.hgetall(K.products), d.hgetall(K.stock), d.hgetall(K.sold)]);
  const out: Product[] = [];
  for (const [id, json] of Object.entries(all)) {
    const p = merge(json, stock[id] ?? null, sold[id] ?? null);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProduct(id: string): Promise<Product | null> {
  await ensureSeeded();
  const d = getDriver();
  const [json, stock, sold] = await Promise.all([d.hget(K.products, id), d.hget(K.stock, id), d.hget(K.sold, id)]);
  return merge(json, stock, sold);
}

export async function getProducts(ids: string[]): Promise<Map<string, Product>> {
  await ensureSeeded();
  const d = getDriver();
  const unique = [...new Set(ids)];
  const [jsons, stocks, solds] = await Promise.all([d.hmget(K.products, unique), d.hmget(K.stock, unique), d.hmget(K.sold, unique)]);
  const out = new Map<string, Product>();
  unique.forEach((id, i) => {
    const p = merge(jsons[i], stocks[i], solds[i]);
    if (p) out.set(id, p);
  });
  return out;
}

/**
 * Create or update products. `stock` on each product is written as the new absolute
 * stock level unless `keepStock` is set (then only the product fields are written).
 */
export async function saveProducts(products: Product[], opts: { keepStock?: boolean } = {}) {
  await ensureSeeded();
  const stamped = products.map((p) => ({ ...p, updatedAt: now(), createdAt: p.createdAt || now() }));
  await writeProducts(stamped, !opts.keepStock);
  return stamped;
}

export async function saveProduct(p: Product, opts: { keepStock?: boolean } = {}) {
  return (await saveProducts([p], opts))[0];
}

export async function deleteProducts(ids: string[]) {
  const d = getDriver();
  await Promise.all([d.hdel(K.products, ids), d.hdel(K.stock, ids), d.hdel(K.sold, ids)]);
}

export async function setStock(id: string, units: number) {
  await getDriver().hset(K.stock, { [id]: String(Math.max(0, Math.floor(units))) });
}

/** Add (or remove, with a negative delta) units. Never goes below zero. */
export async function adjustStock(id: string, delta: number) {
  const d = getDriver();
  const n = await d.hincrby(K.stock, id, Math.trunc(delta));
  if (n < 0) {
    await d.hset(K.stock, { [id]: "0" });
    return 0;
  }
  return n;
}

/** Atomically take units for an order. All-or-nothing. */
export async function reserveStock(lines: { productId: string; qty: number }[]) {
  await ensureSeeded();
  return getDriver().reserve(
    K.stock,
    K.sold,
    lines.map((l) => [l.productId, l.qty]),
  );
}

/** Return units from a cancelled or refunded order. */
export async function releaseStock(lines: { productId: string; qty: number }[]) {
  await getDriver().release(
    K.stock,
    K.sold,
    lines.map((l) => [l.productId, l.qty]),
  );
}

export function newProductId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "item"}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Wipe the catalog and write the seed again. Orders, offers and settings are kept. */
export async function resetCatalogToSeed() {
  const d = getDriver();
  await Promise.all([d.del(K.products), d.del(K.stock), d.del(K.sold)]);
  await writeProducts(buildSeedProducts(), true);
  await d.hset(K.meta, { seeded: SEED_VERSION, seededAt: now() });
}

// -------------------------------------------------------------------- Orders

export async function nextOrderId() {
  const n = await getDriver().incr(K.orderSeq);
  return `JDH-${10_000 + n}`;
}

export async function saveOrder(o: Order) {
  const stamped = { ...o, updatedAt: now() };
  await getDriver().hset(K.orders, { [o.id]: JSON.stringify(stamped) });
  return stamped;
}

export async function getOrder(id: string): Promise<Order | null> {
  return parse<Order>(await getDriver().hget(K.orders, id.toUpperCase()));
}

/** All orders, newest first. */
export async function listOrders(): Promise<Order[]> {
  const all = await getDriver().hgetall(K.orders);
  return Object.values(all)
    .map((j) => parse<Order>(j))
    .filter((o): o is Order => !!o)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// -------------------------------------------------------------------- Offers

export const normalizeCode = (code: string) =>
  code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export async function listOffers(): Promise<Offer[]> {
  const all = await getDriver().hgetall(K.offers);
  return Object.values(all)
    .map((j) => parse<Offer>(j))
    .filter((o): o is Offer => !!o)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOffer(code: string): Promise<Offer | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  return parse<Offer>(await getDriver().hget(K.offers, c));
}

export async function saveOffer(o: Offer) {
  const stamped = { ...o, code: normalizeCode(o.code), updatedAt: now(), createdAt: o.createdAt || now() };
  await getDriver().hset(K.offers, { [stamped.code]: JSON.stringify(stamped) });
  return stamped;
}

export async function deleteOffer(code: string) {
  const c = normalizeCode(code);
  const d = getDriver();
  await d.hdel(K.offers, [c]);
  await d.hdel(K.offerStats, [`${c}:views`, `${c}:orders`, `${c}:revenue`]);
}

export async function bumpOfferStat(code: string, field: keyof OfferStats, by: number) {
  return getDriver().hincrby(K.offerStats, `${normalizeCode(code)}:${field}`, Math.round(by));
}

export async function getOfferStats(code: string): Promise<OfferStats> {
  const c = normalizeCode(code);
  const [views, orders, revenue] = await getDriver().hmget(K.offerStats, [`${c}:views`, `${c}:orders`, `${c}:revenue`]);
  return { views: Number(views ?? 0), orders: Number(orders ?? 0), revenue: Number(revenue ?? 0) };
}

export async function getAllOfferStats(): Promise<Record<string, OfferStats>> {
  const all = await getDriver().hgetall(K.offerStats);
  const out: Record<string, OfferStats> = {};
  for (const [k, v] of Object.entries(all)) {
    const i = k.lastIndexOf(":");
    const code = k.slice(0, i);
    const field = k.slice(i + 1) as keyof OfferStats;
    out[code] ??= { views: 0, orders: 0, revenue: 0 };
    out[code][field] = Number(v);
  }
  return out;
}

// --------------------------------------------------------------------- Leads

export async function createLead(input: Omit<Lead, "id" | "status" | "createdAt" | "updatedAt">) {
  const lead: Lead = {
    ...input,
    id: `L-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    status: "new",
    createdAt: now(),
    updatedAt: now(),
  };
  await getDriver().hset(K.leads, { [lead.id]: JSON.stringify(lead) });
  return lead;
}

export async function listLeads(): Promise<Lead[]> {
  const all = await getDriver().hgetall(K.leads);
  return Object.values(all)
    .map((j) => parse<Lead>(j))
    .filter((l): l is Lead => !!l)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLead(l: Lead) {
  const stamped = { ...l, updatedAt: now() };
  await getDriver().hset(K.leads, { [l.id]: JSON.stringify(stamped) });
  return stamped;
}

export async function deleteLead(id: string) {
  await getDriver().hdel(K.leads, [id]);
}

// ------------------------------------------------------------------ Settings

export async function getSettings(): Promise<Settings> {
  return withDefaults(parse<Partial<Settings>>(await getDriver().get(K.settings)));
}

export async function saveSettings(s: Settings) {
  await getDriver().set(K.settings, JSON.stringify(s));
  return s;
}

// --------------------------------------------------------------------- Staff

export async function listStaff(): Promise<StaffUser[]> {
  const all = await getDriver().hgetall(K.staff);
  return Object.values(all)
    .map((j) => parse<StaffUser>(j))
    .filter((u): u is StaffUser => !!u)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function findStaffByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return (await listStaff()).find((u) => u.email.toLowerCase() === e) ?? null;
}

export async function saveStaff(u: StaffUser) {
  await getDriver().hset(K.staff, { [u.id]: JSON.stringify(u) });
  return u;
}

export async function deleteStaff(id: string) {
  await getDriver().hdel(K.staff, [id]);
}

// ----------------------------------------------------------------- Customers

export async function getCustomer(id: string): Promise<Customer | null> {
  return parse<Customer>(await getDriver().hget(K.customers, id));
}

export async function findCustomer(by: { phone?: string; email?: string }): Promise<Customer | null> {
  const d = getDriver();
  const key = by.phone ? `phone:${by.phone}` : by.email ? `email:${by.email.toLowerCase()}` : null;
  if (!key) return null;
  const id = await d.hget(K.customerIndex, key);
  return id ? getCustomer(id) : null;
}

export async function saveCustomer(c: Customer) {
  const d = getDriver();
  const prev = await getCustomer(c.id);
  await d.hset(K.customers, { [c.id]: JSON.stringify(c) });
  // Keep the phone/email lookup index in step with the record.
  const stale = [prev?.phone && prev.phone !== c.phone ? `phone:${prev.phone}` : "", prev?.email && prev.email !== c.email ? `email:${prev.email.toLowerCase()}` : ""].filter(Boolean);
  if (stale.length) await d.hdel(K.customerIndex, stale);
  const index: Record<string, string> = {};
  if (c.phone) index[`phone:${c.phone}`] = c.id;
  if (c.email) index[`email:${c.email.toLowerCase()}`] = c.id;
  if (Object.keys(index).length) await d.hset(K.customerIndex, index);
  return c;
}

export async function listCustomers(): Promise<Customer[]> {
  const all = await getDriver().hgetall(K.customers);
  return Object.values(all)
    .map((j) => parse<Customer>(j))
    .filter((c): c is Customer => !!c)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------- One-time codes

export type OtpRecord = { hash: string; exp: number; attempts: number; sentAt: number };

export async function getOtp(key: string) {
  return parse<OtpRecord>(await getDriver().get(K.otp(key)));
}

export async function putOtp(key: string, rec: OtpRecord) {
  await getDriver().set(K.otp(key), JSON.stringify(rec));
}

export async function deleteOtp(key: string) {
  await getDriver().del(K.otp(key));
}

// ------------------------------------------------------------- Rate limits

/**
 * Fixed-window rate limiter. Returns true if this hit is allowed (and counts it),
 * false once `limit` hits have happened inside the current window.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const d = getDriver();
  const rec = parse<{ n: number; until: number }>(await d.get(K.rateLimit(key)));
  const nowMs = Date.now();
  if (!rec || rec.until < nowMs) {
    await d.set(K.rateLimit(key), JSON.stringify({ n: 1, until: nowMs + windowSeconds * 1000 }));
    return true;
  }
  if (rec.n >= limit) return false;
  await d.set(K.rateLimit(key), JSON.stringify({ n: rec.n + 1, until: rec.until }));
  return true;
}

// ---------------------------------------------------------- Session epoch

/** Bumping the epoch invalidates every admin and customer session issued before it. */
export async function getSessionEpoch(): Promise<number> {
  return Number((await getDriver().get(K.sessionEpoch)) ?? 0);
}

export async function bumpSessionEpoch(): Promise<number> {
  return getDriver().incr(K.sessionEpoch);
}

// --------------------------------------------------------------- Login limit

/** Failed logins in the current 15-minute window for this key (IP or email). */
export async function loginFailures(who: string): Promise<number> {
  const rec = parse<{ n: number; until: number }>(await getDriver().get(K.loginFail(who)));
  if (!rec || rec.until < Date.now()) return 0;
  return rec.n;
}

export async function recordLoginFailure(who: string) {
  const d = getDriver();
  const rec = parse<{ n: number; until: number }>(await d.get(K.loginFail(who)));
  const fresh = !rec || rec.until < Date.now();
  await d.set(K.loginFail(who), JSON.stringify({ n: fresh ? 1 : rec!.n + 1, until: fresh ? Date.now() + 15 * 60_000 : rec!.until }));
}

export async function clearLoginFailures(who: string) {
  await getDriver().del(K.loginFail(who));
}

// --------------------------------------------------------------------- Locks

/**
 * Run `fn` while holding a short-lived named lock, so read-modify-write updates
 * (like order status changes) can't interleave. Waits up to ~5s for the lock.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const d = getDriver();
  const key = `jd:lock:${name}`;
  for (let i = 0; ; i++) {
    if (await d.setNx(key, "1", 15)) break;
    if (i >= 50) throw new Error(`Busy: ${name}. Try again.`);
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    return await fn();
  } finally {
    await d.del(key).catch(() => undefined);
  }
}

// --------------------------------------------------------------------- Audit

export async function logAudit(entry: Omit<AuditEntry, "at">) {
  const d = getDriver();
  await d.lpush(K.audit, JSON.stringify({ ...entry, at: now() }));
  await d.ltrim(K.audit, 0, 999);
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const rows = await getDriver().lrange(K.audit, 0, limit - 1);
  return rows.map((r) => parse<AuditEntry>(r)).filter((r): r is AuditEntry => !!r);
}
