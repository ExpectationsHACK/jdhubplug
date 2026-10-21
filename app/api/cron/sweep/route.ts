import { TAGS } from "@/lib/data";
import { sweepExpiredOrders } from "@/lib/orders";
import { refreshFromRoute } from "@/lib/revalidate";
import { processStockAlerts } from "@/lib/stock-alerts";
import { logAudit } from "@/lib/store";

// Daily clean-up (vercel.json → crons). Cancels unpaid orders whose reservation window
// has passed, which puts their stock back on sale, then refreshes the storefront and
// sends any back-in-stock alerts that are now due (a safety net for missed triggers).
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
  // In production the sweep needs CRON_SECRET; without it nobody can call it (checkouts still sweep).
  if (secret ? !safeEqual(header, `Bearer ${secret}`) : process.env.NODE_ENV === "production") {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const released = await sweepExpiredOrders();
  refreshFromRoute(TAGS.catalog, TAGS.offers);
  if (released > 0) {
    await logAudit({ by: "Cron", action: "cron.sweep", detail: `${released} expired order${released === 1 ? "" : "s"} released` }).catch(() => undefined);
  }
  const alerts = await processStockAlerts().catch((e) => {
    console.error("[cron] stock alerts failed", e);
    return null;
  });
  if (alerts && (alerts.sent || alerts.skipped || alerts.failed)) {
    await logAudit({ by: "Cron", action: "cron.stock-alerts", detail: `${alerts.sent} sent, ${alerts.skipped} not delivered, ${alerts.failed} failed` }).catch(() => undefined);
  }
  return Response.json({ released, alerts, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
