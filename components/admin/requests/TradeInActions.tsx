"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addLeadNoteAction,
  bookInspectionAction,
  closeLeadAction,
  markContactedAction,
  recordInspectionAction,
  recordPayoutAction,
  recordResponseAction,
  resendMessageAction,
  sendOfferAction,
  type TradeActionState,
} from "@/app/admin/(panel)/requests/trade-actions";
import { grades } from "@/lib/reference";
import { NIGERIAN_BANKS, PAYOUT_LABEL, toLagosLocal } from "@/lib/tradein-flow";
import type { Hub, InspectionMethod, LeadStatus, LeadType, PayoutMethod } from "@/lib/types";
import { FormField, MoneyInput, Switch, useSubmitKeepingValues } from "../core/form-bits";
import { inputCls, selectCls } from "../ui";

// Stage forms on /admin/requests/[id]. Each form posts to a Server Action in
// app/admin/(panel)/requests/trade-actions.ts, which enforces the allowed moves.

export type TradeInActionProps = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  allowed: LeadStatus[];
  hubs: Hub[];
  staffNames: string[];
  /** Defaults for the forms. */
  estimate?: number;
  finalOffer?: number;
  gradeId?: string;
  booking?: { at: string; method: InspectionMethod; address?: string; hub?: string; staff?: string };
  pickupHint?: string;
  payoutChoice?: { method: PayoutMethod; hasBank: boolean };
  sent: { inspection_booked: boolean; offer_sent: boolean; paid: boolean; credit: boolean };
};

function useAction(action: (p: TradeActionState, f: FormData) => Promise<TradeActionState>) {
  const [state, dispatch, pending] = useActionState<TradeActionState, FormData>(action, {});
  return { state, dispatch, pending, onSubmit: useSubmitKeepingValues(dispatch) };
}

function Status({ state }: { state: TradeActionState }) {
  return (
    <p key={state.n} role="status" aria-live="polite" className="text-[13px]">
      {state.error ? <span className="font-bold text-sale">{state.error}</span> : state.ok ? <span className="font-bold text-ok">{state.message}</span> : null}
    </p>
  );
}

