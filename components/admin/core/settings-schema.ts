// Validation for store settings. Pure and isomorphic: used by the settings Server Action
// (from form fields) and by backup restore (from JSON). Never trust the input's types.

import type { Hub, Settings } from "@/lib/types";

export const LIMITS = {
  heroProducts: 10,
  hubs: 20,
  money: 100_000_000,
  reservationHours: { min: 0.5, max: 168 },
  lowStock: 1000,
} as const;

export type SettingsErrors = Partial<Record<string, string>>;

export type SettingsResult = { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors };

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();

/** Collapse whitespace and strip control characters from single-line text. */
const line = (v: unknown) =>
  text(v)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ");

const bool = (v: unknown) => v === true || v === "on" || v === "true" || v === "1";

/** Whole naira from "3,500", "₦3500" or 3500. NaN when it isn't a number. */
export function parseMoney(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : NaN;
  const s = text(v).replace(/[₦,\s]/g, "");
  if (!s) return NaN;
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(Number(s));
}

/**
 * Normalise a WhatsApp number to international digits. Nigerian local formats
 * (0803…, 803…) become 234803…; other international numbers pass through.
 */
export function normalizeWhatsapp(v: unknown): string {
  let d = text(v).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = `234${d.slice(1)}`;
  else if (d.length === 10 && /^[789]/.test(d)) d = `234${d}`;
  return d;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export const isEmail = (s: string) => s.length <= 200 && EMAIL_RE.test(s);

/** A storefront link: a site path ("/trust") or an http(s) URL. Nothing else (no javascript:). */
export function isSafeLink(s: string) {
  if (s.startsWith("/")) return !s.startsWith("//") && !/[\s\\]/.test(s) && s.length <= 300;
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && s.length <= 500;
  } catch {
    return false;
  }
}

export type SettingsInput = {
  storeName?: unknown;
  whatsapp?: unknown;
  phone?: unknown;
  email?: unknown;
  promoText?: unknown;
  promoLink?: unknown;
  promoEnabled?: unknown;
  lowStockThreshold?: unknown;
  reservationMinutes?: unknown;
  deliveryFeeLagos?: unknown;
  deliveryFeeOther?: unknown;
  freeDeliveryOver?: unknown;
  hubs?: unknown;
  bank?: unknown;
  hideSoldOut?: unknown;
  requireAccountForCheckout?: unknown;
  heroProductIds?: unknown;
};

/**
 * Validate and normalise settings. Error keys match the settings form's field names.
 * `knownProductIds`, when given, rejects hero products that don't exist.
 */
