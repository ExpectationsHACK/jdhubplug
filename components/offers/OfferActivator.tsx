"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/Icon";
import { OfferStyles } from "./OfferStyles";

/**
 * Applies an offer to the shopper's cart when its landing page opens (if the offer is
 * live), then confirms with a short toast. Checkout re-checks the offer on the server.
 */
export function OfferActivator({ code, live }: { code: string; live: boolean }) {
  const { setOfferCode } = useCart();
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!live) return;
    setOfferCode(code);
    track("offer_applied", { offer_code: code, source: "landing" });
    const show = setTimeout(() => setToast(true), 600);
    const hide = setTimeout(() => setToast(false), 5600);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [code, live, setOfferCode]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] sm:bottom-6">
      <OfferStyles />
      {toast && (
        <div className="jdo-toast-in pointer-events-auto absolute left-1/2 flex -translate-x-1/2 w-max max-w-[calc(100vw-32px)] items-center gap-3 rounded-full bg-ink py-2.5 pl-3 pr-2 text-[14px] text-white shadow-[0_16px_40px_rgba(0,0,0,.3)]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok">
            <Icon name="check" size={16} strokeWidth={2.25} />
          </span>
          <span className="min-w-0">
            <b>Offer applied</b> <span className="text-white/75">— discount shows at checkout</span>
          </span>
          <button
            type="button"
            onClick={() => setToast(false)}
            aria-label="Dismiss"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
