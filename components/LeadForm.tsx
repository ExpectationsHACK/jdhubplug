"use client";

import { useActionState } from "react";
import { submitLead, type LeadState } from "@/app/(store)/lead-actions";
import type { LeadType } from "@/lib/types";
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
}: {
  type: LeadType;
  submitLabel?: string;
  messageLabel?: string;
  details?: Record<string, string>;
  dark?: boolean;
}) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, {});
  if (state.ok) {
    return (
      <div className={`fade-in flex items-start gap-3 rounded-xl p-4 ${dark ? "bg-white/10 text-white" : "bg-[#e6f6ee] text-ok"}`} role="status">
        <Icon name="checkCircle" size={24} />
        <div className={dark ? "text-white" : "text-ink"}>
          <p className="font-bold">Request received.</p>
          <p className={`text-[14px] ${dark ? "text-white/75" : "text-ink-2"}`}>We&apos;ll call or WhatsApp you shortly.</p>
        </div>
      </div>
    );
  }
  const field = `field ${dark ? "!border-white/20 !bg-white/10 !text-white placeholder:!text-white/50" : ""}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      {Object.entries(details).map(([k, v]) => (
        <input key={k} type="hidden" name={`d_${k}`} value={v} />
      ))}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" autoComplete="name" className={field} />
        <input name="phone" required type="tel" inputMode="tel" placeholder="Phone / WhatsApp" autoComplete="tel" className={field} />
      </div>
      <textarea name="message" rows={3} placeholder={messageLabel} className={field} />
      {state.error && <p className="text-[13px] font-bold text-sale">{state.error}</p>}
      <button disabled={pending} className={`btn btn-lg w-full ${dark ? "btn-white" : "btn-primary"}`}>
        {pending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
