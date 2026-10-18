"use server";

import { getCurrentCustomer, parseIdentifier } from "@/lib/customer-auth";
import { clientIp } from "@/lib/request-ip";
import { createStockAlert } from "@/lib/stock-alerts";
import { getProduct, rateLimit } from "@/lib/store";

export type StockAlertState = {
  ok?: boolean;
  error?: string;
  /** Masked contact we'll message. */
  display?: string;
  duplicate?: boolean;
  /** Other units of the model on sale right now. */
  inStockNow?: number;
  /** Echo of what was typed, so a failed submit doesn't wipe the form. */
  contact?: string;
  n?: number;
};

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

/** "Notify me when it's back" on sold-out products. Fields: productId, contact, exact?. */
export async function subscribeStockAlert(_prev: StockAlertState, form: FormData): Promise<StockAlertState> {
  const contact = String(form.get("contact") ?? "").trim().slice(0, 120);
  const productId = String(form.get("productId") ?? "");
  const fail = (error: string): StockAlertState => ({ error, contact, n: Date.now() });

  if (String(form.get("company") ?? "")) return { ok: true, display: "you" }; // honeypot
  if (!ID_RE.test(productId)) return fail("This product isn't available.");
  const id = parseIdentifier(contact);
  if (!id) return fail("Enter a valid email address or Nigerian phone number (e.g. 0803 123 4567).");

  const ip = await clientIp();
  if (!(await rateLimit(`stockalert-ip:${ip}`, 12, 3600))) return fail("Too many requests. Please try again later.");

  const product = await getProduct(productId);
  if (!product || product.status !== "active") return fail("This product isn't available.");
  const exact = form.get("exact") === "1";
  if (exact && product.stock > 0) return fail("Good news: this one is in stock now.");

  const customer = await getCurrentCustomer();
  try {
    const res = await createStockAlert({ product, channel: id.channel, contact: id.value, exact, customerId: customer?.id });
    if (!res.ok) return fail(res.error);
    return { ok: true, display: id.display, duplicate: res.duplicate, inStockNow: res.alert.exact ? 0 : res.inStockNow };
  } catch (e) {
    if (e instanceof Error && /^Busy/.test(e.message)) return fail("Please try again in a moment.");
    console.error("[stock-alerts] subscribe failed", e);
    return fail("Something went wrong. Please try again.");
  }
}
