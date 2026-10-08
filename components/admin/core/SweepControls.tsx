"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { refreshStorefrontAction, sweepNowAction, type SweepState } from "@/app/admin/actions";
import { AdminIcon } from "./icons";

/**
 * Shown at the top of the dashboard. The page sweeps expired orders while rendering, but
 * cache tags can only be refreshed from an action, so when stock was released this asks
 * the server to refresh the storefront once. Always rendered in the same spot so the
 * message survives the re-render that refresh causes.
 */
export function SweepNotice({ released }: { released: number }) {
  const [count] = useState(released);
  const [refreshed, setRefreshed] = useState(false);
  const [, start] = useTransition();
  const fired = useRef(false);

  useEffect(() => {
    if (count <= 0 || fired.current) return;
    fired.current = true;
    start(async () => {
      await refreshStorefrontAction().catch(() => undefined);
      setRefreshed(true);
    });
  }, [count]);

  if (count <= 0) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-[#cfe0ff] bg-[#f3f7ff] px-4 py-3 text-[13px] text-accent-deep">
      <AdminIcon name="refresh" size={18} className="mt-0.5 shrink-0" />
      <p>
        <b>
          Released stock from {count} expired unpaid order{count === 1 ? "" : "s"}.
        </b>{" "}
        Their reservation window ran out, so the items are back on sale{refreshed ? " and the storefront is up to date." : "."}
      </p>
    </div>
  );
}

/** "Run clean-up now" button for the cron row of the health card. */
export function SweepButton() {
  const [state, action, pending] = useActionState<SweepState>(sweepNowAction, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-bold outline-none transition-colors hover:border-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        <AdminIcon name="refresh" size={13} className={pending ? "motion-safe:animate-spin" : ""} />
        {pending ? "Running…" : "Run clean-up now"}
      </button>
      <span aria-live="polite" className="text-[12px] text-muted">
        {state.error
          ? state.error
          : state.released !== undefined && (state.released ? `Released ${state.released} expired order${state.released === 1 ? "" : "s"}.` : "Nothing to release.")}
      </span>
    </form>
  );
}
