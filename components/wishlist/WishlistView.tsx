"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { wishlistProductsAction, type WishlistProduct } from "@/app/(store)/wishlist/actions";
import { productProps, track } from "@/lib/analytics";
import { formatNaira, gradeName } from "@/lib/reference";
import { toCartProduct, useCart } from "../cart/CartProvider";
import { CompareToggle } from "../compare/CompareToggle";
import { Icon } from "../Icon";
import { ProductImage } from "../ProductImage";
import { useWishlist } from "./store";

/** Saved products with live price and stock (fetched fresh from the store). */
export function WishlistView() {
  const { ids, hydrated, remove } = useWishlist();
  const { add, qtyOf } = useCart();
  const key = ids.join(",");
  const [loaded, setLoaded] = useState<{ key: string; items: WishlistProduct[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !key) return;
    let live = true;
    wishlistProductsAction(key.split(","))
      .then((items) => {
        if (live) setLoaded({ key, items });
      })
      .catch(() => {
        if (live) setFailed(key);
      });
    return () => {
      live = false;
    };
  }, [hydrated, key]);

  if (!hydrated || (key && !loaded && failed !== key)) {
    return (
      <div className="mt-8 grid gap-3" aria-busy="true" aria-label="Loading your wishlist">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-tile bg-stage" />
        ))}
      </div>
    );
  }

  if (!ids.length) {
    return (
      <div className="mt-8 rounded-tile bg-stage px-6 py-16 text-center">
        <Icon name="heart" size={40} strokeWidth={1.25} className="mx-auto" />
        <p className="mt-4 text-[18px] font-bold">Nothing saved yet</p>
        <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">Tap the heart on any product to keep an eye on its price and stock.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Start shopping
        </Link>
      </div>
    );
  }

  if (failed === key) {
    return (
      <p role="alert" className="mt-8 rounded-tile bg-stage p-6 text-[15px]">
        We couldn&apos;t load live prices right now. Refresh the page to try again.
      </p>
    );
  }

  // While a changed list loads, keep showing the previous result minus removed items.
  const items = (loaded?.items ?? []).filter((p) => ids.includes(p.id));
  const gone = loaded?.key === key ? ids.filter((id) => !items.some((p) => p.id === id)) : [];

  return (
    <div className="mt-8">
      <p className="mb-4 text-[14px] text-muted" aria-live="polite">
        {items.length} saved {items.length === 1 ? "item" : "items"}
      </p>
      <ul className="grid gap-3">
        {items.map((p) => {
          const soldOut = p.stock <= 0;
          const left = Math.max(0, p.stock - qtyOf(p.id));
          return (
            <li key={p.id} className="flex flex-col gap-4 rounded-tile bg-stage p-4 sm:flex-row sm:items-center sm:p-5">
              <Link href={`/product/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
                <ProductImage item={p} width={240} className={`h-24 w-24 shrink-0 rounded-xl bg-white ${soldOut ? "opacity-60 grayscale" : ""}`} artClassName="h-4/5 w-4/5" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-muted">{p.brand}</p>
                  <p className="truncate text-[16px] font-bold">{p.name}</p>
                  <p className="truncate text-[13px] text-ink-2">
                    {p.spec} · {gradeName(p.grade)}
                  </p>
                  <p className="mt-1 text-[16px] font-bold">
                    {formatNaira(p.price)}
                    {p.was && p.was > p.price && <span className="ml-2 text-[13px] font-normal text-muted line-through">{formatNaira(p.was)}</span>}
                  </p>
                  <p className={`text-[13px] font-bold ${soldOut ? "text-sale" : p.stock === 1 ? "text-sale" : "text-ok"}`}>
                    {soldOut ? "Sold out" : p.stock === 1 ? "Only 1 left" : `${p.stock} in stock`}
                  </p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                {soldOut ? (
                  <Link href={`/product/${p.id}#notify-me`} className="btn btn-outline">
                    <Icon name="mail" size={18} /> Notify me
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={left <= 0}
                    onClick={(e) => {
                      const img = e.currentTarget.closest("li")?.querySelector("img");
                      if (add(toCartProduct(p), 1, img)) {
                        track("product_added_to_cart", { ...productProps(p), quantity: 1, source: "wishlist" });
                        remove(p.id);
                      }
                    }}
                  >
                    {left <= 0 ? "All units in cart" : "Move to cart"}
                  </button>
                )}
                <div className="flex items-center gap-4">
                  <CompareToggle product={p} />
                  <button type="button" onClick={() => remove(p.id)} className="text-[13px] font-bold text-muted underline-offset-4 hover:text-ink hover:underline" aria-label={`Remove ${p.name} from wishlist`}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {gone.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
          {gone.length} saved {gone.length === 1 ? "item is" : "items are"} no longer listed.
          <button type="button" className="font-bold underline underline-offset-4" onClick={() => gone.forEach(remove)}>
            Remove {gone.length === 1 ? "it" : "them"}
          </button>
        </p>
      )}
    </div>
  );
}
