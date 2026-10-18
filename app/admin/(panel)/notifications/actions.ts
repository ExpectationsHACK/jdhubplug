"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { sessionWith } from "@/components/admin/core/guard";
import { audit, ROLE_LABEL } from "@/lib/auth";
import { EVENT_LABEL, NOTIFY_EVENTS, type NotifySettings } from "@/lib/notify/events";
import { resendOrderMessage, sendTestEmail } from "@/lib/notify/orders";
import { getNotifySettings, saveNotifySettings } from "@/lib/notify/store";
import { getOrder, rateLimit } from "@/lib/store";

// Notification Server Actions. Toggles and test emails need settings:write; resending an
// order's message needs orders:write. Every action re-checks the session.

export type NotifyActionState = { ok?: boolean; message?: string; at?: number };

const ID_RE = /^JDH-\d{1,12}$/i;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const on = (form: FormData, key: string) => form.get(key) === "on";

export async function saveNotifySettingsAction(_prev: NotifyActionState, form: FormData): Promise<NotifyActionState> {
  const session = await sessionWith("settings:write");
  if (!session) return { ok: false, message: "Only the owner or a manager can change notifications." };

  const before = await getNotifySettings();
  const next: NotifySettings = {
    events: Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, { email: on(form, `${e}_email`), sms: on(form, `${e}_sms`) }])) as NotifySettings["events"],
    storeAlert: { email: on(form, "store_email"), sms: on(form, "store_sms") },
  };

  const changes: string[] = [];
  const flag = (b: boolean) => (b ? "on" : "off");
  for (const e of NOTIFY_EVENTS) {
    for (const c of ["email", "sms"] as const) {
      if (before.events[e][c] !== next.events[e][c]) changes.push(`${EVENT_LABEL[e]} ${c} ${flag(next.events[e][c])}`);
    }
  }
  for (const c of ["email", "sms"] as const) {
    if (before.storeAlert[c] !== next.storeAlert[c]) changes.push(`Store alert ${c} ${flag(next.storeAlert[c])}`);
  }
  if (!changes.length) return { ok: true, message: "No changes to save.", at: Date.now() };

  await saveNotifySettings(next);
  await audit(session, "notify.settings", undefined, changes.join("; ").slice(0, 600));
  refresh();
  return { ok: true, message: `Saved ${changes.length} change${changes.length === 1 ? "" : "s"}.`, at: Date.now() };
}

export async function sendTestEmailAction(_prev: NotifyActionState, form: FormData): Promise<NotifyActionState> {
  const session = await sessionWith("settings:write");
  if (!session) return { ok: false, message: "Only the owner or a manager can send test emails." };
  const to = String(form.get("to") ?? "").trim().toLowerCase().slice(0, 120);
  if (!EMAIL_RE.test(to)) return { ok: false, message: "Enter a valid email address." };
  if (!(await rateLimit(`notify-test:${session.sub}`, 5, 600))) return { ok: false, message: "That's a lot of test emails. Try again in a few minutes." };

  const entry = await sendTestEmail(to, `${session.name} (${ROLE_LABEL[session.role]})`);
  await audit(session, "notify.test", entry.to, entry.status);
  refresh();
  if (entry.status === "ok") return { ok: true, message: `Test email sent to ${to}.`, at: Date.now() };
  if (entry.status === "skipped") return { ok: false, message: `Not sent: ${entry.detail ?? "email isn't set up."}`, at: Date.now() };
  return { ok: false, message: `Sending failed: ${entry.detail ?? "unknown error"}`, at: Date.now() };
}

/** Resend an order's confirmation or its latest status update. Fields: id, kind. */
export async function resendOrderMessageAction(_prev: NotifyActionState, form: FormData): Promise<NotifyActionState> {
  try {
    const session = await sessionWith("orders:write");
    if (!session) return { ok: false, message: "You don't have permission to message customers." };
    const id = String(form.get("id") ?? "").trim().toUpperCase().slice(0, 20);
    const kind = form.get("kind") === "confirmation" ? "confirmation" : "latest";
    if (!ID_RE.test(id)) return { ok: false, message: "Unknown order." };
    if (!(await rateLimit(`notify-resend:${id}`, 10, 3600))) return { ok: false, message: "This order has been messaged a lot in the last hour. Try again later." };
    const order = await getOrder(id);
    if (!order) return { ok: false, message: `Order ${id} not found.` };

    const { event, entries } = await resendOrderMessage(order, kind, `${session.name} (${ROLE_LABEL[session.role]})`);
    const sent = entries.filter((e) => e.status === "ok").map((e) => (e.channel === "email" ? "email" : "SMS"));
    await audit(session, "notify.resend", id, `${EVENT_LABEL[event]}: ${entries.map((e) => `${e.channel} ${e.status}`).join(", ") || "nothing to send"}`);
    refresh();
    if (!entries.length) return { ok: false, message: "This customer has no email address, and SMS is off for this message.", at: Date.now() };
    if (sent.length) return { ok: true, message: `${EVENT_LABEL[event]} sent by ${sent.join(" and ")}.`, at: Date.now() };
    const why = entries.map((e) => e.detail).filter(Boolean)[0];
    return { ok: false, message: `Nothing was sent${why ? `: ${why}` : "."}`, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[admin/notifications] resend failed", e);
    return { ok: false, message: "Couldn't resend the message. Try again." };
  }
}
