import { NextResponse, type NextRequest } from "next/server";
import { TAGS } from "@/lib/data";
import { confirmPayment, isValidReference, orderIdFromReference, paystackEnabled, siteUrl, verifyTransaction } from "@/lib/paystack";
import { refreshFromRoute } from "@/lib/revalidate";
import { getOrder } from "@/lib/store";
import type { Order } from "@/lib/types";

// Paystack sends the shopper back here after paying: /api/paystack/callback?reference=...
// We never trust the query string; the payment is verified with Paystack's API.

export async function GET(req: NextRequest) {
  const site = siteUrl(req.nextUrl.origin);
  const to = (path: string) => NextResponse.redirect(new URL(path, site), 303);
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "";

  if (!paystackEnabled() || !isValidReference(reference)) return to("/track");

  // The order link (with its secret token) is only given back to someone who already
  // holds the token: from our callback_url, or in a transaction Paystack verified.
  const given = req.nextUrl.searchParams.get("t") ?? "";
  const orderLink = (order: Order, extra = "") => (given && order.token === given ? `/order/${order.id}?t=${order.token}${extra}` : "/track");

  const verified = await verifyTransaction(reference);
  if (!verified.ok) {
    // Can't confirm right now; the webhook will still mark it paid. Send them to their order.
    const order = await orderFromRef(reference);
    return to(order ? orderLink(order) : "/track");
  }

  const result = await confirmPayment(verified.data);
  if (result.ok && result.changed) refreshFromRoute(TAGS.catalog);
  const order = result.order ?? (await orderFromRef(reference));
  if (!order) return to("/track");
  const failed = !result.ok && order.status === "pending";
  const metaToken = (verified.data.metadata as { token?: unknown } | null | undefined)?.token;
  if (!given && typeof metaToken === "string" && metaToken === order.token) {
    return to(`/order/${order.id}?t=${order.token}${failed ? "&pay=failed" : ""}`);
  }
  return to(orderLink(order, failed ? "&pay=failed" : ""));
}

async function orderFromRef(reference: string) {
  const id = orderIdFromReference(reference);
  return id ? getOrder(id) : null;
}
