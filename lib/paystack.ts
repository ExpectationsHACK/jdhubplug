import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { transitionOrder } from "./orders";
import { getOrder, logAudit } from "./store";
import type { Order } from "./types";

// Paystack card / bank payments. Enabled only when PAYSTACK_SECRET_KEY is set.
//
//   initializeTransaction  starts a payment and returns Paystack's hosted checkout URL
//   verifyTransaction      asks Paystack for the final state of a payment
//   confirmPayment         marks an order paid after checking amount + currency (idempotent)
//
// The browser is redirected back to /api/paystack/callback and Paystack also calls
// /api/paystack/webhook, so a payment is confirmed even if the shopper closes the tab.

const API = "https://api.paystack.co";

export const paystackEnabled = () => !!process.env.PAYSTACK_SECRET_KEY;

const secret = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack isn't configured");
  return key;
};

/** Public site URL: NEXT_PUBLIC_SITE_URL, else the origin of the current request. */
export function siteUrl(requestOrigin?: string | null) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (env || requestOrigin || (vercel ? `https://${vercel}` : "") || "http://localhost:3000").replace(/\/+$/, "");
}

/** Origin of the current request from its headers (for Server Actions). */
export async function requestOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = local ? "http" : (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

/** Paystack requires an email; shoppers who skip it get a stable placeholder. */
export function paystackEmail(order: Pick<Order, "customer">) {
  const email = order.customer.email?.trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  return `${order.customer.phone.replace(/\D/g, "") || "customer"}@customers.jdhub.ng`;
}

export const isValidReference = (ref: string) => /^[A-Za-z0-9._=-]{6,100}$/.test(ref);

/** Order id from a reference of the form "<orderId>-<random>" (order ids look like JDH-10234). */
export function orderIdFromReference(ref: string) {
  const m = /^(JDH-\d+)-/i.exec(ref);
  return m ? m[1].toUpperCase() : null;
}

type PaystackEnvelope<T> = { status: boolean; message: string; data?: T };

async function call<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
    if (!res.ok || !body?.status || body.data === undefined) {
      return { ok: false, error: body?.message || `Paystack returned ${res.status}` };
    }
    return { ok: true, data: body.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach Paystack" };
  }
}

export type InitResult = { ok: true; url: string; reference: string } | { ok: false; error: string };

/** Start a Paystack payment for a pending order. Amount is always taken from the stored order. */
export async function initializeTransaction(order: Order, site: string): Promise<InitResult> {
  if (!paystackEnabled()) return { ok: false, error: "Card payments aren't available right now." };
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const reference = `${order.id}-${random}`;
  const res = await call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: paystackEmail(order),
      amount: Math.round(order.total * 100),
      currency: "NGN",
      reference,
      // The order token rides along so the callback can return the shopper to their order
      // without trusting the reference (which only names the order id).
      callback_url: `${site}/api/paystack/callback?t=${encodeURIComponent(order.token)}`,
      metadata: {
        orderId: order.id,
        token: order.token,
        custom_fields: [{ display_name: "Order", variable_name: "order_id", value: order.id }],
      },
    }),
  });
  if (!res.ok) return res;
  return { ok: true, url: res.data.authorization_url, reference: res.data.reference || reference };
}

export type PaystackTransaction = {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  metadata?: unknown;
};

export async function verifyTransaction(reference: string) {
  if (!isValidReference(reference)) return { ok: false as const, error: "Invalid reference" };
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** HMAC-SHA512 of the raw body with the secret key, compared in constant time. */
export function verifySignature(rawBody: string, signature: string | null) {
  if (!signature || !paystackEnabled()) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function metadataOrderId(meta: unknown): string | null {
  let m = meta;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (m && typeof m === "object" && "orderId" in m && typeof (m as { orderId: unknown }).orderId === "string") {
    return (m as { orderId: string }).orderId.toUpperCase();
  }
  return null;
}

export type ConfirmResult =
  | { ok: true; order: Order; changed: boolean }
  | { ok: false; reason: string; order?: Order };

/**
 * Mark an order paid from a verified Paystack transaction. Checks the status, the
 * currency and that the amount matches the stored order total exactly. Safe to call
 * more than once for the same payment (callback + webhook).
 */
export async function confirmPayment(tx: PaystackTransaction): Promise<ConfirmResult> {
  const id = metadataOrderId(tx.metadata) ?? orderIdFromReference(tx.reference);
  if (!id) return { ok: false, reason: "No order on this payment" };
  const order = await getOrder(id);
  if (!order) return { ok: false, reason: `Order ${id} not found` };
  if (tx.status !== "success") return { ok: false, reason: `Payment ${tx.status}`, order };
  if (tx.currency !== "NGN" || tx.amount !== Math.round(order.total * 100)) {
    await logAudit({
      by: "paystack",
      action: "payment.mismatch",
      target: order.id,
      detail: `Got ${tx.currency} ${tx.amount / 100}, expected NGN ${order.total} (ref ${tx.reference})`,
    }).catch(() => undefined);
    return { ok: false, reason: "Amount mismatch", order };
  }
  if (order.status !== "pending") {
    // Already paid (or further along): nothing to do. A payment on a cancelled order needs a human.
    if (order.status === "cancelled" || order.status === "refunded") {
      await logAudit({
        by: "paystack",
        action: "payment.after-cancel",
        target: order.id,
        detail: `Payment ${tx.reference} received for a ${order.status} order. Refund or restore manually.`,
      }).catch(() => undefined);
      return { ok: false, reason: `Order is ${order.status}`, order };
    }
    return { ok: true, order, changed: false };
  }
  try {
    const paid = await transitionOrder(order.id, "paid", "paystack", { paymentReference: tx.reference, note: "Paid with Paystack" });
    return { ok: true, order: paid, changed: true };
  } catch (e) {
    const fresh = await getOrder(order.id);
    if (fresh && fresh.status !== "pending" && fresh.status !== "cancelled" && fresh.status !== "refunded") {
      return { ok: true, order: fresh, changed: false };
    }
    return { ok: false, reason: e instanceof Error ? e.message : "Couldn't update the order", order: fresh ?? order };
  }
}
