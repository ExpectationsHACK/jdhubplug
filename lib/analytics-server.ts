import "server-only";

import { after } from "next/server";

// Server-side analytics for events the browser can't be trusted with (orders,
// payments). Sent straight to PostHog's capture API after the response is
// flushed, so it never slows a request down. No-op without NEXT_PUBLIC_POSTHOG_KEY.

export type ServerEvent = "order_placed" | "order_paid" | "order_cancelled" | "order_refunded" | "order_completed" | "offer_link_opened";

export function captureServer(event: ServerEvent, distinctId: string, properties: Record<string, unknown> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  const send = () =>
    fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties: { ...properties, $lib: "jdhub-server" }, timestamp: new Date().toISOString() }),
      cache: "no-store",
    }).catch((e) => console.warn("[analytics] server capture failed", e));
  try {
    after(send);
  } catch {
    // Outside a request (scripts/tests): send without waiting.
    void send();
  }
}
