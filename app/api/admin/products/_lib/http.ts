import "server-only";

import { NextResponse } from "next/server";

// Helpers for the admin product Route Handlers (export, import, upload).

export const jsonError = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ...extra, error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Reject cross-site POSTs. The session cookie is SameSite=Lax, so browsers already
 * withhold it from cross-site POSTs; this is defence in depth.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
