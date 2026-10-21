import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type BackupFile } from "@/components/admin/core/backup-schema";
import { audit, can, getSession } from "@/lib/auth";
import type { Session } from "@/lib/session";
import { TAGS } from "@/lib/data";
import { refreshFromRoute } from "@/lib/revalidate";
import {
  bumpOfferStat,
  deleteProducts,
  getAllOfferStats,
  getSettings,
  listLeads,
  listOffers,
  listOrders,
  listProducts,
  saveLead,
  saveOffer,
  saveProducts,
  saveSettings,
} from "@/lib/store";

// Full JSON backup (GET) and restore (POST) for the owner. Restore goes through a
// Route Handler rather than a Server Action because backups outgrow the 1 MB action
// body limit. Staff password hashes and salts are never exported.

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB request bodies.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

type Authed = { ok: true; session: Session } | { ok: false; res: Response };

async function authorize(): Promise<Authed> {
  const session = await getSession();
  if (!session) return { ok: false, res: json({ error: "Sign in to the admin first." }, 401) };
  if (!can(session.role, "danger")) return { ok: false, res: json({ error: "Only the owner can back up or restore data." }, 403) };
  return { ok: true, session };
}

export async function GET() {
  const auth = await authorize();
  if (!auth.ok) return auth.res;

  const [products, orders, offers, offerStats, leads, settings] = await Promise.all([
    listProducts(),
    listOrders(),
    listOffers(),
    getAllOfferStats(),
    listLeads(),
    getSettings(),
  ]);
  const exportedAt = new Date().toISOString();
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    exportedBy: auth.session.name,
    counts: { products: products.length, orders: orders.length, offers: offers.length, leads: leads.length },
    products,
    orders,
    offers,
    offerStats,
    leads,
    settings,
  };
  await audit(auth.session, "backup.download", undefined, `${products.length} products, ${orders.length} orders, ${offers.length} offers, ${leads.length} requests`);

  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jdhub-backup-${exportedAt.slice(0, 10)}.json"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type RestoreOptions ={ dryRun: boolean; replaceCatalog: boolean; settings: boolean; offers: boolean; leads: boolean };

/**
 * Restore from a backup. Body: { options: RestoreOptions, backup: BackupFile }.
 * With options.dryRun it only validates and reports what would change.
 */
export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.res;

  // Same-origin JSON only. The session cookie is SameSite=Lax, and a JSON content type
  // forces a CORS preflight, so other sites can't drive this endpoint.
  if (!sameOrigin(request)) return json({ error: "Cross-site request blocked." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send the backup as JSON." }, 415);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return json({ error: "That backup is larger than 4 MB. Restore it in parts or contact support." }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "That backup is larger than 4 MB." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "That file isn't valid JSON." }, 400);
  }
  const b = (body ?? {}) as { options?: Partial<Record<keyof RestoreOptions, unknown>>; backup?: unknown };
  const o = b.options ?? {};
  const options: RestoreOptions = {
    dryRun: o.dryRun !== false,
    replaceCatalog: o.replaceCatalog === true,
    settings: o.settings !== false,
    offers: o.offers !== false,
    leads: o.leads !== false,
  };

  const parsed = parseBackup(b.backup);
  if (!parsed.ok) return json({ error: "The backup didn't pass validation.", problems: parsed.errors }, 422);
  const backup = parsed.backup;

  const [current, currentOffers, currentLeads, currentStats] = await Promise.all([listProducts(), listOffers(), listLeads(), getAllOfferStats()]);
  const currentIds = new Set(current.map((p) => p.id));
  const incomingIds = new Set(backup.products.map((p) => p.id));
  const toRemove = options.replaceCatalog ? current.filter((p) => !incomingIds.has(p.id)).map((p) => p.id) : [];
  const offerCodes = new Set(currentOffers.map((x) => x.code));
  const leadIds = new Set(currentLeads.map((l) => l.id));

  const plan = {
    products: {
      add: backup.products.filter((p) => !currentIds.has(p.id)).length,
      update: backup.products.filter((p) => currentIds.has(p.id)).length,
      remove: toRemove.length,
    },
    offers: options.offers ? { add: backup.offers.filter((x) => !offerCodes.has(x.code)).length, update: backup.offers.filter((x) => offerCodes.has(x.code)).length } : null,
    leads: options.leads ? { add: backup.leads.filter((l) => !leadIds.has(l.id)).length, update: backup.leads.filter((l) => leadIds.has(l.id)).length } : null,
    settings: options.settings && !!backup.settings,
    ordersSkipped: backup.orderCount,
    exportedAt: backup.exportedAt,
    exportedBy: backup.exportedBy,
  };

  if (options.dryRun) return json({ ok: true, dryRun: true, plan });

  // Write. Products first (with their stock), then the rest.
  if (backup.products.length) await saveProducts(backup.products);
  if (toRemove.length) await deleteProducts(toRemove);

  if (options.offers) {
    for (const offer of backup.offers) {
      await saveOffer(offer);
      const want = backup.offerStats[offer.code];
      if (!want) continue;
      const have = currentStats[offer.code] ?? { views: 0, orders: 0, revenue: 0, paid: 0 };
      for (const field of ["views", "orders", "revenue", "paid"] as const) {
        const d = want[field] - have[field];
        if (d) await bumpOfferStat(offer.code, field, d);
      }
    }
  }

  if (options.leads) {
    for (const lead of backup.leads) await saveLead(lead);
  }

  if (options.settings && backup.settings) {
    // Drop hero picks that don't exist after the restore.
    const exists = new Set([...current.filter((p) => !toRemove.includes(p.id)).map((p) => p.id), ...incomingIds]);
    await saveSettings({ ...backup.settings, heroProductIds: backup.settings.heroProductIds.filter((id) => exists.has(id)) });
  }

  await audit(
    auth.session,
    "backup.restore",
    undefined,
    [
      `products: ${plan.products.add} new, ${plan.products.update} updated, ${plan.products.remove} removed`,
      plan.offers && `offers: ${plan.offers.add} new, ${plan.offers.update} updated`,
      plan.leads && `requests: ${plan.leads.add} new, ${plan.leads.update} updated`,
      plan.settings && "settings replaced",
      backup.exportedAt && `from backup of ${backup.exportedAt.slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("; "),
  );
  refreshFromRoute(TAGS.catalog, TAGS.settings, TAGS.offers);
  return json({ ok: true, dryRun: false, plan });
}
