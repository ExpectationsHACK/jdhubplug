"use client";

import { useState } from "react";
import { Icon } from "../Icon";
import { toCartProduct, useCart, type CartProduct } from "./CartProvider";

/**
 * Add-to-cart button. Disabled when sold out or when the cart already holds every
 * unit in stock. Launches the fly-to-cart animation from the nearest product image.
 */
export function AddToCartButton({
  product,
  className = "btn btn-primary w-full",
  label = "Add to cart",
  openCart = false,
  qty = 1,
  onAdded,
  flyFrom,
}: {
  product: CartProduct;
  className?: string;
  label?: string;
  openCart?: boolean;
  /** Units to add per click (clamped to what's left in stock). */
  qty?: number;
  onAdded?: () => void;
  /** Element the fly-to-cart animation starts from, when the button isn't inside a [data-product-card]. */
  flyFrom?: () => Element | null | undefined;
}) {
  const { add, qtyOf, open } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = qtyOf(product.id);
  const soldOut = product.stock <= 0;
  const left = Math.max(0, product.stock - inCart);
  const maxed = !soldOut && left <= 0;
  const units = Math.max(1, Math.min(Math.floor(qty), left || 1));

  return (
    <button
      type="button"
      disabled={soldOut || maxed}
      aria-live="polite"
      onClick={(e) => {
        const card = e.currentTarget.closest("[data-product-card]");
        const from = card?.querySelector("img") ?? card ?? flyFrom?.() ?? e.currentTarget;
        if (add(toCartProduct(product), units, from)) {
          setAdded(true);
          onAdded?.();
          setTimeout(() => setAdded(false), 1400);
          if (openCart) setTimeout(open, 950);
        }
      }}
      className={className}
    >
      {soldOut ? (
        "Sold out"
      ) : maxed ? (
        "All units in cart"
      ) : added ? (
        <>
          <Icon name="check" size={18} strokeWidth={2.25} /> Added
        </>
      ) : (
        label
      )}
    </button>
  );
}
