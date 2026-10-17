import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "@/lib/session";
import { getSettings, listLeads, listOrders, listProducts, listStaff } from "@/lib/store";

// Data the admin shell needs on every full page load.

/** Sidebar counts keyed by nav href. Never throws: a failed count just hides its badge. */
export async function getNavBadges(): Promise<Record<string, number>> {
  try {
    const [orders, leads, products, settings] = await Promise.all([listOrders(), listLeads(), listProducts(), getSettings()]);
    const threshold = settings.lowStockThreshold;
    return {
      // Orders someone has to act on: confirm a payment, or pack and ship.
      "/admin/orders": orders.filter((o) => o.status === "pending" || o.status === "paid" || o.status === "processing").length,
      "/admin/requests": leads.filter((l) => l.status === "new").length,
      "/admin/inventory": products.filter((p) => p.status === "active" && p.stock > 0 && p.stock <= threshold).length,
    };
  } catch (e) {
    console.warn("[admin] could not compute nav badges", e);
    return {};
  }
}

/**
 * Sessions are signed cookies, so deactivating, deleting or re-roling a staff member
 * doesn't end a session by itself. The shell re-checks the account on every full load
 * and signs the browser out if it no longer matches.
 */
export async function assertStaffStillValid(session: Session) {
  if (session.sub === "owner") return;
  const user = (await listStaff()).find((u) => u.id === session.sub);
  if (!user || !user.active || user.role !== session.role) redirect("/admin/login/signout?reason=revoked");
}
