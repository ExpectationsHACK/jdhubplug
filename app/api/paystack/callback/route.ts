import { NextResponse, type NextRequest } from "next/server";
import { TAGS } from "@/lib/data";
import { confirmPayment, isValidReference, orderIdFromReference, paystackEnabled, siteUrl, verifyTransaction } from "@/lib/paystack";
import { refreshFromRoute } from "@/lib/revalidate";
import { getOrder } from "@/lib/store";

// Paystack sends the shopper back here after paying: /api/paystack/callback?reference=...
// We never trust the query string; the payment is verified with Paystack's API.

export async function GET(req: NextRequest) {
  const site = siteUrl(req.nextUrl.origin);
  const to = (path: string) => NextResponse.redirect(new URL(path, site), 303);
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "";

  if (!paystackEnabled() || !isValidReference(reference)) return to("/track");

  const verified = await verifyTransaction(reference);
  if (!verified.ok) {
    // Can't confirm right now; the webhook will still mark it paid. Send them to their order.
    const order = await orderFromRef(reference);
    return to(order ? `/order/${order.id}?t=${order.token}` : "/track");
  }

  const result = await confirmPayment(verified.data);
  if (result.ok && result.changed) refreshFromRoute(TAGS.catalog);
  const order = result.order ?? (await orderFromRef(reference));
  if (!order) return to("/track");
  const failed = !result.ok && order.status === "pending";
  return to(`/order/${order.id}?t=${order.token}${failed ? "&pay=failed" : ""}`);
}

async function orderFromRef(reference: string) {
  const id = orderIdFromReference(reference);
  return id ? getOrder(id) : null;
}
