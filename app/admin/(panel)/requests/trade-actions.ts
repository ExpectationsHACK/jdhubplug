"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { sessionWith } from "@/components/admin/core/guard";
import { siteOrigin } from "@/components/admin/orders/server";
import { audit } from "@/lib/auth";
import { refreshFromAction } from "@/lib/revalidate";
import type { Session } from "@/lib/session";
import {
  addLeadNote,
  bookInspection,
  closeLead,
  ensureLeadToken,
  markContacted,
  notifyLead,
  recordInspection,
  recordPayout,
  respondToOffer,
  sendOffer,
  TradeInError,
  type NotifyKind,
  type PayoutChoiceInput,
} from "@/lib/tradein";
import { parseBank, parseLagosLocal, STAGE_LABEL } from "@/lib/tradein-flow";
import { grades } from "@/lib/reference";
import type { ConditionCheck, Grade, Lead, PayoutMethod } from "@/lib/types";

// Trade-in pipeline Server Actions for /admin/requests/[id]. Permission "leads:write".
// Every action re-checks the session, validates input, moves the lead through
// lib/tradein.ts (locked, transition-checked) and writes the activity log.

export type TradeActionState = { ok?: boolean; error?: string; message?: string; n?: number };

const fail = (error: string): TradeActionState => ({ error, n: Date.now() });
const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);
/** "₦350,000" / "350000" → 350000, or NaN. */
const amount = (f: FormData, k: string) => {
  const raw = str(f, k, 30).replace(/[₦,\s]/g, "");
  return raw ? Number(raw) : NaN;
};

async function run(
  form: FormData,
  label: string,
  fn: (s: Session, id: string) => Promise<{ lead: Lead; detail: string; notify?: NotifyKind; message: string; offers?: boolean }>,
): Promise<TradeActionState> {
  try {
    const s = await sessionWith("leads:write");
    if (!s) return fail("Your role can't change requests.");
    const id = str(form, "id", 80);
    const { lead, detail, notify, message, offers } = await fn(s, id);
    await audit(s, `lead.${label}`, lead.id, detail);
    let sent = "";
    if (notify) {
      const log = await notifyLead(lead.id, notify, await siteOrigin());
      sent = log.length ? ` ${log.join(" · ")}.` : "";
    }
    if (offers) refreshFromAction("offers");
    refresh();
    return { ok: true, message: `${message}${sent}`, n: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof TradeInError) return fail(e.message);
    console.error("[admin/requests] trade action failed", e);
    return fail("Something went wrong. Try again.");
  }
}

/** Fields: id, note (optional). */
export async function markContactedAction(_p: TradeActionState, form: FormData) {
  return run(form, "contacted", async (s, id) => {
    const lead = await markContacted(id, s.name, str(form, "note", 500) || undefined);
    return { lead, detail: `→ ${STAGE_LABEL.contacted}`, message: "Marked contacted." };
  });
}

/** Fields: id, at (YYYY-MM-DDTHH:mm, Lagos time), method (pickup | dropoff), address, hub, staff, notify. */
export async function bookInspectionAction(_p: TradeActionState, form: FormData) {
  return run(form, "inspection.book", async (s, id) => {
    const at = parseLagosLocal(str(form, "at", 20));
    if (!at) throw new TradeInError("Choose a date and time.");
    const method = str(form, "method", 10) === "dropoff" ? "dropoff" : "pickup";
    const lead = await bookInspection(id, s.name, { at, method, address: str(form, "address"), hub: str(form, "hub", 80), staff: str(form, "staff", 80) });
    const b = lead.trade!.booking!;
    return {
      lead,
      detail: `${b.at} ${b.method}${b.hub ? ` ${b.hub}` : ""}${b.staff ? ` · ${b.staff}` : ""}`,
      notify: form.get("notify") ? "inspection_booked" : undefined,
      message: "Inspection booked.",
    };
  });
}

const CHECKS: ConditionCheck[] = ["ok", "minor", "damaged"];
const pickCheck = (v: string): ConditionCheck => (CHECKS.includes(v as ConditionCheck) ? (v as ConditionCheck) : "ok");

/** Fields: id, grade, imeiClean, accountSignedOut, screen, battery, body, functions, finalOffer, notes. */
export async function recordInspectionAction(_p: TradeActionState, form: FormData) {
  return run(form, "inspection.record", async (s, id) => {
    const grade = str(form, "grade", 20) as Grade;
    if (!grades.some((g) => g.id === grade)) throw new TradeInError("Choose the actual grade.");
    const finalOffer = amount(form, "finalOffer");
    if (!Number.isFinite(finalOffer) || finalOffer < 0) throw new TradeInError("Enter the final offer amount.");
    const batteryRaw = str(form, "battery", 5);
    const battery = batteryRaw ? Number(batteryRaw) : undefined;
    if (battery !== undefined && (!Number.isInteger(battery) || battery < 0 || battery > 100)) throw new TradeInError("Battery health is a percentage from 0 to 100.");
    const lead = await recordInspection(id, s.name, {
      grade,
      finalOffer,
      notes: str(form, "notes", 1000),
      checklist: {
        imeiClean: form.get("imeiClean") === "on",
        accountSignedOut: form.get("accountSignedOut") === "on",
        screen: pickCheck(str(form, "screen", 10)),
        body: pickCheck(str(form, "body", 10)),
        functions: str(form, "functions", 10) === "issues" ? "issues" : "ok",
        ...(battery !== undefined ? { batteryHealth: battery } : {}),
      },
    });
    return { lead, detail: `${grade}, final ${finalOffer}`, message: "Inspection recorded." };
  });
}

