"use client";

import { useEffect, useState } from "react";
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
      className="relative rounded-full p-2 hover:bg-stage"
    >
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
