"use server";

import { getOrderForCustomer } from "@/lib/orders";
import { initializeTransaction, paystackEnabled, requestOrigin, siteUrl } from "@/lib/paystack";

export type PayNowResult = { ok: true; url: string } | { ok: false; error: string };

/** Start (or restart) a Paystack payment for a pending order the caller holds the token for. */
export async function payNow(id: unknown, token: unknown): Promise<PayNowResult> {
  if (typeof id !== "string" || typeof token !== "string" || id.length > 30 || token.length > 64) {
    return { ok: false, error: "Order not found." };
  }
  if (!paystackEnabled()) return { ok: false, error: "Card payments aren't available right now. Pay by transfer or WhatsApp." };
  const order = await getOrderForCustomer(id, token);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "pending") return { ok: false, error: "This order doesn't need a payment." };
  if (order.reservedUntil && Date.parse(order.reservedUntil) < Date.now()) {
    return { ok: false, error: "The reservation has expired. Message us on WhatsApp to restore your order." };
  }
  const init = await initializeTransaction(order, siteUrl(await requestOrigin()));
  return init.ok ? { ok: true, url: init.url } : { ok: false, error: "Couldn't open Paystack. Try again in a moment." };
}
