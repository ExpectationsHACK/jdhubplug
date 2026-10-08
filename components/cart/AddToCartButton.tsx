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
}: {
  product: CartProduct;
  className?: string;
  label?: string;
  openCart?: boolean;
}) {
  const { add, qtyOf, open } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = qtyOf(product.id);
  const soldOut = product.stock <= 0;
  const maxed = !soldOut && inCart >= product.stock;

  return (
    <button
      type="button"
      disabled={soldOut || maxed}
      onClick={(e) => {
        const card = e.currentTarget.closest("[data-product-card]");
        const from = card?.querySelector("img") ?? card ?? e.currentTarget;
        if (add(toCartProduct(product), 1, from)) {
          setAdded(true);
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
