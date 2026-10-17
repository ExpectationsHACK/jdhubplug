"use client";

import posthog from "posthog-js";
import { analyticsAllowed } from "./consent";

// Product analytics events (PostHog). Keep event names stable: dashboards and funnels
// depend on them. Every call is a no-op until NEXT_PUBLIC_POSTHOG_KEY is set and the
// visitor has accepted analytics in the cookie banner (lib/consent.ts).
//
// Funnel: product_viewed → product_added_to_cart → checkout_started → order_placed (server)
//         → order_paid (server).

export type AnalyticsEvent =
  | "product_viewed"
  | "product_added_to_cart"
  | "product_removed_from_cart"
  | "cart_viewed"
  | "checkout_started"
  | "checkout_signin_required"
  | "offer_applied"
  | "offer_landing_viewed"
  | "search_performed"
  | "filter_applied"
  | "sell_estimate_completed"
  | "lead_submitted"
  | "signin_code_requested"
  | "signin_completed"
  | "whatsapp_clicked";

const enabled = () => typeof window !== "undefined" && analyticsAllowed();

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (!enabled()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* analytics must never break the app */
  }
}

/** Link the anonymous visitor to a signed-in customer (by opaque customer id only). */
export function identify(customerId: string) {
  if (!enabled()) return;
  try {
    posthog.identify(customerId);
  } catch {
    /* ignore */
  }
}

export function resetIdentity() {
  if (!enabled()) return;
  try {
    // reset() also clears PostHog's consent state, so re-apply the visitor's choice after it.
    const optedIn = posthog.has_opted_in_capturing();
    posthog.reset();
    if (optedIn) posthog.opt_in_capturing({ captureEventName: false });
  } catch {
    /* ignore */
  }
}

/**
 * The visitor's PostHog id, passed to the server so order events join their journey.
 * Undefined without analytics consent: the server then sends no events for the order.
 */
export function analyticsId(): string | undefined {
  if (!enabled()) return undefined;
  try {
    return posthog.get_distinct_id();
  } catch {
    return undefined;
  }
}

/** Product fields worth attaching to events. No personal data. */
export const productProps = (p: { id: string; name: string; brand: string; category: string; price: number; grade?: string }) => ({
  product_id: p.id,
  product_name: p.name,
  brand: p.brand,
  category: p.category,
  price: p.price,
  grade: p.grade,
  currency: "NGN",
});
