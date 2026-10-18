"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { respondToOfferAction, type RespondState } from "@/app/(store)/trade-in/[id]/actions";
import { NIGERIAN_BANKS } from "@/lib/tradein-flow";
import type { LeadType } from "@/lib/types";
import { Icon } from "../Icon";

/** Accept / decline buttons for a sent offer. Accepting a sale collects payout bank details. */
export function OfferResponse({ id, token, type, amount }: { id: string; token: string; type: LeadType; amount: string }) {
  const [state, action, pending] = useActionState<RespondState, FormData>(respondToOfferAction, {});
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [payout, setPayout] = useState<"bank" | "swap_credit">(type === "swap" ? "swap_credit" : "bank");
  const uid = useId();
  const [, start] = useTransition();
  // Dispatch without React's automatic form reset, so a typo in the account number
  // doesn't wipe the whole form. `action=` stays for submits before hydration.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => action(fd));
  };

  if (state.ok) {
    return (
      <p role="status" className="fade-in flex items-start gap-2 rounded-xl bg-[#e6f6ee] p-4 text-[14px] font-bold text-ok">
        <Icon name="checkCircle" size={20} className="shrink-0" /> {state.message}
      </p>
    );
  }

  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="t" value={token} />
    </>
  );
  const error = state.error && (
    <p key={state.n} role="alert" className="jdc-shake text-[13px] font-bold text-sale">
      {state.error}
    </p>
  );

  if (mode === "idle") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => setMode("accept")} className="btn btn-primary btn-lg flex-1">
          Accept {amount}
        </button>
        <button type="button" onClick={() => setMode("decline")} className="btn btn-outline btn-lg flex-1">
          Decline
        </button>
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <form action={action} onSubmit={submit} className="fade-in space-y-3">
        {hidden}
        <input type="hidden" name="decision" value="declined" />
        <label htmlFor={`${uid}-reason`} className="block text-[14px] font-bold">
          Mind telling us why? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id={`${uid}-reason`} name="reason" rows={3} maxLength={500} className="field" placeholder="e.g. I got a better offer, I've decided to keep it" />
        {error}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => setMode("idle")} className="btn btn-outline flex-1">
            Back
          </button>
          <button disabled={pending} className="btn btn-primary flex-1">
            {pending ? "Sending…" : "Decline offer"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} onSubmit={submit} className="fade-in space-y-4" noValidate>
      {hidden}
      <input type="hidden" name="decision" value="accepted" />
      {type === "swap" && (
        <fieldset>
          <legend className="mb-2 text-[14px] font-bold">How would you like your {amount}?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["swap_credit", "Swap credit", "A one-use code for your next device, valid 30 days."],
                ["bank", "Bank transfer", "Paid to your account within 48 hours."],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className="chip cursor-pointer has-[:checked]:border-ink">
                <span className="flex items-center gap-2 font-bold">
                  <input type="radio" name="payout" value={v} checked={payout === v} onChange={() => setPayout(v)} className="accent-[var(--ink)]" />
                  {label}
                </span>
                <span className="mt-1 block text-[12px] text-muted">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {type !== "swap" && <input type="hidden" name="payout" value="bank" />}

      {payout === "bank" && (
        <div className="space-y-3">
          <p className="text-[14px] font-bold">Where should we send your money?</p>
          <div>
            <label htmlFor={`${uid}-bank`} className="mb-1 block text-[13px] font-bold text-ink-2">
              Bank
            </label>
            <select id={`${uid}-bank`} name="bankName" required className="field" defaultValue="">
              <option value="" disabled>
                Choose your bank
              </option>
              {NIGERIAN_BANKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-acct`} className="mb-1 block text-[13px] font-bold text-ink-2">
                Account number (NUBAN)
              </label>
              <input
                id={`${uid}-acct`}
                name="accountNumber"
                required
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                autoComplete="off"
                placeholder="10 digits"
                className="field tabular-nums"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-name`} className="mb-1 block text-[13px] font-bold text-ink-2">
                Account name
              </label>
              <input id={`${uid}-name`} name="accountName" required maxLength={100} autoComplete="name" placeholder="As shown by your bank" className="field" />
            </div>
          </div>
          <p className="text-[12px] text-muted">The account name should match the name on your request. We only show the last 4 digits back to you.</p>
        </div>
      )}

      {error}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={() => setMode("idle")} className="btn btn-outline flex-1">
          Back
        </button>
        <button disabled={pending} className="btn btn-primary flex-1">
          {pending ? "Confirming…" : `Accept ${amount}`}
        </button>
      </div>
    </form>
  );
}
