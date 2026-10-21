"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { describeScope, normalizeOfferCode, validateOfferInput, type OfferFieldErrors } from "@/components/admin/offers/offerInput";
import { audit, requireAdmin } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { describeDiscount } from "@/lib/pricing";
import { refreshFromAction } from "@/lib/revalidate";
import { deleteOffer, getOffer, getProducts, listOffers, saveOffer, withLock } from "@/lib/store";
import type { Offer } from "@/lib/types";

// Admin offer mutations. Every action re-checks the session and permission, validates
// input on the server and logs to the activity log.

export type SaveOfferResult = { ok: false; errors: OfferFieldErrors };

/** Codes that would clash with routes or read as system words. */
const RESERVED = new Set(["new", "admin", "api", "shop", "offer", "offers", "checkout", "cart"]);

/**
 * Create (originalCode null) or update an offer. Redirects to the offers list on
 * success; returns field errors otherwise. The code can't change after creation,
 * because printed QR codes and shared links depend on it.
 */
export async function saveOfferAction(input: unknown, originalCode: string | null): Promise<SaveOfferResult> {
  const s = await requireAdmin("offers:write");
  const parsed = validateOfferInput(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const v = parsed.value;

  // Product references must exist.
  const ids = [...(v.scope.type === "products" ? v.scope.productIds : []), ...(v.heroProductId ? [v.heroProductId] : [])];
  if (ids.length) {
    const found = await getProducts(ids);
    if (v.scope.type === "products") {
      const missing = v.scope.productIds.filter((id) => !found.has(id));
      if (missing.length === v.scope.productIds.length) return { ok: false, errors: { productIds: "None of those products exist any more." } };
      v.scope = { type: "products", productIds: v.scope.productIds.filter((id) => found.has(id)) };
    }
    if (v.heroProductId && !found.has(v.heroProductId)) delete v.heroProductId;
  }
  if (v.discount.type === "price" && v.scope.type !== "products") {
    return { ok: false, errors: { discountType: "A flash price only works with specific products. Pick products, or use percent / naira off." } };
  }

  const code = originalCode ? normalizeOfferCode(originalCode) : v.code;
  const result = await withLock(`offer:${code}`, async () => {
    const existing = await getOffer(code);
    if (originalCode) {
      if (!existing) return { error: { form: "This offer no longer exists." } as OfferFieldErrors };
      const next: Offer = { ...v, code, createdAt: existing.createdAt, updatedAt: existing.updatedAt };
      await saveOffer(next);
      return { saved: next, prev: existing };
    }
    if (RESERVED.has(code)) return { error: { code: "That code is reserved. Try another." } as OfferFieldErrors };
    if (existing) return { error: { code: "An offer already uses this code." } as OfferFieldErrors };
    const next: Offer = { ...v, code, createdAt: "", updatedAt: "" };
    await saveOffer(next);
    return { saved: next, prev: null };
  });
  if ("error" in result) return { ok: false, errors: result.error! };

  const { saved, prev } = result;
  if (prev) await audit(s, "offer.update", saved.code, diffOffer(prev, saved) || "no changes");
  else await audit(s, "offer.create", saved.code, `${describeDiscount(saved)} · ${describeScope(saved.scope)}`);

  refreshFromAction(TAGS.offers);
  redirect(`/admin/offers?saved=${encodeURIComponent(saved.code)}`);
}

function diffOffer(a: Offer, b: Offer): string {
  const out: string[] = [];
  if (a.title !== b.title) out.push(`title "${a.title}" → "${b.title}"`);
  if (a.headline !== b.headline) out.push("headline");
  if (a.description !== b.description) out.push("description");
  if (describeDiscount(a) !== describeDiscount(b)) out.push(`discount ${describeDiscount(a)} → ${describeDiscount(b)}`);
  if (JSON.stringify(a.scope) !== JSON.stringify(b.scope)) out.push(`scope ${describeScope(a.scope)} → ${describeScope(b.scope)}`);
  if (a.startsAt !== b.startsAt || a.endsAt !== b.endsAt) out.push("schedule");
  if (a.usageLimit !== b.usageLimit) out.push(`limit ${a.usageLimit ?? "none"} → ${b.usageLimit ?? "none"}`);
  if (a.minSubtotal !== b.minSubtotal) out.push(`min ${a.minSubtotal ?? 0} → ${b.minSubtotal ?? 0}`);
  if (a.heroProductId !== b.heroProductId) out.push("hero product");
  if (a.active !== b.active) out.push(b.active ? "resumed" : "paused");
  return out.join(", ");
}

export async function setOfferActiveAction(code: string, active: boolean) {
  const s = await requireAdmin("offers:write");
  if (typeof code !== "string" || typeof active !== "boolean") throw new Error("Invalid request.");
  const c = normalizeOfferCode(code);
  const changed = await withLock(`offer:${c}`, async () => {
    const o = await getOffer(c);
    if (!o || o.active === active) return false;
    await saveOffer({ ...o, active });
    return true;
  });
  if (changed) await audit(s, active ? "offer.resume" : "offer.pause", c);
  refreshFromAction(TAGS.offers);
  refresh();
}

/** Copy an offer under a new, unused code. The copy starts paused so it can be reviewed. */
export async function duplicateOfferAction(code: string) {
  const s = await requireAdmin("offers:write");
  if (typeof code !== "string") throw new Error("Invalid request.");
  const src = await getOffer(code);
  if (!src) throw new Error("That offer no longer exists.");

  const taken = new Set((await listOffers()).map((o) => o.code));
  const base = normalizeOfferCode(`${src.code}-copy`.replace(/(-copy)+(-\d+)?$/, "-copy")).slice(0, 34);
  let next = base;
  for (let n = 2; taken.has(next); n++) next = `${base}-${n}`;

  await saveOffer({ ...src, code: next, title: `${src.title} (copy)`, active: false, createdAt: "", updatedAt: "" });
  await audit(s, "offer.duplicate", next, `from ${src.code}`);
  refreshFromAction(TAGS.offers);
  redirect(`/admin/offers/${encodeURIComponent(next)}?duplicated=1`);
}

export async function deleteOfferAction(code: string) {
  const s = await requireAdmin("offers:write");
  if (typeof code !== "string") throw new Error("Invalid request.");
  const o = await getOffer(code);
  if (!o) return;
  await deleteOffer(o.code);
  await audit(s, "offer.delete", o.code, `${o.title} · ${describeDiscount(o)}`);
  refreshFromAction(TAGS.offers);
  refresh();
}

/** Delete from the edit page, then go back to the list. */
export async function deleteOfferAndReturnAction(code: string) {
  await deleteOfferAction(code);
  redirect("/admin/offers?deleted=1");
}
