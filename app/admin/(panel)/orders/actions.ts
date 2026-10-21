"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { audit, requireAdmin, ROLE_LABEL } from "@/lib/auth";
import { TAGS } from "@/lib/data";
import { addOrderNote, ORDER_FLOW, STATUS_LABEL, transitionOrder } from "@/lib/orders";
import { refreshFromAction } from "@/lib/revalidate";
import { queueStockAlerts } from "@/lib/stock-alerts";
import type { Session } from "@/lib/session";
import { getOrder } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

// Order Server Actions. Every action re-checks the session and permission, validates
// its input and only moves stock through lib/orders.ts.

export type OrderActionState = { ok?: boolean; error?: string; message?: string; at?: number };

const ID_RE = /^JDH-\d{1,12}$/i;
const STATUSES = Object.keys(ORDER_FLOW) as OrderStatus[];

/** Collapse whitespace/control characters and cap length for free-text inputs. */
function cleanText(v: FormDataEntryValue | null, max: number) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

const actor = (s: Session) => `${s.name} (${ROLE_LABEL[s.role]})`;

function friendly(e: unknown, fallback: string): OrderActionState {
  unstable_rethrow(e);
  const msg = e instanceof Error ? e.message : "";
  if (/^Busy/i.test(msg)) return { error: "Someone else is updating this order. Try again in a moment." };
  if (/permission|Can't move an order|not found/i.test(msg)) return { error: msg };
  console.error("[admin/orders]", e);
  return { error: fallback };
}

const SUCCESS: Partial<Record<OrderStatus, string>> = {
  paid: "Marked as paid. Funds are held in escrow.",
  processing: "Order is now processing.",
  shipped: "Marked as shipped.",
  delivered: "Marked as delivered.",
  completed: "Order completed. Escrow released.",
  cancelled: "Order cancelled. Stock is back on sale.",
  refunded: "Order refunded. Stock is back on sale.",
};

/** Move an order along ORDER_FLOW. Fields: id, next, reference?, note?. */
export async function transitionOrderAction(_prev: OrderActionState, form: FormData): Promise<OrderActionState> {
  try {
    const s = await requireAdmin("orders:write");
    const id = cleanText(form.get("id"), 20).toUpperCase();
    const next = cleanText(form.get("next"), 20) as OrderStatus;
    if (!ID_RE.test(id)) return { error: "Unknown order." };
    if (!STATUSES.includes(next)) return { error: "Unknown status." };

    const order = await getOrder(id);
    if (!order) return { error: `Order ${id} not found.` };
    if (!ORDER_FLOW[order.status].includes(next)) {
      refresh();
      return { error: `This order is now "${STATUS_LABEL[order.status]}" and can't move to "${STATUS_LABEL[next]}". The page has been refreshed.` };
    }

    const reference = cleanText(form.get("reference"), 120) || undefined;
    const extra = cleanText(form.get("note"), 500);
    const parts: string[] = [];
    if (next === "paid" && reference) parts.push(`Ref: ${reference}`);
    if (next === "shipped" && extra) parts.push(`Tracking: ${extra}`);
    else if (extra) parts.push(extra);
    if (next === "refunded" || next === "cancelled") parts.push("Stock restored");

    // transitionOrder writes the history entry and the activity-log entry (as `by`).
    await transitionOrder(id, next, actor(s), { note: parts.join(" · ") || undefined, paymentReference: reference });
    refreshFromAction(TAGS.catalog, TAGS.offers);
    if (next === "cancelled" || next === "refunded") queueStockAlerts();
    return { ok: true, message: SUCCESS[next] ?? "Order updated.", at: Date.now() };
  } catch (e) {
    return friendly(e, "Couldn't update the order. Try again.");
  }
}

/** Add an internal note to the order timeline. Fields: id, note. */
export async function addOrderNoteAction(_prev: OrderActionState, form: FormData): Promise<OrderActionState> {
  try {
    const s = await requireAdmin("orders:write");
    const id = cleanText(form.get("id"), 20).toUpperCase();
    const note = cleanText(form.get("note"), 1000);
    if (!ID_RE.test(id)) return { error: "Unknown order." };
    if (!note) return { error: "Write a note first." };
    await addOrderNote(id, actor(s), note);
    await audit(s, "order.note", id, note.length > 120 ? `${note.slice(0, 117)}…` : note);
    refresh();
    return { ok: true, message: "Note added.", at: Date.now() };
  } catch (e) {
    return friendly(e, "Couldn't save the note. Try again.");
  }
}

/**
 * The orders list sweeps expired reservations while rendering, which restocks
 * products. Rendering can't refresh cache tags, so the page calls this once after a
 * sweep released stock to make the storefront show it again.
 */
export async function refreshAfterSweepAction(): Promise<void> {
  await requireAdmin();
  refreshFromAction(TAGS.catalog, TAGS.offers);
}
