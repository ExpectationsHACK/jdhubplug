import "server-only";

import { after } from "next/server";
import { absoluteUrl } from "@/components/home/site";
import { emailLayout, escapeHtml, sendEmail, sendSms, type MessageResult } from "./messaging";
import { formatNaira } from "./reference";
import { getSettings, listProducts, withLock } from "./store";
import { getDriver } from "./store/driver";
import type { CategorySlug, OtpChannel, Product } from "./types";

// Back-in-stock alerts.
//
// Shoppers ask to hear when a sold-out product is back. Graded units are one-offs, so an
// alert is keyed by product MODEL: any active unit of that model coming into stock
// triggers it, unless the shopper asked for that exact listing only.
//
// Data layout:
//   jd:stockalert:alerts  hash  id -> StockAlert JSON (kept after notifying, as history)
//   jd:stockalert:open    hash  "{contact}|{model}" -> id of the waiting alert (dedupe)
//
// processStockAlerts() is idempotent and lock-protected: an alert leaves "waiting" the
// moment a message is attempted, so a second run never messages the same shopper twice.

export type StockAlertStatus = "waiting" | "notified" | "skipped" | "failed";

export type StockAlertEvent = { at: string; event: "created" | "updated" | "sent" | "skipped" | "error" | "failed"; detail?: string };

export type StockAlert = {
  id: string;
  model: string;
  /** Listing the shopper signed up from. */
  productId: string;
  productName: string;
  category: CategorySlug;
  /** Only that exact listing counts, not other units of the model. */
  exact: boolean;
  channel: OtpChannel;
  /** Normalised email or E.164 phone. */
  contact: string;
  customerId?: string;
  /** Units of the model already in stock when the alert was made; they don't trigger it. */
  ignoreIds?: string[];
  status: StockAlertStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
  notifiedProductId?: string;
  lastError?: string;
  history: StockAlertEvent[];
};

export const MAX_ALERTS_PER_CONTACT = 20;
/** Messages sent per run, so a run fits comfortably inside the lock's lifetime. */
const MAX_SENDS_PER_RUN = 40;
const MAX_ATTEMPTS = 3;

const K = {
  alerts: "jd:stockalert:alerts",
  open: "jd:stockalert:open",
};
const LOCK = "stockalerts";

const now = () => new Date().toISOString();
const openKey = (contact: string, model: string) => `${contact}|${model}`;

function parse(json: string | null | undefined): StockAlert | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StockAlert;
  } catch {
    return null;
  }
}

async function save(a: StockAlert) {
  await getDriver().hset(K.alerts, { [a.id]: JSON.stringify(a) });
}

const push = (a: StockAlert, event: StockAlertEvent["event"], detail?: string): StockAlert => ({
  ...a,
  updatedAt: now(),
  history: [...a.history, { at: now(), event, ...(detail ? { detail: detail.slice(0, 300) } : {}) }].slice(-20),
});

/** The model an alert is grouped by (falls back to the id for products without one). */
export const alertModel = (p: Pick<Product, "id" | "model">) => p.model || p.id;

