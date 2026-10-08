"use client";

import { useRef } from "react";
import { prefersReducedMotion } from "./useMotion";

/**
 * Pulls its child a few pixels toward the pointer while hovered, then springs back.
 * Wrap a button or link; keyboard and touch users get the plain control.
 */
export function Magnetic({
  children,
  strength = 0.3,
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength;
    el.style.transition = "transform 0.15s ease-out";
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.6s cubic-bezier(.2,1.6,.4,1)";
    el.style.transform = "";
  };

  return (
    <span ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`inline-block ${className}`}>
      {children}
    </span>
  );
}
