"use client";

import { useActionState } from "react";
import { Card, inputCls, labelCls } from "@/components/admin/ui";
import { LEGAL_PAGE_LABEL, LEGAL_PAGES, type LegalDetails } from "@/lib/legal";
import { saveLegalAction, type LegalFormState } from "./actions";

// Legal details editor for /admin/privacy. Server-side validation in parseLegalInput.

function toValues(l: LegalDetails): Record<string, string | boolean> {
  return {
    legalName: l.legalName,
    tradingName: l.tradingName,
    rcNumber: l.rcNumber,
    registeredAddress: l.registeredAddress,
    contactEmail: l.contactEmail,
    contactPhone: l.contactPhone,
    dpoName: l.dpoName,
    dpoEmail: l.dpoEmail,
    effectiveDate: l.effectiveDate,
    returnDays: String(l.returnDays),
    warrantyDays: String(l.warrantyDays),
    carInspectionDays: String(l.carInspectionDays),
    requireConsent: l.requireConsent,
    ...Object.fromEntries(LEGAL_PAGES.map((p) => [`clauses.${p}`, l.clauses[p]])),
  };
}

export function LegalForm({ legal, storeName, storeEmail }: { legal: LegalDetails; storeName: string; storeEmail: string }) {
  const [state, action, pending] = useActionState<LegalFormState, FormData>(saveLegalAction, {});
  const v = state.values ?? toValues(legal);
  const err = state.errors ?? {};

  const text = (name: string, label: string, opts: { hint?: string; placeholder?: string; type?: string; required?: boolean; className?: string } = {}) => (
    <label className={`block ${opts.className ?? ""}`}>
      <span className={labelCls}>
        {label}
        {opts.required && <span className="text-sale"> *</span>}
      </span>
      <input
        name={name}
        type={opts.type ?? "text"}
        defaultValue={String(v[name] ?? "")}
        placeholder={opts.placeholder}
        required={opts.required}
        aria-invalid={!!err[name]}
        className={`${inputCls} ${err[name] ? "border-sale" : ""}`}
      />
      {err[name] ? <span className="mt-1 block text-[12px] font-bold text-sale">{err[name]}</span> : opts.hint && <span className="mt-1 block text-[12px] text-muted">{opts.hint}</span>}
    </label>
  );

  return (
    <form action={action} className="space-y-6">
      <Card title="Business details">
        <div className="grid gap-4 md:grid-cols-2">
          {text("legalName", "Registered business name", { required: true, placeholder: "JDHub Technologies Ltd", hint: "Exactly as on your CAC certificate." })}
          {text("tradingName", "Trading name", { placeholder: storeName, hint: `Leave empty to use the store name (${storeName}).` })}
          {text("rcNumber", "CAC RC / BN number", { placeholder: "RC 1234567" })}
          {text("effectiveDate", "Effective date", { type: "date", required: true, hint: "Change this when the terms materially change." })}
          {text("registeredAddress", "Registered address", { className: "md:col-span-2", placeholder: "Street, city, state" })}
          {text("contactEmail", "Contact email", { type: "email", placeholder: storeEmail, hint: "Leave empty to use the store email." })}
          {text("contactPhone", "Contact phone", { placeholder: "+234 800 000 0000" })}
        </div>
      </Card>

      <Card title="Data Protection Officer">
        <div className="grid gap-4 md:grid-cols-2">
          {text("dpoName", "DPO name", { hint: "The NDPA expects you to designate a Data Protection Officer." })}
          {text("dpoEmail", "DPO email", { type: "email", placeholder: "privacy@…", hint: "Where privacy requests go. Falls back to the contact email." })}
        </div>
      </Card>

      <Card title="Returns & warranty">
        <div className="grid gap-4 md:grid-cols-3">
          {text("returnDays", "Return window (days)", { type: "number", required: true, hint: "Not-as-described or faulty items." })}
          {text("warrantyDays", "Warranty on graded devices (days)", { type: "number", required: true })}
          {text("carInspectionDays", "Car inspection period (days)", { type: "number", required: true, hint: "Before escrow is released." })}
        </div>
      </Card>

      <Card title="Cookie consent">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="requireConsent" defaultChecked={v.requireConsent === true} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="block text-[14px] font-bold">Show the cookie banner and require consent for analytics</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">
              Recommended under the NDPA. When off, no banner is shown and PostHog runs unless a visitor turns it off in Cookie settings.
            </span>
          </span>
        </label>
      </Card>

      <Card title="Additional clauses">
        <p className="mb-4 text-[13px] text-ink-2">
          Optional text added at the end of each page. Separate paragraphs with a blank line. Supports <code>## Heading</code>, <code>- list item</code>,{" "}
          <code>**bold**</code> and <code>[link text](https://…)</code>. HTML is shown as plain text.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {LEGAL_PAGES.map((p) => {
            const name = `clauses.${p}`;
            return (
              <label key={p} className="block">
                <span className={labelCls}>{LEGAL_PAGE_LABEL[p]}</span>
                <textarea name={name} rows={5} defaultValue={String(v[name] ?? "")} className={`${inputCls} ${err[name] ? "border-sale" : ""}`} />
                {err[name] && <span className="mt-1 block text-[12px] font-bold text-sale">{err[name]}</span>}
              </label>
            );
          })}
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-[#f6f7f9]/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        {state.error && <p className="mr-auto text-[13px] font-bold text-sale">{state.error}</p>}
        {state.ok && !pending && <p className="mr-auto text-[13px] font-bold text-ok">Saved. The legal pages are updated.</p>}
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save legal details"}
        </button>
      </div>
    </form>
  );
}
