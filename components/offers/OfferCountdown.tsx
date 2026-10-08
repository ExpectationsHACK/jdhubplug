"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNow } from "./useOffer";

/** One flip-clock digit. The old value folds down over the new one when it changes. */
function FlipDigit({ value }: { value: string }) {
  // Track the previous value during render (React's "adjust state on prop change").
  const [s, setS] = useState({ cur: value, prev: value, n: 0 });
  if (s.cur !== value) setS({ cur: value, prev: s.cur, n: s.n + 1 });

  return (
    <span className="jdo-digit" aria-hidden>
      <span className="jdo-half jdo-top">
        <span>{s.cur}</span>
      </span>
      <span className="jdo-half jdo-bottom">
        <span>{s.n ? s.prev : s.cur}</span>
      </span>
      {s.n > 0 && (
        <span key={`t${s.n}`} className="jdo-half jdo-top jdo-flap-top">
          <span>{s.prev}</span>
        </span>
      )}
      {s.n > 0 && (
        <span key={`b${s.n}`} className="jdo-half jdo-bottom jdo-flap-bottom">
          <span>{s.cur}</span>
        </span>
      )}
    </span>
  );
}

function Unit({ value, label, digits = 2 }: { value: number | null; label: string; digits?: number }) {
  const text = value === null ? "-".repeat(digits) : String(value).padStart(digits, "0");
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-[0.08em] rounded-[0.2em] text-[34px] font-extrabold leading-none tabular-nums shadow-[0_12px_30px_rgba(0,0,0,.35)] sm:text-[48px] display">
        {text.split("").map((d, i) => (
          <FlipDigit key={i} value={d} />
        ))}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{label}</span>
    </div>
  );
}

/**
 * Big live countdown to an offer's end (or start, when scheduled), with flip-clock
 * digits. Refreshes the page when it hits zero so the offer state updates.
 */
export function OfferCountdown({ startsAt, endsAt, scheduled }: { startsAt: string; endsAt: string; scheduled: boolean }) {
  const now = useNow(1000);
  const router = useRouter();
  const refreshed = useRef(false);
  const target = Date.parse(scheduled ? startsAt : endsAt);
  const left = now === null ? null : Math.max(0, target - now);

  useEffect(() => {
    if (left === 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [left, router]);

  const total = left === null ? null : Math.floor(left / 1000);
  const d = total === null ? null : Math.floor(total / 86400);
  const h = total === null ? null : Math.floor((total % 86400) / 3600);
  const m = total === null ? null : Math.floor((total % 3600) / 60);
  const sec = total === null ? null : total % 60;
  const label = scheduled ? "Starts in" : "Ends in";
  const spoken = total === null ? label : `${label} ${d} days, ${h} hours, ${m} minutes`;

  return (
    <div role="timer" aria-label={spoken}>
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-white/70">{label}</p>
      <div className="flex items-start gap-2 sm:gap-4">
        <Unit value={d} label="Days" digits={d !== null && d > 99 ? 3 : 2} />
        <span aria-hidden className="display pt-1 text-[30px] font-extrabold text-white/40 sm:text-[42px]">:</span>
        <Unit value={h} label="Hours" />
        <span aria-hidden className="display pt-1 text-[30px] font-extrabold text-white/40 sm:text-[42px]">:</span>
        <Unit value={m} label="Mins" />
        <span aria-hidden className="display pt-1 text-[30px] font-extrabold text-white/40 sm:text-[42px]">:</span>
        <Unit value={sec} label="Secs" />
      </div>
    </div>
  );
}
