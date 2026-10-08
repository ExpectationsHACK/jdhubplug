"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatNaira } from "@/lib/catalog";
import { Icon } from "../Icon";
import { ProductImage } from "../ProductImage";
import { useCart } from "./CartProvider";

/** Slide-over cart. Totals are estimates; checkout re-prices on the server. */
export function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal, count, offerCode } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div onClick={close} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-label="Cart"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex h-16 items-center justify-between border-b border-line px-5">
          <p className="text-[18px] font-bold">
            Cart <span className="text-muted">({count})</span>
          </p>
          <button aria-label="Close cart" onClick={close} className="rounded-full p-2 hover:bg-stage">
            <Icon name="close" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stage">
                <Icon name="cart" size={28} />
              </span>
              <p className="mt-4 text-[18px] font-bold">Your cart is empty</p>
              <p className="mt-1 text-[14px] text-ink-2">Graded phones, gadgets and cars are waiting.</p>
              <Link href="/shop" onClick={close} className="btn btn-primary mt-6">
                Start shopping
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map(({ product: p, qty }, i) => (
                <li key={p.id} className="flex gap-4 py-4" style={{ animation: `fade-in .4s ${i * 60}ms both` }}>
                  <Link href={`/product/${p.id}`} onClick={close} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stage">
                    <ProductImage item={p} width={250} className="h-20 w-20" artClassName="h-16 w-16" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${p.id}`} onClick={close} className="line-clamp-1 text-[15px] font-bold hover:underline">
                      {p.name}
                    </Link>
                    <p className="line-clamp-1 text-[12px] text-muted">{p.spec}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-line">
                        <button aria-label="Decrease" onClick={() => setQty(p.id, qty - 1)} className="grid h-8 w-8 place-items-center text-[18px]">
                          −
                        </button>
                        <span className="w-6 text-center text-[14px] font-bold">{qty}</span>
                        <button
                          aria-label="Increase"
                          disabled={qty >= p.stock}
                          onClick={() => setQty(p.id, qty + 1)}
                          className="grid h-8 w-8 place-items-center text-[18px] disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[15px] font-bold">{formatNaira(p.price * qty)}</p>
                    </div>
                    <button onClick={() => remove(p.id)} className="mt-1 text-[12px] text-muted underline underline-offset-2 hover:text-ink">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="border-t border-line p-5">
              {offerCode && (
                <p className="mb-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-[13px] font-bold text-accent">
                  <Icon name="tag" size={16} /> Offer “{offerCode}” will be applied at checkout
                </p>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] text-ink-2">Subtotal</span>
                <span className="text-[22px] font-bold">{formatNaira(subtotal)}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted">Delivery and offers calculated at checkout. Escrow-protected.</p>
              <Link href="/checkout" onClick={close} className="btn btn-primary btn-lg mt-4 w-full">
                Checkout
              </Link>
              <button onClick={close} className="mt-2 w-full py-2 text-[14px] font-bold underline underline-offset-4">
                Continue shopping
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
