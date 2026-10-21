import "server-only";

import { unstable_rethrow } from "next/navigation";
import { requireAdmin, type Permission } from "@/lib/auth";
import type { Session } from "@/lib/session";

// Shared plumbing for the product and inventory Server Actions: an auth check, a
// result shape the client can render, and error handling that never leaks internals.

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string };

/** An error whose message is safe and useful to show the admin. */
export class UserError extends Error {}

export const ok = <T,>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });

/**
 * Run an admin mutation: require the permission (signed-out users are redirected to
 * the login page), then turn thrown errors into a friendly result instead of an
 * error page.
 */
export async function runAction<T>(perm: Permission, fn: (s: Session) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const s = await requireAdmin(perm);
    return await fn(s);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError) return { ok: false, error: e.message };
    const msg = e instanceof Error ? e.message : "";
    // requireAdmin's permission error and withLock's busy error are written for people.
    if (/permission|^Busy/i.test(msg)) return { ok: false, error: /^Busy/.test(msg) ? "Someone else is saving products right now. Try again." : msg };
    console.error("[admin/products]", e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Validate a product id received from the client before using it as a store key. */
export function checkId(id: unknown): string {
  if (typeof id !== "string" || !id || id.length > 120 || /[\u0000-\u001f]/.test(id)) throw new UserError("Unknown product.");
  return id;
}

/** Validate a list of product ids (deduplicated, capped). */
export function checkIds(ids: unknown, max = 5000): string[] {
  if (!Array.isArray(ids) || !ids.length) throw new UserError("Select at least one product.");
  if (ids.length > max) throw new UserError(`Select at most ${max} products at a time.`);
  return [...new Set(ids.map(checkId))];
}

/** Whole number within [min, max], or a UserError with `label` in the message. */
export function checkInt(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new UserError(`${label} must be a whole number from ${min.toLocaleString("en-NG")} to ${max.toLocaleString("en-NG")}.`);
  }
  return v;
}

/** Lock name shared by every product field write, so read-modify-write saves can't interleave. */
export const PRODUCTS_LOCK = "products";
