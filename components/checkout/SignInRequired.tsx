"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/reference";

/** Shown at checkout when sign-in is required. The cart stays saved on this device. */
export function SignInRequired() {
  const { items, count, subtotal, hydrated } = useCart();

  useEffect(() => {
    if (hydrated && count) track("checkout_signin_required", { items: count, value: subtotal, currency: "NGN" });
  }, [hydrated, count, subtotal]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-[1fr_280px]">
      <div className="rounded-tile border border-line bg-white p-6 sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-stage">
          <Icon name="user" size={24} />
        </span>
        <h2 className="display mt-5 text-[24px]">Sign in to check out</h2>
        <p className="mt-2 text-[15px] text-ink-2">
          Confirm your phone number or email with a one-time code. It takes a few seconds, keeps your order safe and lets you track it any time.
        </p>
        <Link href="/signin?next=/checkout" className="btn btn-primary btn-lg mt-6 w-full sm:w-auto">
          Continue with a one-time code
        </Link>
        <p className="mt-3 text-[12px] text-muted">No password needed. New to JDHub? This creates your account.</p>
      </div>
      {hydrated && items.length > 0 && (
        <aside className="rounded-tile bg-stage p-5">
          <p className="text-[14px] font-bold">Your cart ({count})</p>
          <ul className="mt-3 space-y-3">
            {items.slice(0, 4).map(({ product: p, qty }) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                  <ProductImage item={p} width={120} className="h-12 w-12" artClassName="h-10 w-10" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                  {qty > 1 ? `${qty} × ` : ""}
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between border-t border-line pt-3 text-[14px]">
            <span className="text-ink-2">Subtotal</span>
            <b>{formatNaira(subtotal)}</b>
          </p>
        </aside>
      )}
    </div>
  );
}
