import { TAGS } from "@/lib/data";
import { sweepExpiredOrders } from "@/lib/orders";
import { refreshFromRoute } from "@/lib/revalidate";
import { logAudit } from "@/lib/store";

// Daily clean-up (vercel.json → crons). Cancels unpaid orders whose reservation window
// has passed, which puts their stock back on sale, then refreshes the storefront.
// When CRON_SECRET is set, Vercel Cron sends it as a Bearer token and nothing else may call this.

const enc = new TextEncoder();

/** Constant-time comparison so the secret can't be guessed byte by byte from timings. */
function safeEqual(a: string, b: string) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function GET(request: Request) {
  // Reading the request keeps this handler dynamic (never prerendered at build time).
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && !safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const released = await sweepExpiredOrders();
  refreshFromRoute(TAGS.catalog, TAGS.offers);
  if (released > 0) {
    await logAudit({ by: "Cron", action: "cron.sweep", detail: `${released} expired order${released === 1 ? "" : "s"} released` }).catch(() => undefined);
  }
  return Response.json({ released, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
