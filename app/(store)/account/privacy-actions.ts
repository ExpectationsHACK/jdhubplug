"use server";

import { redirect } from "next/navigation";
import { getCurrentCustomer, signOutCustomer } from "@/lib/customer-auth";
import type { DsrType } from "@/lib/legal";
import { createDataRequest } from "@/lib/legal-store";
import { logAudit, rateLimit } from "@/lib/store";

// Data-subject requests from /account (NDPA). Requests are recorded in jd:dsr and
// handled by staff in /admin/privacy.

export type PrivacyRequestState = { ok?: boolean; id?: string; error?: string };

const OTHER_TYPES: DsrType[] = ["access", "rectification", "objection", "other"];

/** Ask for the account to be deleted, then sign out. Orders are kept for tax; the profile is anonymised by staff. */
export async function requestDeletionAction(_prev: PrivacyRequestState, form: FormData): Promise<PrivacyRequestState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/signin?next=/account");
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm you want your account deleted." };
  if (!(await rateLimit(`dsr:${customer.id}`, 5, 24 * 3600))) return { error: "You've already sent several requests today. We'll be in touch." };

  const req = await createDataRequest({
    type: "erasure",
    customerId: customer.id,
    contact: customer.phone ?? customer.email,
    message: String(form.get("reason") ?? "").trim() || undefined,
  });
  await logAudit({ by: `Customer ${customer.id}`, action: "privacy.request", target: req.id, detail: "Account deletion requested" }).catch(() => undefined);
  await signOutCustomer();
  redirect(`/account?request=${req.id}`);
}

/** Any other privacy request: access, correction, objection, other. */
export async function privacyRequestAction(_prev: PrivacyRequestState, form: FormData): Promise<PrivacyRequestState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/signin?next=/account");
  const type = String(form.get("type") ?? "") as DsrType;
  const message = String(form.get("message") ?? "").trim();
  if (!OTHER_TYPES.includes(type)) return { error: "Choose what you'd like us to do." };
  if (message.length < 5) return { error: "Tell us a little about your request." };
  if (!(await rateLimit(`dsr:${customer.id}`, 5, 24 * 3600))) return { error: "You've already sent several requests today. We'll be in touch." };

  const req = await createDataRequest({ type, customerId: customer.id, contact: customer.phone ?? customer.email, message });
  await logAudit({ by: `Customer ${customer.id}`, action: "privacy.request", target: req.id, detail: type }).catch(() => undefined);
  return { ok: true, id: req.id };
}
