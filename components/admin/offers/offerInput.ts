// Offer form input: the shape the admin form sends, plus validation shared by the
// client (instant feedback) and the Server Action (the real check). Isomorphic.

import { normalizeCode } from "@/lib/codes";
import type { CategorySlug, Offer, OfferDiscount, OfferScope } from "@/lib/types";

export const CATEGORY_SLUGS: CategorySlug[] = ["phones", "accessories", "gadgets", "cars"];

export type OfferInput = {
  title: string;
  code: string;
  headline: string;
  description: string;
  discountType: OfferDiscount["type"];
  discountValue: number | string;
  scopeType: OfferScope["type"];
  categories: string[];
  brands: string[];
  productIds: string[];
  /** datetime-local values, interpreted as Lagos time (UTC+1, no DST). */
  startsAt: string;
  endsAt: string;
  usageLimit: number | string | null;
  minSubtotal: number | string | null;
  heroProductId: string | null;
  active: boolean;
};

export type OfferFieldErrors = Partial<Record<keyof OfferInput | "form", string>>;

export type ValidOffer = Omit<Offer, "createdAt" | "updatedAt">;

/** Shared with the server (lib/codes.ts). */
export const normalizeOfferCode = normalizeCode;

/** Lagos is UTC+1 all year. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Lagos time, for datetime-local inputs. */
export function isoToLagosInput(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" in Lagos time -> ISO instant, or null if invalid. */
export function lagosInputToIso(v: string): string | null {
  if (!LOCAL_RE.test(v)) return null;
  const t = Date.parse(`${v}:00+01:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems)
    : [];

/** Parse an optional whole number. Returns undefined for empty, NaN for garbage. */
function optInt(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s₦]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/**
 * Validate untrusted form input. Pure: existence checks (unique code, known product ids)
 * happen in the Server Action, which has store access.
 */
export function validateOfferInput(raw: unknown): { ok: true; value: ValidOffer } | { ok: false; errors: OfferFieldErrors } {
  const i = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: OfferFieldErrors = {};

  const title = str(i.title, 80);
  if (title.length < 2) errors.title = "Give the offer a title (at least 2 characters).";

  const code = normalizeOfferCode(str(i.code, 80));
  if (code.length < 3) errors.code = "Use at least 3 letters, numbers or dashes.";

  const headline = str(i.headline, 120) || title;
  const description = str(i.description, 400);

  const discountType = i.discountType;
  const value = optInt(i.discountValue);
  let discount: OfferDiscount | null = null;
  if (discountType !== "percent" && discountType !== "fixed" && discountType !== "price") {
    errors.discountType = "Choose a discount type.";
  } else if (value === undefined || Number.isNaN(value)) {
    errors.discountValue = "Enter a number.";
  } else if (discountType === "percent" && (value < 1 || value > 90)) {
    errors.discountValue = "Percent off must be between 1 and 90.";
  } else if (discountType !== "percent" && (value <= 0 || value > 100_000_000)) {
    errors.discountValue = "Enter an amount above ₦0.";
  } else {
    discount = { type: discountType, value };
  }

  let scope: OfferScope | null = null;
  switch (i.scopeType) {
    case "all":
      scope = { type: "all" };
      break;
    case "categories": {
      const categories = strList(i.categories, 10, 20).filter((c): c is CategorySlug => CATEGORY_SLUGS.includes(c as CategorySlug));
      if (!categories.length) errors.categories = "Pick at least one category.";
      else scope = { type: "categories", categories };
      break;
    }
    case "brands": {
      const brands = strList(i.brands, 50, 40);
      if (!brands.length) errors.brands = "Pick at least one brand.";
      else scope = { type: "brands", brands };
      break;
    }
    case "products": {
      const productIds = strList(i.productIds, 500, 80);
      if (!productIds.length) errors.productIds = "Pick at least one product.";
      else scope = { type: "products", productIds };
      break;
    }
    default:
      errors.scopeType = "Choose which products the offer covers.";
  }

  const startsAt = lagosInputToIso(str(i.startsAt, 20));
  const endsAt = lagosInputToIso(str(i.endsAt, 20));
  if (!startsAt) errors.startsAt = "Pick a start date and time.";
  if (!endsAt) errors.endsAt = "Pick an end date and time.";
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.endsAt = "The offer must end after it starts.";

  const usageLimit = optInt(i.usageLimit);
  if (usageLimit !== undefined && (Number.isNaN(usageLimit) || usageLimit < 1 || usageLimit > 1_000_000))
    errors.usageLimit = "Use a whole number of orders, 1 or more (or leave empty).";

  const minSubtotal = optInt(i.minSubtotal);
  if (minSubtotal !== undefined && (Number.isNaN(minSubtotal) || minSubtotal < 0 || minSubtotal > 1_000_000_000))
    errors.minSubtotal = "Enter an amount in naira (or leave empty).";

  const heroProductId = str(i.heroProductId, 80) || undefined;
  const active = i.active === true || i.active === "true" || i.active === "on";

  if (Object.keys(errors).length || !discount || !scope || !startsAt || !endsAt) return { ok: false, errors };

  return {
    ok: true,
    value: {
      code,
      title,
      headline,
      description,
      discount,
      scope,
      startsAt,
      endsAt,
      active,
      ...(usageLimit ? { usageLimit } : {}),
      ...(minSubtotal ? { minSubtotal } : {}),
      ...(heroProductId ? { heroProductId } : {}),
    },
  };
}

/** Form defaults for an existing offer. */
export function offerToInput(o: Offer): OfferInput {
  return {
    title: o.title,
    code: o.code,
    headline: o.headline,
    description: o.description,
    discountType: o.discount.type,
    discountValue: o.discount.value,
    scopeType: o.scope.type,
    categories: o.scope.type === "categories" ? o.scope.categories : [],
    brands: o.scope.type === "brands" ? o.scope.brands : [],
    productIds: o.scope.type === "products" ? o.scope.productIds : [],
    startsAt: isoToLagosInput(o.startsAt),
    endsAt: isoToLagosInput(o.endsAt),
    usageLimit: o.usageLimit ?? null,
    minSubtotal: o.minSubtotal ?? null,
    heroProductId: o.heroProductId ?? null,
    active: o.active,
  };
}

/** One-line summary of what an offer covers, e.g. "Phones, Gadgets" or "12 products". */
export function describeScope(scope: OfferScope, productName?: (id: string) => string | undefined): string {
  switch (scope.type) {
    case "all":
      return "All products";
    case "categories":
      return scope.categories.map((c) => c[0].toUpperCase() + c.slice(1)).join(", ");
    case "brands":
      return scope.brands.length <= 3 ? scope.brands.join(", ") : `${scope.brands.slice(0, 3).join(", ")} +${scope.brands.length - 3}`;
    case "products": {
      if (scope.productIds.length === 1 && productName) return productName(scope.productIds[0]) ?? "1 product";
      return `${scope.productIds.length} product${scope.productIds.length === 1 ? "" : "s"}`;
    }
  }
}
