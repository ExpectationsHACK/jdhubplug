"use client";

import Link from "next/link";
import { useActionState, useEffect, useId } from "react";
import { subscribeStockAlert, type StockAlertState } from "@/app/(store)/stock-alert-actions";
import { productProps, track } from "@/lib/analytics";
import type { Product } from "@/lib/types";
import { Icon } from "../Icon";
import { useAccount } from "../wishlist/store";

/**
 * "Notify me when it's back" for sold-out products. Alerts are per model: any unit of
 * the same model coming back counts, unless the shopper ticks "only this listing".
 */
export function StockAlertForm({ item }: { item: Pick<Product, "id" | "name" | "brand" | "category" | "price" | "grade" | "spec" | "model"> }) {
  const [state, action, pending] = useActionState<StockAlertState, FormData>(subscribeStockAlert, {});
  const account = useAccount();
  const id = useId();

  useEffect(() => {
    if (state.ok) track("stock_alert_requested", { ...productProps(item), duplicate: !!state.duplicate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div id="notify-me" className="scroll-mt-28 rounded-tile bg-stage p-5">
      <p className="flex items-center gap-2 text-[16px] font-bold">
        <Icon name="mail" size={20} /> Notify me when it&apos;s back
      </p>
      {state.ok ? (
        <div role="status" className="fade-in mt-3 flex items-start gap-3 rounded-xl bg-white p-4">
          <Icon name="checkCircle" size={24} className="shrink-0 text-ok" />
          <div className="text-[14px]">
            <p className="font-bold">{state.duplicate ? "You're already on the list." : "You're on the list."}</p>
            <p className="text-ink-2">We&apos;ll message {state.display} once when a {item.name} is back in stock.</p>
            {!!state.inStockNow && (
              <p className="mt-2">
                <Link href={`/shop/${item.category}?q=${encodeURIComponent(item.name)}`} className="link-cta">
                  {state.inStockNow} other {state.inStockNow === 1 ? "unit is" : "units are"} available now <Icon name="chevronRight" size={14} />
                </Link>
              </p>
            )}
          </div>
        </div>
      ) : (
        <form action={action} className="mt-3 space-y-3" noValidate>
          <p className="text-[14px] text-ink-2">Graded units are one-offs. Leave your email or phone and we&apos;ll tell you when another {item.name} lands.</p>
          <input type="hidden" name="productId" value={item.id} />
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div>
            <label htmlFor={`${id}-contact`} className="mb-1.5 block text-[13px] font-bold">
              Email or phone number
            </label>
            <input
              key={account?.contact ?? "anon"}
              id={`${id}-contact`}
              name="contact"
              required
              inputMode="email"
              autoComplete="email"
              defaultValue={state.contact ?? account?.contact ?? ""}
              placeholder="you@example.com or 0803 123 4567"
              aria-invalid={!!state.error}
              aria-describedby={state.error ? `${id}-err` : undefined}
              className="field"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[14px]">
            <input type="checkbox" name="exact" value="1" className="mt-0.5 h-4 w-4 accent-ink" />
            <span>
              Only this exact listing <span className="text-muted">({item.spec})</span>
            </span>
          </label>
          {state.error && (
            <p key={state.n} id={`${id}-err`} role="alert" className="fade-in text-[14px] font-bold text-sale">
              {state.error}
            </p>
          )}
          <button className="btn btn-primary btn-lg w-full" disabled={pending}>
            {pending ? "Saving…" : "Notify me"}
          </button>
          <p className="text-[12px] text-muted">One message when it&apos;s back. No marketing.</p>
        </form>
      )}
    </div>
  );
}