export function validateSettings(input: SettingsInput, opts: { knownProductIds?: Set<string> } = {}): SettingsResult {
  const e: SettingsErrors = {};

  const storeName = line(input.storeName);
  if (!storeName) e.storeName = "Enter the store name.";
  else if (storeName.length > 60) e.storeName = "Keep the store name under 60 characters.";

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) e.whatsapp = "Enter the WhatsApp number buyers should message.";
  else if (whatsapp.length < 11 || whatsapp.length > 15) e.whatsapp = "Use a full number, e.g. 0803 123 4567 or 2348031234567.";
  else if (whatsapp.startsWith("234") && whatsapp.length !== 13) e.whatsapp = "Nigerian numbers have 13 digits in international format (234 + 10 digits).";

  const phone = line(input.phone);
  if (!phone) e.phone = "Enter a phone number.";
  else if (phone.length > 30 || !/^[+\d][\d\s()+.-]*$/.test(phone)) e.phone = "Use digits, spaces, + ( ) and - only.";

  const email = line(input.email).toLowerCase();
  if (!email) e.email = "Enter a contact email.";
  else if (!isEmail(email)) e.email = "Enter a valid email address.";

  const promoEnabled = bool(input.promoEnabled);
  const promoText = line(input.promoText);
  const promoLink = line(input.promoLink);
  if (promoEnabled && !promoText) e.promoText = "Add the promo message, or turn the strip off.";
  else if (promoText.length > 160) e.promoText = "Keep the promo message under 160 characters.";
  if (promoLink && !isSafeLink(promoLink)) e.promoLink = "Use a site path like /trust or a full https:// link.";

  const lowStockRaw = text(input.lowStockThreshold);
  const lowStockThreshold = lowStockRaw ? Number(lowStockRaw) : NaN;
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > LIMITS.lowStock) {
    e.lowStockThreshold = `Enter a whole number from 0 to ${LIMITS.lowStock}.`;
  }

  const reservationMinutes = Number(text(input.reservationMinutes));
  const { min, max } = LIMITS.reservationHours;
  if (!Number.isFinite(reservationMinutes) || reservationMinutes < min * 60 || reservationMinutes > max * 60) {
    e.reservationHours = `Choose between ${min} and ${max} hours.`;
  }

  const money = (key: "deliveryFeeLagos" | "deliveryFeeOther" | "freeDeliveryOver", label: string) => {
    const n = parseMoney(input[key]);
    if (!Number.isFinite(n) || n < 0 || n > LIMITS.money) {
      e[key] = `Enter ${label} in naira (0 or more).`;
      return 0;
    }
    return n;
  };
  const deliveryFeeLagos = money("deliveryFeeLagos", "the Lagos fee");
  const deliveryFeeOther = money("deliveryFeeOther", "the fee for other states");
  const freeDeliveryOver = money("freeDeliveryOver", "an amount");

  // Pickup hubs. At least one: an empty list falls back to the default hubs when read.
  const rawHubs = Array.isArray(input.hubs) ? input.hubs : [];
  const hubs: Hub[] = [];
  rawHubs.slice(0, LIMITS.hubs + 1).forEach((h, i) => {
    const r = (h ?? {}) as Record<string, unknown>;
    const hub = { city: line(r.city), address: line(r.address), hours: line(r.hours) };
    if (!hub.city && !hub.address && !hub.hours) return; // blank row
    if (!hub.city || hub.city.length > 40) e[`hub.${i}.city`] = "City is required (max 40 characters).";
    if (!hub.address || hub.address.length > 160) e[`hub.${i}.address`] = "Address is required (max 160 characters).";
    if (hub.hours.length > 80) e[`hub.${i}.hours`] = "Keep opening hours under 80 characters.";
    hubs.push(hub);
  });
  if (!hubs.length) e.hubs = "Add at least one pickup hub.";
  if (hubs.length > LIMITS.hubs) e.hubs = `Up to ${LIMITS.hubs} hubs.`;

  const rb = (input.bank ?? {}) as Record<string, unknown>;
  const bank = { bankName: line(rb.bankName), accountName: line(rb.accountName), accountNumber: text(rb.accountNumber).replace(/\s/g, "") };
  const anyBank = bank.bankName || bank.accountName || bank.accountNumber;
  if (anyBank) {
    if (!bank.bankName || bank.bankName.length > 60) e.bankName = "Enter the bank name.";
    if (!bank.accountName || bank.accountName.length > 80) e.accountName = "Enter the account name.";
    if (!/^\d{10}$/.test(bank.accountNumber)) e.accountNumber = "Nigerian account numbers (NUBAN) have 10 digits.";
  }

  const rawHero = Array.isArray(input.heroProductIds) ? input.heroProductIds : [];
  const heroProductIds = [...new Set(rawHero.map(text).filter(Boolean))];
  if (heroProductIds.length > LIMITS.heroProducts) e.heroProductIds = `Pick up to ${LIMITS.heroProducts} products.`;
  else if (heroProductIds.some((id) => id.length > 120)) e.heroProductIds = "Invalid product.";
  else if (opts.knownProductIds) {
    const missing = heroProductIds.filter((id) => !opts.knownProductIds!.has(id));
    if (missing.length) e.heroProductIds = `${missing.length} picked product${missing.length === 1 ? " no longer exists" : "s no longer exist"}. Remove ${missing.length === 1 ? "it" : "them"} and save again.`;
  }

  if (Object.keys(e).length) return { ok: false, errors: e };

  return {
    ok: true,
    settings: {
      storeName,
      whatsapp,
      phone,
      email,
      promoText,
      promoLink,
      promoEnabled,
      lowStockThreshold,
      reservationMinutes: Math.round(reservationMinutes),
      deliveryFeeLagos,
      deliveryFeeOther,
      freeDeliveryOver,
      hubs,
      bank,
      hideSoldOut: bool(input.hideSoldOut),
      // Older backups predate this setting; keep sign-in required by default.
      requireAccountForCheckout: input.requireAccountForCheckout === undefined ? true : bool(input.requireAccountForCheckout),
      heroProductIds,
    },
  };
}

/** Human-readable list of what changed, for the activity log. */
export function settingsDiff(before: Settings, after: Settings): string[] {
  const out: string[] = [];
  const show = (v: unknown) => (typeof v === "string" ? (v.length > 40 ? `"${v.slice(0, 37)}…"` : `"${v}"`) : String(v));
  const keys = Object.keys(after) as (keyof Settings)[];
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (k === "hubs") out.push(`hubs ${before.hubs.length} → ${after.hubs.length} (edited)`);
    else if (k === "heroProductIds") out.push(`hero products ${before.heroProductIds.length} → ${after.heroProductIds.length}`);
    else if (k === "bank") out.push("bank details updated");
    else out.push(`${k} ${show(a)} → ${show(b)}`);
  }
  return out;
}
