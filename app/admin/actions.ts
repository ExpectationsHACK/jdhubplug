"use server";

import { redirect } from "next/navigation";
import { audit, getSession, login, logout, requireAdmin } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { sweepExpiredOrders } from "@/lib/orders";
import { refreshFromAction } from "@/lib/revalidate";

export type LoginState = { error?: string };

/** Only same-site admin paths, and never back into the login flow (e.g. /admin/login/signout). */
function safeNext(raw: FormDataEntryValue | null) {
  const next = typeof raw === "string" ? raw : "";
  if (!next.startsWith("/admin") || next.startsWith("//") || next.startsWith("/admin/login")) return "/admin";
  return next;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 500);
  if (!password) return { error: "Enter your password." };
  const res = await login(email, password);
  if (!res.ok) return { error: res.error };
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await audit(s, "auth.logout");
  await logout();
  redirect("/admin/login?reason=signedout");
}

export type SweepState = { released?: number; error?: string };

/**
 * Release stock held by unpaid orders whose reservation window has passed, then refresh
 * the storefront so the freed units show as available straight away.
 */
export async function sweepNowAction(): Promise<SweepState> {
  const s = await requireAdmin("orders:write");
  try {
    const released = await sweepExpiredOrders();
    if (released > 0) await audit(s, "orders.sweep", undefined, `${released} expired order${released === 1 ? "" : "s"} released`);
    refreshFromAction(TAGS.catalog, TAGS.offers);
    return { released };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not release expired orders." };
  }
}

/** Refresh storefront caches after the dashboard's automatic sweep released stock. */
export async function refreshStorefrontAction() {
  await requireAdmin();
  refreshFromAction(TAGS.catalog, TAGS.offers);
}