/** Every alert, newest first. */
export async function listStockAlerts(): Promise<StockAlert[]> {
  const all = await getDriver().hgetall(K.alerts);
  return Object.values(all)
    .map(parse)
    .filter((a): a is StockAlert => !!a)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getStockAlert(id: string) {
  return parse(await getDriver().hget(K.alerts, id));
}

export type CreateAlertResult = { ok: true; alert: StockAlert; duplicate: boolean; inStockNow: number } | { ok: false; error: string };

/**
 * Save an alert for `product`'s model. Contact must already be validated and normalised.
 * One waiting alert per contact and model: asking again updates it (e.g. the exact flag).
 */
export async function createStockAlert(input: {
  product: Product;
  channel: OtpChannel;
  contact: string;
  exact?: boolean;
  customerId?: string;
}): Promise<CreateAlertResult> {
  const { product, channel, contact } = input;
  const model = alertModel(product);
  const exact = !!input.exact;
  const d = getDriver();

  return withLock(`stockalert:${contact}`, async () => {
    const units = (await listProducts()).filter((p) => p.status === "active" && p.stock > 0 && alertModel(p) === model);
    const ignoreIds = units.map((p) => p.id).slice(0, 50);

    const existingId = await d.hget(K.open, openKey(contact, model));
    const existing = existingId ? await getStockAlert(existingId) : null;
    if (existing && existing.status === "waiting") {
      const changed = existing.exact !== exact || existing.productId !== product.id;
      const next = changed
        ? push({ ...existing, exact, productId: product.id, productName: product.name, customerId: existing.customerId ?? input.customerId }, "updated", exact ? "exact listing only" : "any unit of the model")
        : existing;
      if (changed) await save(next);
      return { ok: true, alert: next, duplicate: true, inStockNow: units.length };
    }

    const waiting = (await listStockAlerts()).filter((a) => a.contact === contact && a.status === "waiting").length;
    if (waiting >= MAX_ALERTS_PER_CONTACT) {
      return { ok: false, error: `You're already waiting on ${MAX_ALERTS_PER_CONTACT} items. We'll message you as they come back.` };
    }

    const at = now();
    const alert: StockAlert = {
      id: `SA-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      model,
      productId: product.id,
      productName: product.name,
      category: product.category,
      exact,
      channel,
      contact,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(ignoreIds.length ? { ignoreIds } : {}),
      status: "waiting",
      attempts: 0,
      createdAt: at,
      updatedAt: at,
      history: [{ at, event: "created", detail: exact ? "exact listing only" : "any unit of the model" }],
    };
    await save(alert);
    await d.hset(K.open, { [openKey(contact, model)]: alert.id });
    return { ok: true, alert, duplicate: false, inStockNow: units.length };
  });
}

export async function deleteStockAlert(id: string): Promise<StockAlert | null> {
  const d = getDriver();
  const a = await getStockAlert(id);
  if (!a) return null;
  await d.hdel(K.alerts, [id]);
  const key = openKey(a.contact, a.model);
  if ((await d.hget(K.open, key)) === id) await d.hdel(K.open, [key]);
  return a;
}

/** The in-stock unit an alert should point to, or null if none qualifies yet. */
function matchFor(a: StockAlert, byModel: Map<string, Product[]>): Product | null {
  const units = byModel.get(a.model) ?? [];
  if (a.exact) return units.find((p) => p.id === a.productId) ?? null;
  const fresh = units.filter((p) => !a.ignoreIds?.includes(p.id));
  // Same listing first (it came back), then the cheapest unit of the model.
  return fresh.find((p) => p.id === a.productId) ?? fresh.sort((x, y) => x.price - y.price)[0] ?? null;
}

async function deliver(a: StockAlert, p: Product, storeName: string): Promise<MessageResult> {
  const url = absoluteUrl(`/product/${encodeURIComponent(p.id)}`);
  if (a.channel === "sms") {
    return sendSms(a.contact, `${storeName}: ${p.name} is back in stock at ${formatNaira(p.price)}. Graded units go fast: ${url}`);
  }
  const name = escapeHtml(p.name);
  const spec = escapeHtml(p.spec);
  const html = emailLayout({
    storeName,
    preheader: `${p.name} is back in stock`,
    title: "It's back in stock",
    body: `<p style="margin:0 0 12px">Good news: <b>${name}</b> is available again.</p>
<p style="margin:0 0 12px">${spec}<br><b>${escapeHtml(formatNaira(p.price))}</b></p>
<p style="margin:0">Graded units are one-offs, so it may not last long.</p>`,
    cta: { label: "View it now", href: url },
    footer: `You asked ${escapeHtml(storeName)} to tell you when this was back in stock. This is a one-time message for this request.`,
  });
  const text = `Good news: ${p.name} (${p.spec}) is back in stock at ${formatNaira(p.price)}.\n\nView it: ${url}\n\nYou asked ${storeName} to tell you when this was back. This is a one-time message.`;
  return sendEmail({ to: a.contact, subject: `Back in stock: ${p.name}`, html, text });
}

export type ProcessResult = { busy?: boolean; matched: number; sent: number; skipped: number; failed: number; retrying: number; remaining: number };

/**
 * Message every waiting alert whose model now has an active unit in stock. Pass `model`
 * to handle one model only ("Send now"). Idempotent; concurrent runs wait for the lock
 * and then find nothing left to do. Without an email/SMS provider the alert is recorded
 * as "skipped" (attempted, not delivered) and is not retried.
 */
export async function processStockAlerts(opts: { model?: string } = {}): Promise<ProcessResult> {
  const empty: ProcessResult = { matched: 0, sent: 0, skipped: 0, failed: 0, retrying: 0, remaining: 0 };
  try {
    return await withLock(LOCK, async () => {
      const waiting = (await listStockAlerts()).filter((a) => a.status === "waiting" && (!opts.model || a.model === opts.model));
      if (!waiting.length) return empty;

      const byModel = new Map<string, Product[]>();
      for (const p of await listProducts()) {
        if (p.status !== "active" || p.stock <= 0) continue;
        const m = alertModel(p);
        byModel.set(m, [...(byModel.get(m) ?? []), p]);
      }

      const res = { ...empty };
      const due = waiting.map((a) => ({ a, p: matchFor(a, byModel) })).filter((x): x is { a: StockAlert; p: Product } => !!x.p);
      res.matched = due.length;
      if (!due.length) return res;

      const { storeName } = await getSettings();
      const d = getDriver();
      // Oldest requests first.
      due.sort((x, y) => x.a.createdAt.localeCompare(y.a.createdAt));
      for (const [i, { a, p }] of due.entries()) {
        if (i >= MAX_SENDS_PER_RUN) {
          res.remaining = due.length - i;
          break;
        }
        // Re-read: an admin may have deleted it meanwhile.
        const cur = await getStockAlert(a.id);
        if (!cur || cur.status !== "waiting") continue;
        const r = await deliver(cur, p, storeName).catch((e): MessageResult => ({ ok: false, error: e instanceof Error ? e.message : "send failed" }));
        const attempts = cur.attempts + 1;
        let next: StockAlert;
        if (r.ok) {
          next = push({ ...cur, attempts, status: "notified", notifiedAt: now(), notifiedProductId: p.id, lastError: undefined }, "sent", `${cur.channel} about ${p.id}${r.id ? ` (${r.id})` : ""}`);
          res.sent++;
        } else if (r.skipped) {
          next = push({ ...cur, attempts, status: "skipped", notifiedAt: now(), notifiedProductId: p.id, lastError: r.error }, "skipped", r.error);
          res.skipped++;
        } else if (attempts >= MAX_ATTEMPTS) {
          next = push({ ...cur, attempts, status: "failed", lastError: r.error }, "failed", r.error);
          res.failed++;
        } else {
          next = push({ ...cur, attempts, lastError: r.error }, "error", r.error);
          res.retrying++;
        }
        await save(next);
        if (next.status !== "waiting") {
          const key = openKey(cur.contact, cur.model);
          if ((await d.hget(K.open, key)) === cur.id) await d.hdel(K.open, [key]);
        }
      }
      return res;
    });
  } catch (e) {
    if (e instanceof Error && /^Busy/.test(e.message)) return { ...empty, busy: true };
    throw e;
  }
}

/** Run processStockAlerts after the response (from Server Actions and Route Handlers). */
export function queueStockAlerts(model?: string) {
  after(() =>
    processStockAlerts(model ? { model } : {}).catch((e) => {
      console.error("[stock-alerts] processing failed", e);
    }),
  );
}

export type ModelDemand = {
  model: string;
  name: string;
  category: CategorySlug;
  /** Waiting alerts for this model. */
  waiting: number;
  /** Of those, how many want the exact listing only. */
  exact: number;
  oldest: string;
  newest: string;
  /** Active units of the model in stock right now. */
  inStock: number;
  /** Alerts already messaged (history). */
  notified: number;
};

/**
 * Waitlist demand by model, most-wanted first. Dashboard-friendly: pass lists you
 * already loaded to avoid reading them again.
 */
export async function waitlistDemand(pre?: { alerts?: StockAlert[]; products?: Product[] }): Promise<ModelDemand[]> {
  const [alerts, products] = await Promise.all([pre?.alerts ?? listStockAlerts(), pre?.products ?? listProducts()]);
  const stock = new Map<string, number>();
  for (const p of products) if (p.status === "active" && p.stock > 0) stock.set(alertModel(p), (stock.get(alertModel(p)) ?? 0) + 1);

  const out = new Map<string, ModelDemand>();
  for (const a of alerts) {
    const row = out.get(a.model) ?? { model: a.model, name: a.productName, category: a.category, waiting: 0, exact: 0, oldest: "", newest: "", inStock: stock.get(a.model) ?? 0, notified: 0 };
    if (a.status === "waiting") {
      row.waiting++;
      if (a.exact) row.exact++;
      if (!row.oldest || a.createdAt < row.oldest) row.oldest = a.createdAt;
      if (!row.newest || a.createdAt > row.newest) {
        row.newest = a.createdAt;
        row.name = a.productName;
      }
    } else {
      row.notified++;
    }
    out.set(a.model, row);
  }
  return [...out.values()].filter((r) => r.waiting > 0).sort((x, y) => y.waiting - x.waiting || x.oldest.localeCompare(y.oldest));
}
