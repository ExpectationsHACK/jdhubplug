"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { siteOrigin } from "@/components/admin/orders/server";
import { clientIp } from "@/lib/request-ip";
import { rateLimit } from "@/lib/store";
import { getLeadForCustomer, notifyLead, respondToOffer, TradeInError, type PayoutChoiceInput } from "@/lib/tradein";
import { parseBank } from "@/lib/tradein-flow";

// Customer answers to a trade-in offer, from /trade-in/{id}?t={token}. Every call
// re-checks the token and is rate-limited per IP and per lead.

export type RespondState = { ok?: boolean; error?: string; message?: string; n?: number };

/** Fields: id, t, decision (accepted | declined), payout (bank | swap_credit), bankName, accountNumber, accountName, reason. */
export async function respondToOfferAction(_prev: RespondState, form: FormData): Promise<RespondState> {
  const fail = (error: string): RespondState => ({ error, n: Date.now() });
  try {
    const id = String(form.get("id") ?? "");
    const token = String(form.get("t") ?? "");
    const decision = String(form.get("decision") ?? "");
    if (decision !== "accepted" && decision !== "declined") return fail("Choose accept or decline.");

    const ip = await clientIp();
    const [ipOk, leadOk] = await Promise.all([rateLimit(`tradein:ip:${ip}`, 20, 3600), rateLimit(`tradein:lead:${id.slice(0, 80)}`, 8, 3600)]);
    if (!ipOk || !leadOk) return fail("Too many attempts. Please wait a while, or message us on WhatsApp.");

    const lead = await getLeadForCustomer(id, token);
    if (!lead) return fail("This link isn't valid any more. Message us on WhatsApp and we'll send a new one.");
    if (lead.status !== "offer_sent") return fail("This offer has already been answered.");

    let payout: PayoutChoiceInput | undefined;
    if (decision === "accepted") {
      const method = String(form.get("payout") ?? (lead.type === "swap" ? "swap_credit" : "bank"));
      if (method === "swap_credit" && lead.type === "swap") {
        payout = { method: "swap_credit" };
      } else if (method === "bank") {
        const bank = parseBank({ bankName: form.get("bankName"), accountNumber: form.get("accountNumber"), accountName: form.get("accountName") });
        if (!bank.ok) return fail(bank.error);
        payout = { method: "bank", bank: bank.bank };
      } else {
        return fail("Choose how you'd like to be paid.");
      }
    }

    const reason = String(form.get("reason") ?? "").slice(0, 500);
    const updated = await respondToOffer(lead.id, "customer", decision, { payout, reason });
    if (updated.trade?.credit && payout?.method === "swap_credit") {
      await notifyLead(updated.id, "credit", await siteOrigin());
    }
    refresh();
    return {
      ok: true,
      message:
        decision === "declined"
          ? "Thanks for letting us know. We'll be in touch."
          : payout?.method === "swap_credit"
            ? "Accepted. Your swap credit is ready below."
            : "Accepted. We'll send your payment within 48 hours.",
    };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof TradeInError) return fail(e.message);
    console.error("[trade-in] respond failed", e);
    return fail("Something went wrong. Please try again.");
  }
}
