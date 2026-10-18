"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { DSR_TYPE_LABEL } from "@/lib/legal";
import { waLink } from "@/lib/settings";
import { privacyRequestAction, requestDeletionAction, type PrivacyRequestState } from "./privacy-actions";

// "Your data & privacy" on /account: download, other requests, delete account, contact.

export function PrivacyControls({ privacyEmail, whatsapp }: { privacyEmail: string; whatsapp: string }) {
  const [open, setOpen] = useState<null | "request" | "delete">(null);
  const [reqState, requestAction, requesting] = useActionState<PrivacyRequestState, FormData>(privacyRequestAction, {});
  const [delState, deleteAction, deleting] = useActionState<PrivacyRequestState, FormData>(requestDeletionAction, {});

  const row = "flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-bold hover:bg-stage";
  const error = (e?: string) => e && <p className="rounded-xl bg-[#fde8ef] px-3 py-2 text-[13px] font-bold text-sale">{e}</p>;

  return (
    <section className="mt-10 text-left" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className="text-[18px] font-bold">
        Your data &amp; privacy
      </h2>
      <p className="mt-1 text-[13px] text-muted">Your rights under the Nigeria Data Protection Act. See our <Link href="/privacy#your-rights" className="underline underline-offset-2">Privacy Policy</Link>.</p>

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-tile border border-line bg-white">
        <a href="/account/data" download className={row}>
          <Icon name="scan" size={20} />
          <span className="flex-1">Download my data</span>
          <span className="text-[12px] font-normal text-muted">JSON</span>
        </a>

        <div>
          <button type="button" className={row} aria-expanded={open === "request"} onClick={() => setOpen(open === "request" ? null : "request")}>
            <Icon name="chat" size={20} />
            <span className="flex-1">Correct, restrict or object</span>
            <Icon name="chevronRight" size={18} className={open === "request" ? "rotate-90" : ""} />
          </button>
          {open === "request" &&
            (reqState.ok ? (
              <p className="px-5 pb-5 text-[14px] text-ok">
                <b>Request {reqState.id} received.</b> We&apos;ll reply within 30 days, usually much sooner.
              </p>
            ) : (
              <form action={requestAction} className="space-y-3 px-5 pb-5">
                <select name="type" className="field" defaultValue="rectification" aria-label="Request type">
                  {(["rectification", "objection", "access", "other"] as const).map((t) => (
                    <option key={t} value={t}>
                      {DSR_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <textarea name="message" required minLength={5} maxLength={2000} rows={3} className="field" placeholder="What would you like us to do?" aria-label="Details" />
                {error(reqState.error)}
                <button disabled={requesting} className="btn btn-primary w-full">
                  {requesting ? "Sending…" : "Send request"}
                </button>
              </form>
            ))}
        </div>

        <div>
          <button type="button" className={`${row} text-sale`} aria-expanded={open === "delete"} onClick={() => setOpen(open === "delete" ? null : "delete")}>
            <Icon name="close" size={20} />
            <span className="flex-1">Delete my account</span>
            <Icon name="chevronRight" size={18} className={open === "delete" ? "rotate-90" : ""} />
          </button>
          {open === "delete" && (
            <form action={deleteAction} className="space-y-3 px-5 pb-5 text-[14px] text-ink-2">
              <p>
                We&apos;ll remove your name, phone number, email and address and close your account, normally within 30 days. Order and payment records are kept
                for 6 years because tax law requires it, without your contact details. Open orders or disputes must be finished first.
              </p>
              <textarea name="reason" maxLength={2000} rows={2} className="field" placeholder="Anything we should know? (optional)" aria-label="Reason" />
              <label className="flex items-start gap-2">
                <input type="checkbox" name="confirm" className="mt-1" />
                <span>I understand my account will be deleted and I&apos;ll be signed out.</span>
              </label>
              {error(delState.error)}
              <button disabled={deleting} className="btn w-full bg-sale text-white hover:opacity-90">
                {deleting ? "Sending…" : "Request account deletion"}
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-[14px]">
          <Icon name="mail" size={20} />
          <span className="flex-1 font-bold">Contact our Data Protection Officer</span>
          <a href={`mailto:${privacyEmail}?subject=Privacy%20request`} className="link-cta">
            Email
          </a>
          <a href={waLink(whatsapp, "Hi JDHub, I have a privacy request about my account.")} target="_blank" rel="noopener noreferrer" className="link-cta">
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
