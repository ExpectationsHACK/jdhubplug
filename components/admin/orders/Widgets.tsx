"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addOrderNoteAction, refreshAfterSweepAction, type OrderActionState } from "@/app/admin/(panel)/orders/actions";
import { inputCls } from "../ui";
import { timeLeft } from "./format";

// Small client pieces used by the order screens.

/** Copies an absolute link (built from the current origin + `path`) to the clipboard. */
export function CopyLinkButton({ path, label = "Copy customer link", className = "btn btn-outline" }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      // Clipboard can be blocked (insecure origin, permissions): let the admin copy by hand.
      window.prompt("Copy this link", url);
      setCopied("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  return (
    <button type="button" onClick={copy} className={className}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {copied === "ok" ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M9 9h10v10H9zM5 15V5h10" />}
      </svg>
      <span aria-live="polite">{copied === "ok" ? "Link copied" : label}</span>
    </button>
  );
}

/** Opens the print dialog; with `auto`, also opens it once on load. */
export function PrintButton({ auto = false, label = "Print" }: { auto?: boolean; label?: string }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary">
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z" />
      </svg>
      {label}
    </button>
  );
}

/**
 * Live "time left" until a reservation deadline. The first render uses the server's
 * clock (`now`) so hydration matches; afterwards it ticks every 30 seconds.
 */
export function TimeLeft({ until, now, className = "" }: { until: string; now: number; className?: string }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const tick = () => setT(Date.now());
    const first = setTimeout(tick, 0);
    const i = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(i);
    };
  }, []);
  const left = timeLeft(until, t);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold ${left.urgent ? "text-sale" : "text-[#b45309]"} ${className}`}
      title={`Reserved until ${new Date(until).toLocaleString("en-NG")}`}
    >
      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      {left.label}
    </span>
  );
}

/** Internal note composer for the order timeline. */
export function NoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<OrderActionState, FormData>(addOrderNoteAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="order-note" className="sr-only">
        Internal note
      </label>
      <textarea
        id="order-note"
        name="note"
        rows={3}
        maxLength={1000}
        required
        placeholder="Add an internal note (only staff see this)…"
        className={`${inputCls} resize-y`}
      />
      <div className="flex items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-[13px]">
          {state.error ? <span className="font-bold text-sale">{state.error}</span> : state.ok ? <span className="font-bold text-ok">{state.message}</span> : null}
        </p>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}

/** After the list page swept expired reservations, refresh the storefront caches once. */
export function SweepRefresher({ released }: { released: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (!released || done.current) return;
    done.current = true;
    refreshAfterSweepAction().catch(() => undefined);
  }, [released]);
  return null;
}
