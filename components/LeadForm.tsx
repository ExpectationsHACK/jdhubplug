"use client";

import Link from "next/link";
import { useActionState, useEffect, useId } from "react";
import { track } from "@/lib/analytics";
import { submitLead, type LeadState } from "@/app/(store)/lead-actions";
import type { LeadType } from "@/lib/types";
import { CommerceMotion } from "./checkout/Motion";
import { Icon } from "./Icon";

/**
 * Request form that lands in /admin/requests. Pass `details` to attach structured
 * data (sent as hidden `d_*` fields), e.g. the model and estimate from the sell tool.
 */
export function LeadForm({
  type,
  submitLabel = "Send request",
  messageLabel = "Anything we should know?",
  details = {},
  dark = false,
  successTitle = "Request received.",
  successBody = "We'll call or WhatsApp you shortly.",
}: {
  type: LeadType;
  submitLabel?: string;
  messageLabel?: string;
  details?: Record<string, string>;
  dark?: boolean;
  successTitle?: string;
  successBody?: string;
}) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, {});
  const id = useId();
  useEffect(() => {
    if (state.ok) track("lead_submitted", { lead_type: type });
  }, [state.ok, type]);
  if (state.ok) {
    return (
      <div className={`fade-in flex items-start gap-3 rounded-xl p-4 ${dark ? "bg-white/10 text-white" : "bg-[#e6f6ee] text-ok"}`} role="status">
        <CommerceMotion />
        <span className="jdc-pop">
          <Icon name="checkCircle" size={24} />
        </span>
        <div className={dark ? "text-white" : "text-ink"}>
          <p className="font-bold">{successTitle}</p>
          <p className={`text-[14px] ${dark ? "text-white/75" : "text-ink-2"}`}>{successBody}</p>
          {state.statusUrl && (
            <>
              <Link href={state.statusUrl} className={`btn mt-3 min-h-10 px-5 py-2 text-[14px] ${dark ? "btn-white" : "btn-primary"}`}>
                Track your trade-in <Icon name="arrowRight" size={16} />
              </Link>
              <p className={`mt-2 text-[12px] ${dark ? "text-white/60" : "text-muted"}`}>Bookmark this link: it shows your inspection booking, final offer and payout.</p>
            </>
          )}
        </div>
      </div>
    );
  }
  const field = `field ${dark ? "!border-white/20 !bg-white/10 !text-white placeholder:!text-white/50" : ""}`;
  return (
    <form action={action} className="space-y-3" noValidate>
      <CommerceMotion />
      <input type="hidden" name="type" value={type} />
      {Object.entries(details).map(([k, v]) => (
        <input key={k} type="hidden" name={`d_${k}`} value={v} />
      ))}
      {/* Honeypot: hidden from people and assistive tech. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="sr-only">
            Your name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={state.values?.name}
            placeholder="Your name"
            autoComplete="name"
            className={field}
          />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className="sr-only">
            Phone or WhatsApp number
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            required
            type="tel"
            inputMode="tel"
            maxLength={20}
            defaultValue={state.values?.phone}
            placeholder="Phone / WhatsApp"
            autoComplete="tel"
            className={field}
          />
        </div>
      </div>
      {(type === "sell" || type === "swap") && (
        <div>
          <label htmlFor={`${id}-email`} className="sr-only">
            Email for offer updates (optional)
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            maxLength={120}
            defaultValue={state.values?.email}
            placeholder="Email for offer updates (optional)"
            autoComplete="email"
            className={field}
          />
        </div>
      )}
      <label htmlFor={`${id}-msg`} className="sr-only">
        {messageLabel}
      </label>
      <textarea id={`${id}-msg`} name="message" rows={3} maxLength={2000} defaultValue={state.values?.message} placeholder={messageLabel} className={field} />
      {state.error && (
        <p key={state.n} role="alert" className={`jdc-shake text-[13px] font-bold ${dark ? "text-white" : "text-sale"}`}>
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`btn btn-lg w-full ${dark ? "btn-white" : "btn-primary"}`}>
        {pending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
