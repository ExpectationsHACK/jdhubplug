import "server-only";

import { headers } from "next/headers";

/** The caller's IP (Vercel sets x-forwarded-for / x-real-ip and strips client-supplied values). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}
