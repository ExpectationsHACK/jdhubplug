"use client";

import { useCart } from "@/components/cart/CartProvider";
import { offerAppliesTo, offerUnitPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { formatNaira } from "./format";
import { useLiveOffer } from "./useOffer";

/**
 * The offer price for a product when the shopper's active cart offer is live and
 * covers it, e.g. "₦430,000 with SALLAH10". Renders nothing otherwise, so it can sit
 * under any normal price. The server re-prices at checkout; this is only a preview.
 */
export function OfferPrice({
  product,
  className = "",
}: {
  product: Pick<Product, "id" | "category" | "brand" | "price">;
  className?: string;
}) {
  const { offerCode } = useCart();
  const live = useLiveOffer(offerCode);
  if (!live || live.state !== "live" || !offerAppliesTo(live.offer, product)) return null;
  const price = offerUnitPrice(live.offer, product.price);
  if (price >= product.price) return null;
  const min = live.offer.minSubtotal;

  return (
    <p
      className={`inline-flex flex-wrap items-baseline justify-center gap-x-1.5 text-[14px] font-bold text-sale ${className}`}
      title={min ? `On orders of ${formatNaira(min)} or more` : undefined}
    >
      <span>{formatNaira(price)}</span>
      <span className="text-[12px] font-bold uppercase tracking-wide">with {live.offer.code}</span>
    </p>
  );
}
