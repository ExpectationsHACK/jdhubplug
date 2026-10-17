"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { TAGS } from "@/lib/data";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { clientIp } from "@/lib/request-ip";
import { refreshFromAction } from "@/lib/revalidate";
import { submitReview } from "@/lib/reviews";
import { rateLimit } from "@/lib/store";

// "Rate your purchase" on the order page. The order token proves the caller is the
// buyer (it works for guests too); lib/reviews.ts checks the order was delivered and
// that the line has no review yet.

export type ReviewFormState = { ok?: boolean; error?: string; field?: "rating" | "title" | "body"; published?: boolean };

const ID_RE = /^[A-Za-z0-9-]{3,30}$/;
const TOKEN_RE = /^[a-f0-9]{16,64}$/i;
const PRODUCT_RE = /^[A-Za-z0-9_-]{1,120}$/;

/** Fields: orderId, token, productId, rating (1–5), title, body. */
export async function submitReviewAction(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  try {
    const orderId = String(form.get("orderId") ?? "");
    const token = String(form.get("token") ?? "");
    const productId = String(form.get("productId") ?? "");
    if (!ID_RE.test(orderId) || !TOKEN_RE.test(token) || !PRODUCT_RE.test(productId)) return { error: "Order not found." };

    if (!(await rateLimit(`review:ip:${await clientIp()}`, 10, 3600))) {
      return { error: "Too many reviews from this connection. Please try again later." };
    }

    const customer = await getCurrentCustomer().catch(() => null);
    const res = await submitReview({
      orderId,
      token,
      productId,
      rating: form.get("rating"),
      title: form.get("title"),
      body: form.get("body"),
      customerId: customer?.id,
    });
    if (!res.ok) return { error: res.error, field: res.field };

    const published = res.review.status === "published";
    if (published) refreshFromAction(TAGS.reviews);
    refresh();
    return { ok: true, published };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[reviews] submit failed", e);
    return { error: "Something went wrong. Please try again." };
  }
}
