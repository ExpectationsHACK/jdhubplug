"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { sessionWith } from "@/components/admin/core/guard";
import { audit } from "@/lib/auth";
import { deleteStockAlert, listStockAlerts, processStockAlerts } from "@/lib/stock-alerts";

// Back-in-stock alert Server Actions. Viewing /admin/alerts needs any admin; these need
// products:write.

export type AlertActionState = { ok?: boolean; error?: string; message?: string; at?: number };

const ID_RE = /^SA-[A-Z0-9]{4,40}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

function friendly(e: unknown): AlertActionState {
  unstable_rethrow(e);
  console.error("[admin/alerts]", e);
  return { error: "Something went wrong. Try again." };
}

/** Message everyone waiting on a model now, if a unit is in stock. Fields: model. */
export async function sendModelAlertsAction(_prev: AlertActionState, form: FormData): Promise<AlertActionState> {
  try {
    const s = await sessionWith("products:write");
    if (!s) return { error: "Your role can't send stock alerts." };
    const model = String(form.get("model") ?? "");
    if (!MODEL_RE.test(model)) return { error: "Unknown model." };
    const waiting = (await listStockAlerts()).filter((a) => a.model === model && a.status === "waiting").length;
    if (!waiting) return { error: "Nobody is waiting on this model." };

    const r = await processStockAlerts({ model });
    if (r.busy) return { error: "Alerts are being sent right now. Try again in a moment." };
    if (!r.matched) return { error: "No unit of this model is in stock yet. Add stock first, then send." };
    await audit(s, "stockalert.send", model, `${r.sent} sent, ${r.skipped} skipped (no provider), ${r.failed} failed, ${r.retrying} will retry`);
    refresh();
    const parts = [r.sent && `${r.sent} sent`, r.skipped && `${r.skipped} not delivered (email/SMS isn't set up)`, r.failed && `${r.failed} failed`, r.retrying && `${r.retrying} will retry`].filter(Boolean);
    return { ok: true, message: parts.join(", ") + ".", at: Date.now() };
  } catch (e) {
    return friendly(e);
  }
}

/** Fields: id. */
export async function deleteAlertAction(_prev: AlertActionState, form: FormData): Promise<AlertActionState> {
  try {
    const s = await sessionWith("products:write");
    if (!s) return { error: "Your role can't delete stock alerts." };
    const id = String(form.get("id") ?? "");
    if (!ID_RE.test(id)) return { error: "Unknown alert." };
    const a = await deleteStockAlert(id);
    if (!a) return { error: "This alert no longer exists." };
    await audit(s, "stockalert.delete", id, `${a.model} · ${a.status}`);
    refresh();
    return { ok: true, message: "Alert deleted.", at: Date.now() };
  } catch (e) {
    return friendly(e);
  }
}
