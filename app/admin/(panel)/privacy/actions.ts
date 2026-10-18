"use server";

import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth";
import { parseLegalInput, type DsrStatus, type LegalDetails, type LegalErrors } from "@/lib/legal";
import { anonymiseCustomer, getDataRequest, maskContact, saveDataRequest, saveLegal, setDataRequestStatus } from "@/lib/legal-store";
import { refreshFromAction } from "@/lib/revalidate";

export type LegalFormState = { ok?: boolean; error?: string; errors?: LegalErrors; values?: Record<string, string | boolean> };

const FIELDS = [
  "legalName",
  "tradingName",
  "rcNumber",
  "registeredAddress",
  "contactEmail",
  "contactPhone",
  "dpoName",
  "dpoEmail",
  "effectiveDate",
  "returnDays",
  "warrantyDays",
  "carInspectionDays",
  "clauses.privacy",
  "clauses.terms",
  "clauses.returns",
  "clauses.cookies",
];

export async function saveLegalAction(_prev: LegalFormState, form: FormData): Promise<LegalFormState> {
  const session = await requireAdmin("settings:write");
  const values: Record<string, string | boolean> = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "")]));
  values.requireConsent = form.get("requireConsent") === "on";

  const parsed = parseLegalInput(values);
  if (!parsed.ok) return { error: "Check the highlighted fields.", errors: parsed.errors, values };

  const next: LegalDetails = { ...parsed.value, updatedAt: new Date().toISOString(), updatedBy: session.name };
  await saveLegal(next);
  await audit(session, "legal.update", undefined, `Legal details saved (consent banner ${next.requireConsent ? "on" : "off"})`);
  refreshFromAction("legal");
  return { ok: true, values };
}

const STATUSES: DsrStatus[] = ["new", "in_progress", "done"];

export async function setRequestStatusAction(form: FormData) {
  const session = await requireAdmin("settings:write");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as DsrStatus;
  if (!STATUSES.includes(status)) throw new Error("Unknown status.");
  await setDataRequestStatus(id, status, session.name, String(form.get("note") ?? "").trim().slice(0, 500) || undefined);
  await audit(session, "privacy.request_status", id, status);
  refresh();
}

/**
 * Anonymise the customer behind a request: clear their name, phone, email and
 * address, drop their lookup index entries and block the account. Orders stay.
 */
export async function anonymiseCustomerAction(form: FormData) {
  const session = await requireAdmin("settings:write");
  const id = String(form.get("id") ?? "");
  const req = await getDataRequest(id);
  if (!req) throw new Error(`Request ${id} not found.`);
  if (!req.customerId) throw new Error("This request isn't linked to a customer account.");

  const customer = await anonymiseCustomer(req.customerId);
  const at = new Date().toISOString();
  await saveDataRequest({
    ...req,
    status: "done",
    anonymisedAt: at,
    contact: maskContact(req.contact),
    history: [...req.history, { at, by: session.name, note: customer ? "Customer profile anonymised and account blocked" : "Customer record not found" }],
  });
  await audit(session, "privacy.anonymise", req.customerId, `Request ${req.id}${customer ? "" : " (customer not found)"}`);
  refresh();
}
