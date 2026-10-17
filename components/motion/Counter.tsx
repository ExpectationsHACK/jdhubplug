"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./useMotion";

/**
 * Number that counts up when it scrolls into view. The server renders the final
 * value, so it's correct without JavaScript and for screen readers; the animation
 * only runs when the number starts off-screen.
 */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  duration = 1600,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    const fmt = (n: number) => `${prefix}${Math.round(n).toLocaleString("en-NG")}${suffix}`;
    // Already on screen at hydration: leave the real number alone (no flash).
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;

    el.textContent = fmt(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / duration);
          el.textContent = fmt(value * (1 - Math.pow(1 - k, 4)));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = fmt(value);
    };
  }, [value, prefix, suffix, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${prefix}${value.toLocaleString("en-NG")}${suffix}`}
    </span>
  );
}
