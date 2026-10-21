"use client";

import { useEffect, useState } from "react";
import { CommerceMotion } from "../checkout/Motion";
import { Icon } from "../Icon";
import { useCart } from "./CartProvider";

/** Header cart icon: target of the fly-to-cart animation, bounces when items land. */
export function CartButton() {
  const { count, open, hydrated } = useCart();
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const onBump = () => setBump((n) => n + 1);
    window.addEventListener("jd:cart-bump", onBump);
    return () => window.removeEventListener("jd:cart-bump", onBump);
  }, []);

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      data-cart-target
      className="relative rounded-full p-2 hover:bg-stage focus-visible:outline-2 focus-visible:outline-accent"
    >
      <CommerceMotion />
      {bump > 0 && (
        <span
          key={`r${bump}`}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 rounded-full bg-accent/25 motion-reduce:hidden"
          style={{ animation: "jdc-burst .7s cubic-bezier(.2,.8,.2,1) both" }}
        />
      )}
      <span key={bump} className={bump ? "cart-bump inline-block" : "inline-block"}>
        <Icon name="cart" />
      </span>
      {hydrated && count > 0 && (
        <span
          key={`n${bump}`}
          className="cart-pop absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
        >
          {count}
        </span>
      )}
    </button>
  );
}
