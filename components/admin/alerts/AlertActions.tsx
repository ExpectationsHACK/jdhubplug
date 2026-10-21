"use client";

import { startTransition, useActionState, useState } from "react";
import { deleteAlertAction, sendModelAlertsAction, type AlertActionState } from "@/app/admin/(panel)/alerts/actions";
import { Dialog } from "../orders/Dialog";

// Controls on /admin/alerts. Rendered only for roles with products:write (also checked server-side).

/** Close the confirm dialog and dispatch the action with these fields. */
function run(dispatch: (fd: FormData) => void, fields: Record<string, string>, close: () => void) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  close();
  startTransition(() => dispatch(fd));
}

export function SendModelButton({ model, name, waiting, inStock }: { model: string; name: string; waiting: number; inStock: number }) {
  const [state, send, pending] = useActionState<AlertActionState, FormData>(sendModelAlertsAction, {});
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={pending || inStock === 0}
        title={inStock === 0 ? "Add stock for this model first" : undefined}
        className="btn btn-primary min-h-9 px-4 py-2 text-[13px]"
        aria-label={`Send stock alerts for ${name}`}
      >
        {pending ? "Sending…" : "Send now"}
      </button>
      <span role="status" aria-live="polite" className={`max-w-56 text-right text-[12px] font-bold ${state.error ? "text-sale" : "text-ok"}`}>
        {state.error ?? state.message}
      </span>
      {confirm && (
        <Dialog
          open
          onClose={() => setConfirm(false)}
          title="Send stock alerts now?"
          description={
            <>
              <b>{waiting}</b> {waiting === 1 ? "shopper is" : "shoppers are"} waiting on <b>{name}</b>. Each gets one message pointing to a unit in stock.
            </>
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" autoFocus onClick={() => run(send, { model }, () => setConfirm(false))}>
              Send alerts
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function DeleteAlertButton({ id, label }: { id: string; label: string }) {
  const [state, del, pending] = useActionState<AlertActionState, FormData>(deleteAlertAction, {});
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={pending}
        aria-label={`Delete alert for ${label}`}
        className="btn min-h-8 border-line! bg-white px-3 py-1.5 text-[12px] text-sale hover:border-sale!"
      >
        Delete
      </button>
      {state.error && (
        <span role="alert" className="ml-2 text-[12px] font-bold text-sale">
          {state.error}
        </span>
      )}
      {confirm && (
        <Dialog open onClose={() => setConfirm(false)} title="Delete this alert?" tone="danger" description={<>The alert for <b>{label}</b> is removed for good, including its history.</>}>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>
              Back
            </button>
            <button type="button" className="btn bg-sale text-white hover:bg-[#b8003c]" autoFocus onClick={() => run(del, { id }, () => setConfirm(false))}>
              Delete alert
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
