"use client";

import { useEffect } from "react";

// The "fly to cart" animation. A snapshot of the product lifts off, arcs across the
// screen along a curved path while spinning and shrinking, leaves a glowing comet
// trail, and lands in the header cart with a ring burst and sparks. Then the cart
// bumps ("jd:cart-bump"). Reduced motion skips straight to the bump.

const ACCENT = "26,92,255";
const SPARK_COLORS = ["#1a5cff", "#000000", "#e5004b", "#f5b400", "#25d366"];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t;

function el(style: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("div");
  Object.assign(d.style, { position: "fixed", left: "0px", top: "0px", pointerEvents: "none", zIndex: "9999" }, style);
  document.body.appendChild(d);
  return d;
}

/** Ring burst and radiating sparks where the product lands. */
function landingBurst(x: number, y: number) {
  const ring = el({
    width: "56px",
    height: "56px",
    marginLeft: "-28px",
    marginTop: "-28px",
    borderRadius: "50%",
    border: `2px solid rgb(${ACCENT})`,
    transform: `translate(${x}px, ${y}px) scale(.3)`,
  });
  ring.animate(
    [
      { transform: `translate(${x}px, ${y}px) scale(.3)`, opacity: 1 },
      { transform: `translate(${x}px, ${y}px) scale(1.6)`, opacity: 0 },
    ],
    { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" },
  ).onfinish = () => ring.remove();

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const r = 26 + Math.random() * 22;
    const s = el({
      width: "6px",
      height: "6px",
      marginLeft: "-3px",
      marginTop: "-3px",
      borderRadius: "50%",
      background: SPARK_COLORS[i % SPARK_COLORS.length],
    });
    s.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * r}px, ${y + Math.sin(a) * r}px) scale(.2)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 200, easing: "cubic-bezier(.2,.8,.2,1)" },
    ).onfinish = () => s.remove();
  }
}

export function FlyToCart() {
  useEffect(() => {
    const bump = () => window.dispatchEvent(new CustomEvent("jd:cart-bump"));

    const onFly = (e: Event) => {
      const { rect, imageSrc } = (e as CustomEvent<{ rect: DOMRect; imageSrc?: string }>).detail;
      const target = document.querySelector("[data-cart-target]");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t = target?.getBoundingClientRect();
      if (!t || !t.width || reduce || !rect.width) return bump();

      const size = Math.max(56, Math.min(rect.width, rect.height, 200));
      const x0 = rect.left + rect.width / 2;
      const y0 = rect.top + rect.height / 2;
      const x2 = t.left + t.width / 2;
      const y2 = t.top + t.height / 2;
      // Control point: above both ends so the flight arcs up and over.
      const x1 = x0 + (x2 - x0) * 0.35;
      const y1 = Math.min(y0, y2) - Math.max(140, Math.abs(x2 - x0) * 0.25);

      // Snapshot: the product photo if there is one, else a clone of the illustration.
      const stack = document.elementsFromPoint(x0, y0);
      const hit = stack.find((n) => n instanceof HTMLImageElement || n.closest("svg")) ?? stack[0];
      const card = hit?.closest("[data-product-card]");
      const img = hit instanceof HTMLImageElement ? hit : (card?.querySelector("img") ?? null);
      const src = imageSrc || (img ? img.currentSrc || img.src : "");
      const ghost = el({
        width: `${size}px`,
        height: `${size}px`,
        marginLeft: `${-size / 2}px`,
        marginTop: `${-size / 2}px`,
        borderRadius: "24px",
        overflow: "hidden",
        background: src ? `#f4f4f4 center/cover no-repeat url("${src.replace(/"/g, "%22")}")` : "#f4f4f4",
        boxShadow: `0 18px 50px rgba(${ACCENT},.35), 0 0 0 1px rgba(0,0,0,.04)`,
        willChange: "transform, opacity",
        transform: `translate(${x0}px, ${y0}px)`,
      });
      if (!src) {
        const art = (hit?.closest("svg") ?? card?.querySelector("svg")) as SVGElement | null;
        if (art) {
          const clone = art.cloneNode(true) as SVGElement;
          clone.setAttribute("width", "80%");
          clone.setAttribute("height", "80%");
          Object.assign(clone.style, { position: "absolute", inset: "10%" });
          ghost.appendChild(clone);
        } else {
          ghost.style.background = `radial-gradient(circle at 35% 30%, #5b8cff, rgb(${ACCENT}) 45%, #0b2a8a)`;
        }
      }

      const duration = 950;
      const start = performance.now();
      let frame = 0;

      const step = (now: number) => {
        const raw = Math.min(1, (now - start) / duration);
        const p = easeInOut(raw);
        const u = 1 - p;
        const x = u * u * x0 + 2 * u * p * x1 + p * p * x2;
        const y = u * u * y0 + 2 * u * p * y1 + p * p * y2;
        // Lift off (a quick swell), then shrink into the cart.
        const lift = raw < 0.12 ? 1 + (raw / 0.12) * 0.08 : 1.08 - easeIn((raw - 0.12) / 0.88) * 0.98;
        const spin = easeIn(raw) * 540;
        const radius = 24 + raw * 76;
        ghost.style.transform = `translate(${x}px, ${y}px) scale(${Math.max(0.1, lift)}) rotate(${spin}deg)`;
        ghost.style.borderRadius = `${Math.min(50, radius)}%`;
        ghost.style.opacity = String(raw > 0.85 ? 1 - (raw - 0.85) / 0.15 : 1);

        // Comet trail: glowing dots that fade behind the product.
        if (raw > 0.06 && raw < 0.96 && frame++ % 2 === 0) {
          const d = 6 + (1 - raw) * 12;
          const dot = el({
            width: `${d}px`,
            height: `${d}px`,
            marginLeft: `${-d / 2}px`,
            marginTop: `${-d / 2}px`,
            borderRadius: "50%",
            background: `rgba(${ACCENT},.9)`,
            boxShadow: `0 0 ${d * 1.6}px rgba(${ACCENT},.8)`,
            transform: `translate(${x}px, ${y}px)`,
          });
          dot.animate(
            [
              { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 0.85 },
              { transform: `translate(${x}px, ${y + 8}px) scale(0)`, opacity: 0 },
            ],
            { duration: 520, easing: "ease-out" },
          ).onfinish = () => dot.remove();
        }

        if (raw < 1) requestAnimationFrame(step);
        else {
          ghost.remove();
          landingBurst(x2, y2);
          bump();
        }
      };
      requestAnimationFrame(step);
    };

    window.addEventListener("jd:fly", onFly);
    return () => window.removeEventListener("jd:fly", onFly);
  }, []);
  return null;
}
