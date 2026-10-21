"use client";

import { useRef, type HTMLAttributes } from "react";
import { prefersReducedMotion } from "./useMotion";

/**
 * 3D tilt with a glare highlight that follows the pointer (mouse only). The element
 * gets CSS variables --rx/--ry (rotation) and --gx/--gy (glare position); the `.tilt`
 * styles in globals.css turn them into transforms, so nothing here triggers layout.
 * Touch devices and reduced-motion visitors get the plain element.
 */
export function Tilt({
  max = 7,
  className = "",
  children,
  ...rest
}: { max?: number } & HTMLAttributes<HTMLDivElement> & { [data: `data-${string}`]: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.dataset.tilting = "";
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    delete el.dataset.tilting;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`tilt ${className}`} {...rest}>
      {children}
      <span aria-hidden className="tilt-glare" />
    </div>
  );
}