/** Fields: id, finalOffer (optional revision). Always messages the customer. */
export async function sendOfferAction(_p: TradeActionState, form: FormData) {
  return run(form, "offer.send", async (s, id) => {
    const a = amount(form, "finalOffer");
    const lead = await sendOffer(id, s.name, Number.isFinite(a) ? a : undefined);
    return { lead, detail: `offer ${lead.trade!.inspection!.finalOffer}`, notify: "offer_sent", message: "Offer sent." };
  });
}

/** Fields: id, decision (accepted | declined), payout (bank | cash | swap_credit), bankName, accountNumber, accountName, reason. */
export async function recordResponseAction(_p: TradeActionState, form: FormData) {
  return run(form, "offer.response", async (s, id) => {
    const decision = str(form, "decision", 10) === "declined" ? "declined" : "accepted";
    const method = str(form, "payout", 20) as PayoutMethod;
    let payout: PayoutChoiceInput | undefined;
    if (decision === "accepted") {
      if (!["bank", "cash", "swap_credit"].includes(method)) throw new TradeInError("Choose the payout method.");
      if (method === "bank" && str(form, "accountNumber", 20)) {
        const bank = parseBank({ bankName: form.get("bankName"), accountNumber: form.get("accountNumber"), accountName: form.get("accountName") });
        if (!bank.ok) throw new TradeInError(bank.error);
        payout = { method, bank: bank.bank };
      } else {
        payout = { method };
      }
    }
    const lead = await respondToOffer(id, `${s.name} (for customer)`, decision, { payout, reason: str(form, "reason", 500) });
    const credit = decision === "accepted" && lead.trade?.credit && method === "swap_credit";
    return {
      lead,
      detail: decision === "accepted" ? `accepted · ${method}${credit ? ` · credit ${lead.trade!.credit!.code}` : ""}` : "declined",
      notify: credit ? "credit" : undefined,
      offers: !!credit,
      message: decision === "accepted" ? (credit ? "Accepted. Swap credit issued." : "Marked accepted.") : "Marked declined.",
    };
  });
}

/** Fields: id, method (bank | cash | swap_credit), amount, reference, bankName, accountNumber, accountName, notify. */
export async function recordPayoutAction(_p: TradeActionState, form: FormData) {
  return run(form, "payout", async (s, id) => {
    const method = str(form, "method", 20) as PayoutMethod;
    if (!["bank", "cash", "swap_credit"].includes(method)) throw new TradeInError("Choose the payout method.");
    let bank;
    if (method === "bank" && str(form, "accountNumber", 20)) {
      const parsed = parseBank({ bankName: form.get("bankName"), accountNumber: form.get("accountNumber"), accountName: form.get("accountName") });
      if (!parsed.ok) throw new TradeInError(parsed.error);
      bank = parsed.bank;
    }
    const a = amount(form, "amount");
    const lead = await recordPayout(id, s.name, { method, amount: Number.isFinite(a) ? a : undefined, reference: str(form, "reference", 120), bank });
    const p = lead.trade!.payout!;
    return {
      lead,
      detail: `${p.method} ${p.amount}${p.reference ? ` ref ${p.reference}` : ""}`,
      notify: form.get("notify") ? "paid" : undefined,
      offers: method === "swap_credit",
      message: "Payout recorded.",
    };
  });
}

/** Fields: id, to (closed | cancelled), reason. */
export async function closeLeadAction(_p: TradeActionState, form: FormData) {
  return run(form, "close", async (s, id) => {
    const to = str(form, "to", 10) === "cancelled" ? "cancelled" : "closed";
    const reason = str(form, "reason", 500);
    const lead = await closeLead(id, s.name, to, reason);
    return { lead, detail: `${to}: ${reason}`, message: to === "closed" ? "Closed." : "Cancelled." };
  });
}

/** Fields: id, note. */
export async function addLeadNoteAction(_p: TradeActionState, form: FormData) {
  return run(form, "note", async (s, id) => {
    const lead = await addLeadNote(id, s.name, str(form, "note", 1000));
    return { lead, detail: "note added", message: "Note added." };
  });
}

/** Fields: id, kind (inspection_booked | offer_sent | paid | credit). Resends a customer message. */
export async function resendMessageAction(_p: TradeActionState, form: FormData) {
  return run(form, "message.resend", async (_s, id) => {
    const kind = str(form, "kind", 20) as NotifyKind;
    const lead = await ensureLeadToken(id);
    if (!lead) throw new TradeInError("This request no longer exists.");
    const t = lead.trade ?? {};
    const ready = { inspection_booked: !!t.booking, offer_sent: !!t.inspection && !!t.offerSentAt, paid: !!t.payout, credit: !!t.credit }[kind];
    if (!ready) throw new TradeInError("There's nothing to send for that step yet.");
    return { lead, detail: `resend ${kind}`, notify: kind, message: "Message sent again." };
  });
}
