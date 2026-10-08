import "server-only";

import { headers } from "next/headers";
import { connection } from "next/server";
import { sweepExpiredOrders } from "@/lib/orders";
import { getProducts, listOrders } from "@/lib/store";
import type { Order } from "@/lib/types";
import { artFor, type ArtMap } from "./parts";

/**
 * The current time for a request-time render. Waits for the request first, so the
 * clock is never baked into a prerendered shell.
 */
export async function requestNow() {
  await connection();
  return Date.now();
}

/**
 * Public origin for links the admin sends to customers (WhatsApp messages). Prefers a
 * configured URL; falls back to the request's host.
 */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Cancel expired reservations, then list every order (newest first). */
export async function sweptOrders(): Promise<{ orders: Order[]; released: number }> {
  const released = await sweepExpiredOrders().catch((e) => {
    console.error("[admin/orders] sweep failed", e);
    return 0;
  });
  return { orders: await listOrders(), released };
}

/** Illustration fallbacks for the products on the given order lines. */
export async function artForLines(lines: { productId: string }[]): Promise<ArtMap> {
  const ids = [...new Set(lines.map((l) => l.productId))];
  if (!ids.length) return {};
  return artFor(await getProducts(ids));
}
