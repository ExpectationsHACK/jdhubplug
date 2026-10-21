"use client";

import { useEffect, useState, useTransition } from "react";
import { payNow } from "@/app/(store)/order/[id]/actions";
import { Icon } from "../Icon";
import { PLACED_KEY } from "./placed";

// Small interactive pieces of the order page. The page itself is a server component.

/** "Pay within 23h 12m 05s to keep your items." Ticks every second on the client. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const end = Date.parse(until);
  if (now === null) return <span className="jdc-skeleton inline-block h-5 w-56 rounded align-middle" aria-hidden />;
  const left = Math.max(0, end - now);
  if (left === 0) {
    return (
      <span className="font-bold text-sale">
        Your reservation has expired. The items may have been released; message us if you&apos;ve already paid.
      </span>
    );
  }
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span>
      Pay within{" "}
      <span className="font-bold tabular-nums" role="timer" aria-live="off">
        {h > 0 ? `${h}h ` : ""}
        {pad(m)}m {pad(s)}s
      </span>{" "}
      to keep your items.
    </span>
  );
}

/** Copy a value (account number, amount, reference) with a short confirmation. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-bold hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <>
          <Icon name="check" size={14} strokeWidth={2.25} /> Copied
        </>
      ) : (
        "Copy"
      )}
    </button>
  );
}

/** Re-open Paystack for a pending order. */
export function PayNowButton({ id, token, total }: { id: string; token: string; total: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await payNow(id, token).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
            if (res.ok) window.location.assign(res.url);
            else setError(res.error);
          })
        }
        className="btn btn-primary btn-lg w-full sm:w-auto"
      >
        {pending ? "Opening Paystack…" : `Pay ${total} now`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-bold text-sale">
          {error}
        </p>
      )}
    </div>
  );
}

const COLORS = ["#000000", "#1a5cff", "#e5004b", "#f5b400", "#25d366", "#9aa4b2", "#0b2a8a"];

/**
 * The order's check-mark badge. Right after checkout (flag set by the checkout form)
 * it also plays a one-time ring burst, sparks and a confetti shower.
 */
export function Celebration({ orderId }: { orderId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(PLACED_KEY) === orderId;
      if (flagged) sessionStorage.removeItem(PLACED_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!flagged || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const on = setTimeout(() => setShow(true), 0);
    const off = setTimeout(() => setShow(false), 5200);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [orderId]);

  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center">
      {show && (
        <>
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-40 w-40 rounded-full border-2 border-accent"
            style={{ animation: "jdc-burst 1s cubic-bezier(.2,.8,.2,1) .1s both" }}
          />
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute left-1/2 top-1/2 h-3 w-1 rounded-full"
              style={{
                background: COLORS[i % COLORS.length],
                ["--a" as string]: `${i * 30}deg`,
                ["--r" as string]: "58px",
                animation: "jdc-spark .8s cubic-bezier(.2,.8,.2,1) .15s both",
              }}
            />
          ))}
          <Confetti />
        </>
      )}
      <span className={`relative grid h-16 w-16 place-items-center rounded-full bg-ink text-white ${show ? "jdc-pop" : ""}`}>
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={show ? "jdc-check" : ""}
          style={{ ["--len" as string]: 22 }}
          aria-hidden
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  );
}

function Confetti() {
  return (
    <span aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: 90 }, (_, i) => {
        // Deterministic spread so every piece differs without Math.random in render.
        const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
        const w = 6 + r(1) * 8;
        const round = r(5) > 0.7;
        return (
          <span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${r(2) * 100}%`,
              width: w,
              height: round ? w : w * 0.45,
              background: COLORS[i % COLORS.length],
              borderRadius: round ? "50%" : 2,
              ["--dx" as string]: `${(r(3) - 0.5) * 260}px`,
              ["--rot" as string]: `${360 + r(4) * 900}deg`,
              animation: `jdc-fall ${2.4 + r(6) * 2.2}s cubic-bezier(.25,.6,.4,1) ${r(7) * 0.9}s both`,
            }}
          />
        );
      })}
    </span>
  );
}
