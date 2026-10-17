import { NextResponse } from "next/server";
import { PRODUCTS_LOCK } from "@/app/admin/(panel)/products/_lib/run";
import { MAX_IMPORT_ROWS, planImport, summarizePlan, type ImportSummary } from "@/components/admin/products/csv-schema";
import { audit, can, getSession } from "@/lib/auth";
import { CsvError, parseCsv } from "@/lib/csv";
import { TAGS } from "@/lib/data";
import { refreshFromRoute } from "@/lib/revalidate";
import { listProducts, newProductId, saveProducts, withLock } from "@/lib/store";
import { jsonError, sameOrigin } from "../_lib/http";

// POST /api/admin/products/import  { csv: string, apply?: boolean, skipInvalid?: boolean }
//
// Without `apply` it returns a preview: rows that would be created or updated, and
// errors with spreadsheet row numbers. With `apply` it re-validates against the live
// catalog and upserts by id (a blank id creates a new product). Nothing from the
// preview is trusted. A Route Handler rather than a Server Action because a 2,000-row
// CSV can exceed the 1 MB Server Action body limit.

const MAX_BODY = 8 * 1024 * 1024;

const json = (body: ImportSummary, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return jsonError(401, "Sign in again to import products.");
  if (!can(s.role, "products:write")) return jsonError(403, "Your role can't import products.");
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests aren't allowed.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return jsonError(413, "That file is too large. Split it into files of up to 2,000 rows.");

  let body: { csv?: unknown; apply?: unknown; skipInvalid?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError(400, "Send JSON with a csv field.");
  }
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return jsonError(400, "Paste CSV text or choose a .csv file first.");
  if (csv.length > MAX_BODY) return jsonError(413, "That file is too large. Split it into files of up to 2,000 rows.");

  let records: string[][];
  try {
    records = parseCsv(csv, { maxRecords: MAX_IMPORT_ROWS + 1 });
  } catch (e) {
    if (e instanceof CsvError) {
      const tooMany = /Too many rows/.test(e.message);
      return json({
        total: 0,
        unchanged: 0,
        creates: [],
        updates: [],
        warnings: [],
        errors: [{ row: tooMany ? 1 : e.record, message: tooMany ? `The file has more than ${MAX_IMPORT_ROWS} rows. Import at most ${MAX_IMPORT_ROWS} at a time.` : e.message }],
      });
    }
    throw e;
  }

  if (body.apply !== true) {
    const existing = new Map((await listProducts()).map((p) => [p.id, p]));
    return json(summarizePlan(planImport(records, existing, newProductId)));
  }

  try {
    return await withLock(PRODUCTS_LOCK, async () => {
      // Plan again against the live catalog: stock and prices may have moved since the preview.
      const existing = new Map((await listProducts()).map((p) => [p.id, p]));
      const plan = planImport(records, existing, newProductId);
      const summary = summarizePlan(plan);
      if (plan.errors.length && body.skipInvalid !== true) {
        return json({ ...summary, error: "Some rows have errors. Fix them, or choose to skip those rows." }, 422);
      }

      const fieldsOnly = plan.updates.filter((u) => !u.stockChanged).map((u) => u.after);
      const withStock = plan.updates.filter((u) => u.stockChanged).map((u) => u.after);
      // New products and stock edits write absolute stock; field-only edits leave the live counter alone.
      if (plan.creates.length) await saveProducts(plan.creates.map((c) => c.product));
      if (withStock.length) await saveProducts(withStock);
      if (fieldsOnly.length) await saveProducts(fieldsOnly, { keepStock: true });

      const applied = { created: plan.creates.length, updated: plan.updates.length, skipped: plan.errors.length };
      if (applied.created || applied.updated) {
        const ids = [...plan.creates.map((c) => c.product.id), ...plan.updates.map((u) => u.after.id)];
        const parts = [...plan.creates.map((c) => `${c.product.id} created`), ...plan.updates.map((u) => `${u.after.id} ${u.changes.join(", ")}`)];
        let detail = `${applied.created} created, ${applied.updated} updated${applied.skipped ? `, ${applied.skipped} rows skipped` : ""}: `;
        for (let i = 0; i < parts.length; i++) {
          if (detail.length + parts[i].length > 2000) {
            detail += `… and ${parts.length - i} more`;
            break;
          }
          detail += (i ? "; " : "") + parts[i];
        }
        await audit(s, "product.import", ids.length <= 300 ? ids.join(",") : `csv (${ids.length} products)`, detail);
        refreshFromRoute(TAGS.catalog);
      }
      return json({ ...summary, applied });
    });
  } catch (e) {
    const busy = e instanceof Error && /^Busy/.test(e.message);
    if (!busy) console.error("[import] failed", e);
    return jsonError(busy ? 409 : 500, busy ? "Someone else is saving products right now. Try again." : "The import stopped part-way. Check the products list before trying again.");
  }
}
