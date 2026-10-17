"use client";

import { useActionState } from "react";
import {
  resendOrderMessageAction,
  saveNotifySettingsAction,
  sendTestEmailAction,
  type NotifyActionState,
} from "@/app/admin/(panel)/notifications/actions";
import { EVENT_HINT, EVENT_LABEL, NOTIFY_EVENTS, type NotifySettings } from "@/lib/notify/events";
import { FormField, fieldCls } from "../core/form-bits";
import { AdminIcon } from "../core/icons";

// Client forms for /admin/notifications and the order page's "resend" buttons.

function Status({ state, pending, pendingText }: { state: NotifyActionState; pending: boolean; pendingText: string }) {
  return (
    <p role="status" aria-live="polite" className="flex min-h-5 min-w-0 items-center gap-1.5 text-[13px] font-bold">
      {pending ? (
        <>
          <AdminIcon name="refresh" size={15} className="motion-safe:animate-spin" /> {pendingText}
        </>
      ) : state.message ? (
        <span key={state.at} className={`flex items-center gap-1.5 motion-safe:animate-[fade-in_.3s_ease_both] ${state.ok ? "text-ok" : "text-sale"}`}>
          <AdminIcon name={state.ok ? "check" : "alert"} size={15} className="shrink-0" /> {state.message}
        </span>
      ) : null}
    </p>
  );
}

/** A compact checkbox toggle for the channel grid. */
function Toggle({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        name={name}
        aria-label={label}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer h-7 w-12 cursor-pointer appearance-none rounded-full bg-[#d4d4d4] outline-none transition-colors checked:bg-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <span aria-hidden className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5 motion-reduce:transition-none" />
    </span>
  );
}

export function NotifySettingsForm({ settings, readOnly }: { settings: NotifySettings; readOnly: boolean }) {
  const [state, action, pending] = useActionState<NotifyActionState, FormData>(saveNotifySettingsAction, {});
  const row = (key: string, label: string, hint: string, value: { email: boolean; sms: boolean }) => (
    <tr key={key}>
      <td className="py-3 pr-4">
        <p className="text-[14px] font-bold">{label}</p>
        <p className="text-[12px] text-muted">{hint}</p>
      </td>
      <td className="w-20 py-3 text-center">
        <Toggle name={`${key}_email`} label={`${label}: email`} defaultChecked={value.email} disabled={readOnly} />
      </td>
      <td className="w-20 py-3 text-center">
        <Toggle name={`${key}_sms`} label={`${label}: SMS`} defaultChecked={value.sms} disabled={readOnly} />
      </td>
    </tr>
  );

  return (
    <form action={action}>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
            <th className="pb-2 font-bold">To the customer</th>
            <th className="pb-2 text-center font-bold">Email</th>
            <th className="pb-2 text-center font-bold">SMS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{NOTIFY_EVENTS.map((e) => row(e, EVENT_LABEL[e], EVENT_HINT[e], settings.events[e]))}</tbody>
        <thead>
          <tr className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
            <th className="pb-2 pt-6 font-bold" colSpan={3}>
              To the store
            </th>
          </tr>
        </thead>
        <tbody>{row("store", "New-order alert", "Email to the store email and SMS to the store phone (Settings → Store details).", settings.storeAlert)}</tbody>
      </table>
      {!readOnly && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Save notifications
          </button>
          <Status state={state} pending={pending} pendingText="Saving…" />
        </div>
      )}
    </form>
  );
}

export function TestEmailForm({ defaultTo, disabled }: { defaultTo: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<NotifyActionState, FormData>(sendTestEmailAction, {});
  return (
    <form action={action} className="space-y-3">
      <FormField label="Send a test email to">
        <input type="email" name="to" required maxLength={120} defaultValue={defaultTo} autoComplete="email" disabled={disabled} className={fieldCls()} />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-outline" disabled={pending || disabled}>
          <AdminIcon name="megaphone" size={16} /> Send test email
        </button>
        <Status state={state} pending={pending} pendingText="Sending…" />
      </div>
    </form>
  );
}

/** "Resend confirmation" / "Resend latest update" on the admin order page. */
export function ResendButtons({ id, latestLabel }: { id: string; latestLabel: string }) {
  const [state, action, pending] = useActionState<NotifyActionState, FormData>(resendOrderMessageAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="kind" value="confirmation" className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" disabled={pending}>
          Resend confirmation
        </button>
        <button type="submit" name="kind" value="latest" className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" disabled={pending} title={`Sends: ${latestLabel}`}>
          Resend latest update
        </button>
      </div>
      <Status state={state} pending={pending} pendingText="Sending…" />
    </form>
  );
}
