"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./useMotion";

/**
 * Fallback for browsers without CSS scroll-driven animations: writes the section's
 * scroll progress (0–1) to --p on each animation frame while it's on screen. The
 * `.spot-js` styles in globals.css read it. Does nothing where CSS handles it.
 */
export function SpotlightDriver() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>("[data-spot]");
    if (!section || prefersReducedMotion()) return;
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()")) return;

    section.classList.add("spot-js");
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      section.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      section.classList.remove("spot-js");
    };
  }, []);

  return <span ref={ref} hidden />;
}
