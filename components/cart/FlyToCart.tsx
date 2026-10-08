"use client";

import { useEffect } from "react";

// The "fly to cart" animation: a snapshot of the product image arcs from where the
// shopper clicked into the header cart, spinning and shrinking, then the cart bumps.

export function FlyToCart() {
  useEffect(() => {
    const onFly = (e: Event) => {
      const { rect } = (e as CustomEvent<{ rect: DOMRect; imageSrc?: string }>).detail;
      const target = document.querySelector("[data-cart-target]");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!target || reduce || !rect.width) {
        window.dispatchEvent(new CustomEvent("jd:cart-bump"));
        return;
      }
      const t = target.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height, 220);
      const startX = rect.left + rect.width / 2 - size / 2;
      const startY = rect.top + rect.height / 2 - size / 2;
      const dx = t.left + t.width / 2 - (startX + size / 2);
      const dy = t.top + t.height / 2 - (startY + size / 2);

      // Find an image inside the source rect to clone, else use a glowing orb.
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const img = el instanceof HTMLImageElement ? el : el?.closest("[data-product-card]")?.querySelector("img");
      const ghost = document.createElement("div");
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${startX}px`,
        top: `${startY}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "24px",
        zIndex: "9999",
        pointerEvents: "none",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(26,92,255,.35)",
        background: img ? `center/cover no-repeat url("${img.currentSrc || img.src}")` : "radial-gradient(circle,#1a5cff,#0b2a8a)",
      } satisfies Partial<CSSStyleDeclaration>);
      document.body.appendChild(ghost);

      const lift = Math.min(-120, dy * 0.4 - 140);
      const anim = ghost.animate(
        [
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, borderRadius: "24px" },
          { transform: `translate(${dx * 0.35}px, ${lift}px) scale(0.75) rotate(-12deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx * 0.8}px, ${dy * 0.6}px) scale(0.35) rotate(200deg)`, opacity: 0.95, offset: 0.75 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(360deg)`, opacity: 0.4, borderRadius: "50%" },
        ],
        { duration: 900, easing: "cubic-bezier(.5,-0.1,.4,1)" },
      );
      anim.onfinish = () => {
        ghost.remove();
        window.dispatchEvent(new CustomEvent("jd:cart-bump"));
      };
    };
    window.addEventListener("jd:fly", onFly);
    return () => window.removeEventListener("jd:fly", onFly);
  }, []);
  return null;
}
