"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { deleteOfferAction, deleteOfferAndReturnAction, duplicateOfferAction, setOfferActiveAction } from "@/app/admin/(panel)/offers/actions";

/** redirect() inside an action can surface as a thrown digest; let Next handle it. */
export const isRedirect = (e: unknown) =>
  typeof e === "object" && e !== null && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-bold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50";

/** Delete with a confirmation dialog. */
export function DeleteOfferButton({ code, title, returnToList = false, className = pill }: { code: string; title: string; returnToList?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={`${className} hover:!border-sale hover:text-sale`}>
        Delete
      </button>
      <dialog ref={dialog} aria-labelledby={`del-${code}`} className="m-auto w-[min(92vw,420px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50">
        <div className="p-6">
          <p id={`del-${code}`} className="text-[18px] font-bold">
            Delete “{title}”?
          </p>
          <p className="mt-2 text-[14px] text-ink-2">
            The special link <b className="font-mono">/o/{code}</b> will send shoppers to the shop instead, and its stats are removed. Orders already placed
            keep their discount. To stop it temporarily, pause it instead.
          </p>
          {error && <p className="mt-3 text-[13px] font-bold text-sale">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => dialog.current?.close()} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              className="btn bg-sale text-white hover:bg-[#b8003c]"
              onClick={() =>
                start(async () => {
                  try {
                    if (returnToList) await deleteOfferAndReturnAction(code);
                    else await deleteOfferAction(code);
                    dialog.current?.close();
                  } catch (e) {
                    if (isRedirect(e)) throw e;
                    setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Delete offer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Quick actions on an offer row: edit, pause/resume, duplicate, delete. */
export function OfferRowActions({ code, title, active }: { code: string; title: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        if (isRedirect(e)) throw e;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/offers/${encodeURIComponent(code)}`} className={pill}>
        Edit
      </Link>
      <button type="button" disabled={pending} onClick={() => run(() => setOfferActiveAction(code, !active))} className={pill} aria-label={`${active ? "Pause" : "Resume"} ${title}`}>
        {active ? (
          <>
            <span aria-hidden className="h-2 w-2 rounded-sm bg-[#b45309]" /> Pause
          </>
        ) : (
          <>
            <span aria-hidden className="h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-ok" /> Resume
          </>
        )}
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => duplicateOfferAction(code))} className={pill}>
        Duplicate
      </button>
      <DeleteOfferButton code={code} title={title} />
      {error && (
        <p role="alert" className="w-full text-[12px] font-bold text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
