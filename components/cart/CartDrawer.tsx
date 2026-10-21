"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatNaira } from "@/lib/reference";
import { FreeDeliveryMeter } from "../checkout/FreeDeliveryMeter";
import { CommerceMotion } from "../checkout/Motion";
import { lineProblemText } from "../checkout/shared";
import { useCheckoutPreview } from "../checkout/usePreview";
import { Icon } from "../Icon";
import { ProductImage } from "../ProductImage";
import { useCart } from "./CartProvider";

/**
 * Slide-over cart. While open it asks the server for a live price check, so sold-out
 * items are flagged, offer discounts show, and the free-delivery meter is accurate.
 */
export function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal, count, offerCode } = useCart();
  const [leaving, setLeaving] = useState<string[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  const lines = useMemo(() => items.map((i) => ({ productId: i.product.id, qty: i.qty })), [items]);
  const { preview, loading } = useCheckoutPreview(isOpen ? { items: lines, offerCode, delivery: "delivery", state: "Lagos" } : null, 120);
  const byId = new Map(preview?.lines.map((l) => [l.productId, l]));
  const problems = preview?.lines.filter((l) => l.problem).length ?? 0;
  const itemsTotal = preview ? preview.subtotal - preview.discount : subtotal;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [isOpen, close]);

  const removeAnimated = (id: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return remove(id);
    setLeaving((l) => [...l, id]);
    setTimeout(() => {
      remove(id);
      setLeaving((l) => l.filter((x) => x !== id));
    }, 480);
  };

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} inert={!isOpen}>
      <CommerceMotion />
      <div onClick={close} className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full shadow-none"
        }`}
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <p className="text-[18px] font-bold">
            Cart <span className="text-muted">({count})</span>
          </p>
          <button ref={closeRef} aria-label="Close cart" onClick={close} className="rounded-full p-2 hover:bg-stage focus-visible:outline-2 focus-visible:outline-accent">
            <Icon name="close" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div key={isOpen ? "o" : "c"} className="jdc-in-up">
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
            {problems > 0 && (
              <p role="alert" className="jdc-in-up mx-5 mt-4 flex items-start gap-2 rounded-xl bg-sale/10 p-3 text-[13px] font-bold text-sale">
                <Icon name="alert" size={18} className="shrink-0" />
                {problems === 1 ? "An item in your cart just sold out or changed." : `${problems} items in your cart just sold out or changed.`}
              </p>
            )}
            {/* Re-keyed on open so the stagger replays each time the drawer slides in. */}
            <ul key={isOpen ? "open" : "closed"} className="flex-1 overflow-y-auto px-5">
              {items.map(({ product: p, qty }, i) => {
                const l = byId.get(p.id);
                const gone = leaving.includes(p.id);
                return (
                  <li key={p.id} className="jdc-collapse border-b border-line last:border-0" data-leaving={gone}>
                    <div>
                      <div className="jdc-in-right flex gap-4 py-4" style={{ animationDelay: `${120 + i * 70}ms` }}>
                        <Link
                          href={`/product/${p.id}`}
                          onClick={close}
                          className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stage transition ${l?.problem ? "opacity-50 grayscale" : ""}`}
                        >
                          <ProductImage item={p} width={250} className="h-20 w-20" artClassName="h-16 w-16" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/product/${p.id}`} onClick={close} className="line-clamp-1 text-[15px] font-bold hover:underline">
                            {p.name}
                          </Link>
                          <p className="line-clamp-1 text-[12px] text-muted">{p.spec}</p>
                          {l?.problem && (
                            <p className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-sale px-2 py-0.5 text-[11px] font-bold text-white">{lineProblemText(l)}</span>
                              {l.problem === "insufficient" && (
                                <button onClick={() => setQty(p.id, l.available)} className="text-[12px] font-bold underline underline-offset-2">
                                  Reduce to {l.available}
                                </button>
                              )}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {l?.problem && l.problem !== "insufficient" ? (
                              <button onClick={() => removeAnimated(p.id)} className="btn btn-outline min-h-8 px-4 py-1.5 text-[13px]">
                                Remove
                              </button>
                            ) : (
                              <div className="flex items-center rounded-full border border-line">
                                <button
                                  aria-label={qty <= 1 ? `Remove ${p.name}` : `Decrease ${p.name} quantity`}
                                  onClick={() => (qty <= 1 ? removeAnimated(p.id) : setQty(p.id, qty - 1))}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] hover:bg-stage"
                                >
                                  −
                                </button>
                                <span className="w-6 text-center text-[14px] font-bold" aria-label={`Quantity ${qty}`}>
                                  {qty}
                                </span>
                                <button
                                  aria-label={`Increase ${p.name} quantity`}
                                  disabled={qty >= (l ? l.available : p.stock)}
                                  onClick={() => setQty(p.id, qty + 1)}
                                  className="grid h-8 w-8 place-items-center rounded-full text-[18px] hover:bg-stage disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            )}
                            <div className="text-right">
                              <p className={`text-[15px] font-bold ${l?.problem ? "text-muted line-through" : ""}`}>
                                {formatNaira(l && !l.problem ? l.lineTotal : p.price * qty)}
                              </p>
                              {l?.offerApplied && <p className="text-[12px] text-muted line-through">{formatNaira(l.unitPrice * l.qty)}</p>}
                            </div>
                          </div>
                          {!(l?.problem && l.problem !== "insufficient") && (
                            <button
                              onClick={() => removeAnimated(p.id)}
                              className="mt-1 text-[12px] text-muted underline underline-offset-2 hover:text-ink"
                              aria-label={`Remove ${p.name}`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <footer className="shrink-0 border-t border-line p-5">
              {preview?.offer ? (
                <p className="jdc-pop mb-3 flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2 text-[13px] font-bold text-accent">
                  <span className="flex items-center gap-2">
                    <Icon name="tag" size={16} /> {preview.offer.code.toUpperCase()} · {preview.offer.label}
                  </span>
                  {preview.discount > 0 && <span>−{formatNaira(preview.discount)}</span>}
                </p>
              ) : (
                offerCode && (
                  <p className="mb-3 flex items-center gap-2 rounded-xl bg-stage px-3 py-2 text-[13px] text-ink-2">
                    <Icon name="tag" size={16} />
                    <span>
                      Code “{offerCode.toUpperCase()}”{preview?.offerMessage ? `: ${preview.offerMessage}` : " will be checked at checkout."}
                    </span>
                  </p>
                )
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] text-ink-2">Subtotal</span>
                <span className={`text-[22px] font-bold transition-opacity ${loading ? "opacity-50" : ""}`} aria-live="polite">
                  {formatNaira(itemsTotal)}
                </span>
              </div>
              {preview && preview.subtotal > 0 && <FreeDeliveryMeter subtotal={preview.subtotal} threshold={preview.freeDeliveryOver} className="mt-3" />}
              <p className="mt-2 text-[12px] text-muted">Delivery calculated at checkout. Escrow-protected.</p>
              <Link href="/checkout" onClick={close} className="btn btn-primary btn-lg mt-4 w-full">
                Checkout <Icon name="arrowRight" size={18} />
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
