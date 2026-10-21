import { CSV_COLUMNS, productToCsvRow } from "@/components/admin/products/csv-schema";
import { audit, can, getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listProducts } from "@/lib/store";

// GET /api/admin/products/export → the whole catalog as CSV (UTF-8 with BOM so
// spreadsheet apps show ₦ and accents correctly). Re-import it to apply edits.

export async function GET() {
  const s = await getSession();
  if (!s) return new Response("Sign in to export products.", { status: 401 });
  if (!can(s.role, "products:write")) return new Response("Your role can't export products.", { status: 403 });

  const products = await listProducts();
  const csv = toCsv([[...CSV_COLUMNS], ...products.map(productToCsvRow)], { bom: true });
  const date = new Date().toISOString().slice(0, 10);
  await audit(s, "product.export", "csv", `${products.length} products`);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jdhub-products-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
