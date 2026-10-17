"use client";

import { useActionState, useState } from "react";
import { deleteLeadAction, setLeadStatusAction, type LeadActionState } from "@/app/admin/(panel)/requests/actions";
import type { Lead } from "@/lib/types";
import { Dialog } from "./Dialog";

// Status and delete controls on a request card.

export function LeadActions({ id, name, status, canWrite }: { id: string; name: string; status: Lead["status"]; canWrite: boolean }) {
  const [state, setStatus, pending] = useActionState<LeadActionState, FormData>(setLeadStatusAction, {});
  const [delState, del, deleting] = useActionState<LeadActionState, FormData>(deleteLeadAction, {});
  const [confirm, setConfirm] = useState(false);

  if (!canWrite) return null;

  const moves: { to: Lead["status"]; label: string; primary?: boolean }[] =
    status === "new"
      ? [
          { to: "contacted", label: "Mark contacted", primary: true },
          { to: "closed", label: "Close" },
        ]
      : status === "contacted"
        ? [
            { to: "closed", label: "Mark closed", primary: true },
            { to: "new", label: "Back to new" },
          ]
        : [{ to: "new", label: "Reopen" }];

  const error = state.error ?? delState.error;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves.map((m) => (
        <form key={m.to} action={setStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={m.to} />
          <button className={`btn min-h-9 px-4 py-2 text-[13px] ${m.primary ? "btn-primary" : "btn-outline"}`} disabled={pending}>
            {m.label}
          </button>
        </form>
      ))}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="btn min-h-9 border-line! bg-white px-4 py-2 text-[13px] text-sale hover:border-sale!"
        disabled={deleting}
        aria-label={`Delete request from ${name}`}
      >
        Delete
      </button>
      <span role="status" aria-live="polite" className="text-[13px] font-bold text-sale">
        {error}
      </span>
      {confirm && (
        <Dialog open onClose={() => setConfirm(false)} title="Delete this request?" tone="danger" description={<>The request from <b>{name}</b> is removed for good. Close it instead if you want to keep a record.</>}>
          <form action={del} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <input type="hidden" name="id" value={id} />
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>
              Back
            </button>
            <button className="btn bg-sale text-white hover:bg-[#b8003c]" disabled={deleting} autoFocus>
              {deleting ? "Deleting…" : "Delete request"}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