function Submit({ pending, children, tone = "primary" }: { pending: boolean; children: React.ReactNode; tone?: "primary" | "outline" | "danger" }) {
  const cls = tone === "primary" ? "btn-primary" : tone === "danger" ? "bg-sale text-white hover:bg-[#b8003c]" : "btn-outline";
  return (
    <button className={`btn min-h-10 shrink-0 px-5 py-2 text-[14px] ${cls}`} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function Panel({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-white open:border-ink">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-bold [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
        </span>
        <svg aria-hidden className="shrink-0 transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

function BankFields({ required }: { required?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField label="Bank" optional={!required}>
        <select name="bankName" className={selectCls} defaultValue="">
          <option value="">Choose bank</option>
          {NIGERIAN_BANKS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Account number" optional={!required}>
        <input name="accountNumber" inputMode="numeric" maxLength={10} pattern="\d{10}" autoComplete="off" className={`${inputCls} tabular-nums`} placeholder="10-digit NUBAN" />
      </FormField>
      <FormField label="Account name" optional={!required}>
        <input name="accountName" maxLength={100} autoComplete="off" className={inputCls} />
      </FormField>
    </div>
  );
}

const Hidden = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

// ------------------------------------------------------------------ Forms

function ContactedForm({ id }: { id: string }) {
  const a = useAction(markContactedAction);
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-3">
      <Hidden id={id} />
      <FormField label="Note" optional>
        <input name="note" maxLength={500} className={inputCls} placeholder="e.g. Called, wants pickup on Saturday" />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>Mark contacted</Submit>
      </div>
    </form>
  );
}

function BookForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(bookInspectionAction);
  const [method, setMethod] = useState<InspectionMethod>(p.booking?.method ?? "pickup");
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-4">
      <Hidden id={p.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Date and time" hint="Lagos time">
          <input type="datetime-local" name="at" required step={900} defaultValue={p.booking ? toLagosLocal(p.booking.at) : ""} className={inputCls} />
        </FormField>
        <FormField label="Inspector" optional>
          <input name="staff" list={`staff-${p.id}`} maxLength={80} defaultValue={p.booking?.staff} className={inputCls} placeholder="Staff name" />
        </FormField>
        <datalist id={`staff-${p.id}`}>
          {p.staffNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-bold text-ink-2">Method</legend>
        <div className="flex flex-wrap gap-2">
          {(["pickup", "dropoff"] as const).map((m) => (
            <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-bold ${method === m ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {m === "pickup" ? "Pickup at address" : "Drop-off at hub"}
            </label>
          ))}
        </div>
      </fieldset>
      {method === "pickup" ? (
        <FormField label="Pickup address">
          <input name="address" required minLength={5} maxLength={300} defaultValue={p.booking?.address ?? p.pickupHint} className={inputCls} placeholder="Street, area, city" />
        </FormField>
      ) : (
        <FormField label="Hub">
          <select name="hub" required defaultValue={p.booking?.hub ?? p.hubs[0]?.city} className={selectCls}>
            {p.hubs.map((h) => (
              <option key={h.city} value={h.city}>
                {h.city} · {h.address}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <Switch name="notify" label="Message the customer" description="Email and/or SMS with the date and place." defaultChecked />
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>{p.booking ? "Rebook inspection" : "Book inspection"}</Submit>
      </div>
    </form>
  );
}

function InspectForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(recordInspectionAction);
  const cond = (name: string, label: string) => (
    <FormField label={label}>
      <select name={name} defaultValue="ok" className={selectCls}>
        <option value="ok">Good</option>
        <option value="minor">Minor wear</option>
        <option value="damaged">Damaged</option>
      </select>
    </FormField>
  );
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-4">
      <Hidden id={p.id} />
      <div className="grid gap-3 rounded-xl bg-stage p-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-[14px] font-bold">
          <input type="checkbox" name="imeiClean" defaultChecked className="h-4 w-4 accent-[var(--ink)]" /> IMEI clean (not blacklisted)
        </label>
        <label className="flex items-center gap-2 text-[14px] font-bold">
          <input type="checkbox" name="accountSignedOut" defaultChecked className="h-4 w-4 accent-[var(--ink)]" /> Signed out of iCloud / Google
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cond("screen", "Screen")}
        {cond("body", "Body")}
        <FormField label="Functions">
          <select name="functions" defaultValue="ok" className={selectCls}>
            <option value="ok">All working</option>
            <option value="issues">Issues found</option>
          </select>
        </FormField>
        <FormField label="Battery health %" optional>
          <input name="battery" type="number" min={0} max={100} inputMode="numeric" className={inputCls} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Actual grade">
          <select name="grade" defaultValue={p.gradeId ?? ""} required className={selectCls}>
            <option value="" disabled>
              Choose grade
            </option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.letter} · {g.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Final offer" hint={p.estimate ? `Estimate was ₦${p.estimate.toLocaleString("en-NG")}` : undefined}>
          <MoneyInput name="finalOffer" required defaultValue={p.finalOffer ?? p.estimate ?? ""} />
        </FormField>
      </div>
      <FormField label="Notes" optional hint="Shown to the customer with the offer.">
        <textarea name="notes" rows={3} maxLength={1000} className={`${inputCls} resize-y`} placeholder="e.g. Small scratch on the back glass; battery 84%" />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>Save inspection</Submit>
      </div>
    </form>
  );
}

function OfferForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(sendOfferAction);
  const revise = p.status === "offer_sent" || p.status === "declined";
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-3">
      <Hidden id={p.id} />
      <FormField label={revise ? "Revised offer" : "Final offer"} hint="The customer gets a message with their status link to accept or decline.">
        <MoneyInput name="finalOffer" defaultValue={p.finalOffer ?? ""} />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>{revise ? "Send revised offer" : "Send offer"}</Submit>
      </div>
    </form>
  );
}

function ResponseForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(recordResponseAction);
  const [decision, setDecision] = useState<"accepted" | "declined">("accepted");
  const methods: PayoutMethod[] = p.type === "swap" ? ["swap_credit", "bank", "cash"] : ["bank", "cash"];
  const [method, setMethod] = useState<PayoutMethod>(methods[0]);
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-4">
      <Hidden id={p.id} />
      <div className="flex flex-wrap gap-2">
        {(["accepted", "declined"] as const).map((d) => (
          <label key={d} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-bold ${decision === d ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
            {d === "accepted" ? "Customer accepted" : "Customer declined"}
          </label>
        ))}
      </div>
      {decision === "accepted" ? (
        <>
          <FormField label="Payout method" hint={method === "swap_credit" ? "Issues a single-use code for the final offer amount, valid 30 days, and messages it to the customer." : undefined}>
            <select name="payout" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)} className={selectCls}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {PAYOUT_LABEL[m]}
                </option>
              ))}
            </select>
          </FormField>
          {method === "bank" && <BankFields />}
        </>
      ) : (
        <FormField label="Reason" optional>
          <input name="reason" maxLength={500} className={inputCls} placeholder="e.g. Wanted a higher offer" />
        </FormField>
      )}
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>{decision === "accepted" ? "Mark accepted" : "Mark declined"}</Submit>
      </div>
    </form>
  );
}

function PayoutForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(recordPayoutAction);
  const methods: PayoutMethod[] = p.type === "swap" ? ["swap_credit", "bank", "cash"] : ["bank", "cash"];
  const [method, setMethod] = useState<PayoutMethod>(p.payoutChoice?.method && methods.includes(p.payoutChoice.method) ? p.payoutChoice.method : methods[0]);
  const needBank = method === "bank" && !p.payoutChoice?.hasBank;
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-4">
      <Hidden id={p.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Method">
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)} className={selectCls}>
            {methods.map((m) => (
              <option key={m} value={m}>
                {PAYOUT_LABEL[m]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Amount">
          <MoneyInput name="amount" defaultValue={p.finalOffer ?? ""} />
        </FormField>
        <FormField label="Reference" optional={method !== "bank"} hint={method === "swap_credit" ? "Defaults to the credit code" : method === "cash" ? "Receipt number" : "Transfer reference"}>
          <input name="reference" maxLength={120} className={inputCls} />
        </FormField>
      </div>
      {method === "bank" &&
        (needBank ? (
          <BankFields required />
        ) : (
          <>
            <p className="text-[13px] text-muted">Paying to the account the customer gave on acceptance. Enter new details only to change it.</p>
            <BankFields />
          </>
        ))}
      {method === "swap_credit" && <p className="text-[13px] text-muted">Use this when the customer redeemed the credit outside checkout. Orders that use the code mark this paid automatically.</p>}
      <Switch name="notify" label="Message the customer" description="Payment confirmation by email and/or SMS." defaultChecked={method !== "swap_credit"} />
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>Record payout</Submit>
      </div>
    </form>
  );
}

function CloseForm({ p }: { p: TradeInActionProps }) {
  const a = useAction(closeLeadAction);
  const options = (["closed", "cancelled"] as const).filter((s) => p.allowed.includes(s));
  return (
    <form action={a.dispatch} onSubmit={a.onSubmit} className="space-y-3">
      <Hidden id={p.id} />
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <FormField label="Outcome">
          <select name="to" defaultValue={options[0]} className={selectCls}>
            {options.map((o) => (
              <option key={o} value={o}>
                {o === "closed" ? "Close" : "Cancel"}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Reason">
          <input name="reason" required minLength={3} maxLength={500} className={inputCls} placeholder={p.status === "paid" ? "e.g. Paid and device received" : "e.g. Customer unreachable, IMEI blacklisted"} />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending} tone={options[0] === "cancelled" ? "danger" : "outline"}>
          Save
        </Submit>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Exports

/** Every form the lead's current stage allows, the most likely next step open. */
export function TradeInActions(p: TradeInActionProps) {
  const has = (s: LeadStatus) => p.allowed.includes(s);
  const primary: LeadStatus | null =
    p.status === "new" || p.status === "contacted"
      ? "inspection_booked"
      : p.status === "inspection_booked"
        ? "inspected"
        : p.status === "inspected"
          ? "offer_sent"
          : p.status === "offer_sent"
            ? "accepted"
            : p.status === "accepted"
              ? "paid"
              : p.status === "paid"
                ? "closed"
                : null;

  if (!p.allowed.length) return <p className="text-[14px] text-muted">No further steps: this request is {p.status}.</p>;

  return (
    <div className="space-y-2">
      {has("contacted") && (
        <Panel title="Mark contacted" open={false}>
          <ContactedForm id={p.id} />
        </Panel>
      )}
      {has("inspection_booked") && (
        <Panel title={p.booking ? "Rebook inspection" : "Book inspection"} open={primary === "inspection_booked"}>
          <BookForm p={p} />
        </Panel>
      )}
      {has("inspected") && (
        <Panel title="Record inspection" hint="checklist, grade and final offer" open={primary === "inspected"}>
          <InspectForm p={p} />
        </Panel>
      )}
      {has("offer_sent") && (
        <Panel title={p.status === "offer_sent" || p.status === "declined" ? "Revise offer" : "Send offer"} open={primary === "offer_sent"}>
          <OfferForm p={p} />
        </Panel>
      )}
      {p.status === "offer_sent" && (
        <Panel title="Record the customer's answer" hint="on their behalf" open={primary === "accepted"}>
          <ResponseForm p={p} />
        </Panel>
      )}
      {has("paid") && (
        <Panel title="Record payout" open={primary === "paid"}>
          <PayoutForm p={p} />
        </Panel>
      )}
      {(has("closed") || has("cancelled")) && (
        <Panel title={has("closed") && has("cancelled") ? "Close or cancel" : has("closed") ? "Close" : "Cancel"} open={primary === "closed"}>
          <CloseForm p={p} />
        </Panel>
      )}
    </div>
  );
}

/** Internal note on the lead timeline. */
export function LeadNoteForm({ id }: { id: string }) {
  const a = useAction(addLeadNoteAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (a.state.ok) ref.current?.reset();
  }, [a.state]);
  return (
    <form ref={ref} action={a.dispatch} onSubmit={a.onSubmit} className="space-y-2">
      <Hidden id={id} />
      <label htmlFor={`lead-note-${id}`} className="sr-only">
        Internal note
      </label>
      <textarea id={`lead-note-${id}`} name="note" rows={2} maxLength={1000} required placeholder="Add an internal note (only staff see this)…" className={`${inputCls} resize-y`} />
      <div className="flex items-center justify-between gap-3">
        <Status state={a.state} />
        <Submit pending={a.pending}>Add note</Submit>
      </div>
    </form>
  );
}

/** Buttons to resend the customer message for steps already reached. */
export function ResendButtons({ id, sent }: { id: string; sent: TradeInActionProps["sent"] }) {
  const a = useAction(resendMessageAction);
  const kinds = (
    [
      ["inspection_booked", "Booking"],
      ["offer_sent", "Offer"],
      ["paid", "Payment"],
      ["credit", "Swap credit"],
    ] as const
  ).filter(([k]) => sent[k]);
  if (!kinds.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {kinds.map(([k, label]) => (
          <form key={k} action={a.dispatch} onSubmit={a.onSubmit}>
            <Hidden id={id} />
            <input type="hidden" name="kind" value={k} />
            <button className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" disabled={a.pending}>
              Resend {label.toLowerCase()}
            </button>
          </form>
        ))}
      </div>
      <Status state={a.state} />
    </div>
  );
}
