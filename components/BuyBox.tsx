"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatNaira, grades } from "@/lib/reference";
import { DEFAULT_SETTINGS, waLink } from "@/lib/settings";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "./cart/AddToCartButton";
import { toCartProduct, useCart } from "./cart/CartProvider";
import { Icon, WhatsAppGlyph } from "./Icon";
import { LeadForm } from "./LeadForm";
import { OfferPrice } from "./offers/OfferPrice";
import { GradePill } from "./ProductCard";

// Each listing is one specific graded unit (or a few identical accessories), so there
// are no variant pickers or add-ons: what you see is exactly what ships.

/**
 * Where the fly-to-cart starts: the gallery marked [data-product-hero], else the first
 * large image or illustration on the page (the product photo on a product page).
 */
function heroImage(): Element | null {
  const marked = document.querySelector("[data-product-hero] img") ?? document.querySelector("[data-product-hero]");
  if (marked) return marked;
  const big = (el: Element) => el.getBoundingClientRect().width >= 200;
  return [...document.querySelectorAll("main img, main svg")].find(big) ?? null;
}

export function BuyBox({ item, whatsapp }: { item: Product; whatsapp?: string }) {
  const { add, qtyOf, hydrated } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const isCar = item.category === "cars";
  const grade = grades.find((g) => g.id === item.grade)!;
  const inCart = hydrated ? qtyOf(item.id) : 0;
  const soldOut = item.stock <= 0;
  const left = Math.max(0, item.stock - inCart);
  const units = Math.max(1, Math.min(qty, left || 1));
  const wa = waLink(
    whatsapp ?? DEFAULT_SETTINGS.whatsapp,
    `Hi JDHub, I'm interested in the ${item.name} (${item.spec}, ${grade.name}) listed at ${formatNaira(item.price)}. Ref: ${item.id}. Is it still available?`,
  );
  const low = item.stock > 0 && item.stock <= 2;
  const saving = item.was && item.was > item.price ? item.was - item.price : 0;

  const buyNow = () => {
    if (left > 0) add(toCartProduct(item), units, heroImage() ?? undefined);
    router.push("/checkout");
  };

  return (
    <div>
      <p className="text-[14px] font-bold text-muted">{item.brand}</p>
      <h1 className="display mt-1 text-[28px] md:text-[36px]">{item.name}</h1>
      <p className="mt-1 text-[15px] text-ink-2">{item.spec}</p>
      <p className="mt-2 flex items-center gap-1 text-[14px] text-ink-2">
        <Icon name="star" size={15} className="fill-ink" /> {item.rating} · {item.reviews} reviews
      </p>

      {/* Price + stock */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="display text-[32px]">{formatNaira(item.price)}</p>
          <OfferPrice product={item} className="text-[15px]" />
          {saving > 0 && (
            <p className="text-[14px]">
              <span className="text-muted line-through">{formatNaira(item.was!)}</span>{" "}
              <span className="font-bold text-sale">Save {formatNaira(saving)}</span>
            </p>
          )}
        </div>
        <StockBadge stock={item.stock} />
      </div>

      <div className="mt-6 rounded-tile bg-stage p-5">
        <div className="flex items-center gap-2">
          <GradePill grade={item.grade} />
          <span className="text-[14px] font-bold">{grade.summary}</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{isCar ? grade.carDetail : grade.detail}</p>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-tile border border-line p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-stage">
          <Icon name="store" size={20} />
        </span>
        <div className="flex-1 text-[14px]">
          <p className="flex items-center gap-1 font-bold">
            {item.seller}
            {item.verified && <Icon name="verified" size={16} className="text-accent" label="Verified seller" />}
          </p>
          <p className="text-muted">
            {item.verified ? "ID-verified seller" : "Phone-verified seller"} · Ships from {item.state}
          </p>
        </div>
      </div>

      {/* Purchase */}
      <div className="mt-6 border-t border-line pt-6">
        {soldOut ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled className="btn btn-lg">
                Sold out
              </button>
              <Link href={`/shop/${item.category}`} className="btn btn-outline btn-lg">
                Shop similar
              </Link>
            </div>
            <div className="mt-6 rounded-tile bg-stage p-5">
              <p className="flex items-center gap-2 text-[16px] font-bold">
                <Icon name="mail" size={20} /> Notify me
              </p>
              <p className="mb-4 mt-1 text-[14px] text-ink-2">This unit has been sold. Leave your number and we&apos;ll tell you when a similar one lands.</p>
              <LeadForm
                type="contact"
                details={{ productId: item.id, product: item.name, reason: "notify-restock" }}
                submitLabel="Notify me"
                messageLabel="Preferred storage, colour or budget (optional)"
              />
            </div>
          </div>
        ) : (
          <>
            {item.stock > 1 && (
              <div className="mb-4 flex items-center justify-between gap-4">
                <span id="qty-label" className="text-[14px] font-bold">
                  Quantity
                </span>
                <div role="group" aria-labelledby="qty-label" className="flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={units <= 1}
                    onClick={() => setQty(Math.max(1, units - 1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[20px] hover:bg-stage disabled:opacity-30"
                  >
                    −
                  </button>
                  <output aria-live="polite" className="w-8 text-center text-[15px] font-bold">
                    {units}
                  </output>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={units >= left}
                    onClick={() => setQty(Math.min(left, units + 1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[20px] hover:bg-stage disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <AddToCartButton product={item} qty={units} openCart flyFrom={heroImage} className="btn btn-outline btn-lg" />
              <button type="button" onClick={buyNow} className="btn btn-primary btn-lg">
                Buy now
              </button>
            </div>
            {inCart > 0 && (
              <p className="mt-3 text-center text-[13px] text-muted">
                {inCart} in your cart{left === 0 ? " · that's every unit available" : ""}
              </p>
            )}
          </>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            <WhatsAppGlyph size={18} /> Ask about this item
          </a>
          <Link href="/swap" className="btn btn-outline">
            <Icon name="swap" size={18} /> Swap for this
          </Link>
        </div>

        <ul className="mt-6 space-y-2 text-[13px] text-ink-2">
          <li className="flex items-center gap-2">
            <Icon name="shield" size={18} className="shrink-0" /> Escrow-protected: the seller is paid only after you confirm delivery
          </li>
          <li className="flex items-center gap-2">
            <Icon name="truck" size={18} className="shrink-0" />
            {isCar ? "Inspection drive available at JDHub Auto hubs" : "Delivery in 1–3 days or free hub pickup"}
          </li>
          <li className="flex items-center gap-2">
            <Icon name="scan" size={18} className="shrink-0" /> {isCar ? "VIN history and inspection report included" : "IMEI / serial verified clean"}
          </li>
          {low && (
            <li className="flex items-center gap-2 font-bold text-ink">
              <Icon name="info" size={18} className="shrink-0" /> Graded units are one-offs. Once it&apos;s sold, it&apos;s gone.
            </li>
          )}
        </ul>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 pr-24 backdrop-blur md:hidden">
        <div className="min-w-0">
          <p className="truncate text-[12px] text-muted">{soldOut ? "Sold out" : item.stock === 1 ? "Only 1 left" : `${item.stock} in stock`}</p>
          <p className="text-[18px] font-bold">{formatNaira(item.price)}</p>
        </div>
        {soldOut ? (
          <button type="button" disabled className="btn">
            Sold out
          </button>
        ) : (
          <button type="button" onClick={buyNow} className="btn btn-primary">
            Buy now
          </button>
        )}
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <span className="rounded-full bg-ink px-3 py-1 text-[13px] font-bold text-white">Sold out</span>;
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold ${stock === 1 ? "bg-sale/10 text-sale" : "bg-stage text-ink"}`}>
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${stock === 1 ? "bg-sale" : "bg-ok"}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${stock === 1 ? "bg-sale" : "bg-ok"}`} />
      </span>
      {stock === 1 ? "Only 1 left" : `${stock} in stock`}
    </span>
  );
}
