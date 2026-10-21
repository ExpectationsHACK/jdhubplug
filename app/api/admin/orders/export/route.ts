import { connection, type NextRequest } from "next/server";
import { ordersToCsv } from "@/components/admin/orders/csv";
import { inRange, inTab, matchesQuery, readOrderFilters } from "@/components/admin/orders/format";
import { audit, can, getSession } from "@/lib/auth";
import { listOrders } from "@/lib/store";

// GET /api/admin/orders/export → orders as CSV. Accepts the same filters as the
// orders list (status, q, range, pay), so "Export" downloads what the admin is looking at.

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s) return new Response("Sign in to export orders.", { status: 401 });
  if (!can(s.role, "orders:write")) return new Response("Your role can't export orders.", { status: 403 });

  await connection();
  const now = Date.now();
  const f = readOrderFilters(Object.fromEntries(request.nextUrl.searchParams));
  const orders = (await listOrders()).filter(
    (o) => inTab(o, f.tab) && matchesQuery(o, f.q) && inRange(o, f.range, now) && (f.pay === "all" || o.payment.method === f.pay),
  );

  const filters = [f.tab !== "all" && `status=${f.tab}`, f.q && `q=${f.q}`, f.range !== "all" && `range=${f.range}`, f.pay !== "all" && `pay=${f.pay}`].filter(Boolean).join(", ");
  await audit(s, "order.export", "csv", `${orders.length} orders${filters ? ` (${filters})` : ""}`);

  const date = new Date(now).toISOString().slice(0, 10);
  return new Response(ordersToCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jdhub-orders-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
