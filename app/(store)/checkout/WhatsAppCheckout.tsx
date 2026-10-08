"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { ProductImage } from "@/components/ProductImage";
import { formatNaira } from "@/lib/catalog";
import { waLink } from "@/lib/settings";

export function WhatsAppCheckout({ whatsapp, states }: { whatsapp: string; states: string[] }) {
  const { items, subtotal, setQty, remove, hydrated, offerCode } = useCart();
  const [name, setName] = useState("");
  const [state, setState] = useState(states[0]);
  const [delivery, setDelivery] = useState<"delivery" | "pickup">("delivery");

  if (!hydrated) return <div className="mt-8 h-64 animate-pulse rounded-tile bg-stage" />;
  if (!items.length) {
    return (
      <div className="mt-8 rounded-tile bg-stage px-6 py-16 text-center">
        <p className="text-[18px] font-bold">Your cart is empty.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Start shopping
        </Link>
      </div>
    );
  }

  const message = [
    `Hi JDHub, I'd like to order${name ? ` (${name})` : ""}:`,
    ...items.map(({ product: p, qty }) => `• ${qty} × ${p.name} — ${p.spec} — ${formatNaira(p.price * qty)} [${p.id}]`),
    `Subtotal: ${formatNaira(subtotal)}`,
    offerCode ? `Offer code: ${offerCode}` : "",
    `${delivery === "pickup" ? "Pickup at a JDHub hub" : "Delivery"} · ${state}`,
    "I'd like to pay with escrow protection.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
      <ul className="divide-y divide-line rounded-tile border border-line px-5">
        {items.map(({ product: p, qty }) => (
          <li key={p.id} className="flex gap-4 py-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stage">
              <ProductImage item={p} width={250} className="h-20 w-20" artClassName="h-16 w-16" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{p.name}</p>
              <p className="text-[13px] text-muted">{p.spec}</p>
              <div className="mt-2 flex items-center gap-3 text-[14px]">
                <select value={qty} onChange={(e) => setQty(p.id, Number(e.target.value))} className="rounded-full border border-line px-3 py-1" aria-label="Quantity">
                  {Array.from({ length: Math.max(1, p.stock) }, (_, i) => i + 1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <button onClick={() => remove(p.id)} className="text-muted underline underline-offset-2">
                  Remove
                </button>
              </div>
            </div>
            <p className="font-bold">{formatNaira(p.price * qty)}</p>
          </li>
        ))}
      </ul>
      <aside className="space-y-4 md:sticky md:top-24 md:self-start">
        <div className="rounded-tile bg-stage p-5">
          <label className="block text-[14px] font-bold">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" autoComplete="name" />
          </label>
          <label className="mt-3 block text-[14px] font-bold">
            State
            <select value={state} onChange={(e) => setState(e.target.value)} className="field mt-1.5">
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery">
            {(["delivery", "pickup"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={delivery === d} onClick={() => setDelivery(d)} className="chip text-center font-bold">
                {d === "delivery" ? "Delivery" : "Hub pickup"}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-ink-2">Subtotal</span>
            <span className="text-[22px] font-bold">{formatNaira(subtotal)}</span>
          </div>
          <a href={waLink(whatsapp, message)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg mt-4 w-full">
            Send order on WhatsApp
          </a>
          <p className="mt-3 text-[12px] text-muted">Delivery fee confirmed on WhatsApp. Pay into escrow; funds release when you confirm delivery.</p>
        </div>
      </aside>
    </div>
  );
}
