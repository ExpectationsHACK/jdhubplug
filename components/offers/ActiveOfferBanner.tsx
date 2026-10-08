"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { describeDiscount } from "@/lib/pricing";
import { OfferStyles } from "./OfferStyles";
import { shortDuration } from "./format";
import { useLiveOffer, useNow } from "./useOffer";

/**
 * Slim banner shown while the shopper carries a live offer (picked up from a special
 * link). Renders nothing when no offer is set or the offer isn't live. Place it inside
 * <CartProvider>, e.g. directly under the store header.
 */
export function ActiveOfferBanner({ className = "" }: { className?: string }) {
  const { offerCode, setOfferCode } = useCart();
  const live = useLiveOffer(offerCode);
  const now = useNow(60_000);

  if (!offerCode || !live || live.state !== "live" || now === null) return null;
  const { offer } = live;
  const left = Date.parse(offer.endsAt) - now;

  return (
    <div role="region" aria-label="Active offer" className={`jdo-banner-in relative z-30 overflow-hidden bg-ink text-white ${className}`}>
      <OfferStyles />
      <div className="wrap flex min-h-10 items-center justify-center gap-3 py-2 text-[13px]">
        <span aria-hidden className="jdo-sparkle hidden h-2 w-2 shrink-0 rotate-45 bg-white sm:block" />
        <Link href={`/offer/${encodeURIComponent(offer.code)}`} className="min-w-0 truncate text-center hover:underline">
          <b>{offer.title}:</b> {describeDiscount(offer)}<span className="hidden sm:inline"> on eligible items</span>
          <span className="text-white/70"> · ends in {shortDuration(left)}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOfferCode(null)}
          className="shrink-0 rounded-full border border-white/40 px-2.5 py-0.5 text-[12px] font-bold transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Remove offer ${offer.title}`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
