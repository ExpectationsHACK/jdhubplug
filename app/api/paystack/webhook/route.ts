import { TAGS } from "@/lib/data";
import { confirmPayment, paystackEnabled, verifySignature, type PaystackTransaction } from "@/lib/paystack";
import { refreshFromRoute } from "@/lib/revalidate";

// Paystack webhook. Every request is authenticated with the x-paystack-signature
// header (HMAC-SHA512 of the raw body with the secret key). Handled and ignored
// events both get a quick 200 so Paystack doesn't keep retrying.

export async function POST(req: Request) {
  if (!paystackEnabled()) return new Response("Paystack not configured", { status: 404 });
  const raw = await req.text();
  if (raw.length > 200_000) return new Response("Too large", { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: Partial<PaystackTransaction> };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (event.event === "charge.success" && event.data && typeof event.data.reference === "string") {
    const d = event.data;
    const result = await confirmPayment({
      status: String(d.status ?? ""),
      reference: d.reference!,
      amount: Number(d.amount),
      currency: String(d.currency ?? ""),
      metadata: d.metadata,
    }).catch(() => null);
    if (result?.ok && result.changed) refreshFromRoute(TAGS.catalog);
  }

  return Response.json({ received: true });
}
