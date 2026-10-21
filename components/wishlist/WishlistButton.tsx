"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { Icon } from "../Icon";
import { useWishlist } from "./store";

type Saveable = Pick<Product, "id" | "name" | "brand" | "category" | "price" | "grade">;

/** Heart toggle (aria-pressed) that saves a product to the wishlist. */
export function WishlistButton({ product, className = "", size = 20, withLabel = false }: { product: Saveable; className?: string; size?: number; withLabel?: boolean }) {
  const { has, toggle, hydrated } = useWishlist();
  const saved = hydrated && has(product.id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      title={saved ? "Saved to wishlist" : "Save to wishlist"}
      onClick={() => toggle(product)}
      className={`inline-flex items-center gap-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent ${saved ? "text-sale" : "text-muted hover:text-ink"} ${className}`}
    >
      <Icon name="heart" size={size} className={`transition-transform motion-safe:active:scale-90 ${saved ? "fill-current" : ""}`} />
      {withLabel && <span className="text-[14px] font-bold text-ink">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

/** Header link to /wishlist with a count. */
export function WishlistHeaderButton() {
  const { count, hydrated } = useWishlist();
  const n = hydrated ? count : 0;
  return (
    <Link href="/wishlist" aria-label={`Wishlist, ${n} item${n === 1 ? "" : "s"}`} className="icon-btn relative rounded-full p-2 hover:bg-stage">
      <Icon name="heart" />
      {n > 0 && (
        <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{n > 99 ? "99+" : n}</span>
      )}
    </Link>
  );
}
