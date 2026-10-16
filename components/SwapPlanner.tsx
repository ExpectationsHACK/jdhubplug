"use client";

import Link from "next/link";
import { useState } from "react";
import { estimateOffer, formatNaira, grades, tradeInModels, type Grade } from "@/lib/reference";
import { DEFAULT_SETTINGS, waLink } from "@/lib/settings";
import type { Product } from "@/lib/types";
import { tradeInImage } from "./checkout/tradein";
import { Icon, WhatsAppGlyph } from "./Icon";
import { LeadForm } from "./LeadForm";
import { GradePill } from "./ProductCard";
import { ProductImage } from "./ProductImage";

export type SwapProduct = Pick<
  Product,
  "id" | "model" | "name" | "spec" | "price" | "grade" | "stock" | "status" | "photo" | "imageUrl" | "art" | "tint" | "category"
>;

/**
 * Swap-matching: value the trade-in, suggest upgrades from live stock, show the top-up.
 * `products` should be in-stock phones and gadgets from the live catalog (full
 * Product objects work too).
 */
export function SwapPlanner({ products, whatsapp }: { products: SwapProduct[]; whatsapp?: string }) {
  const targets = products.filter((p) => p.stock > 0 && p.status === "active");
  const [model, setModel] = useState("iPhone 13");
  const [storage, setStorage] = useState("128GB");
  const [grade, setGrade] = useState<Grade>("great");
  const [target, setTarget] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const storages = Object.keys(tradeInModels.find((m) => m.model === model)?.storage ?? {});
  const value = estimateOffer(model, storage, grade);
  // One pick per model, cheapest unit first, so the row isn't five copies of the same phone.
  const suggestions = [...targets]
    .filter((t) => t.price > value && t.name !== model)
    .sort((a, b) => a.price - b.price)
    .filter((t, i, all) => all.findIndex((x) => x.model === t.model) === i)
    .slice(0, 12);
  const pick = targets.find((t) => t.id === target) ?? suggestions[0] ?? targets[0];

  if (!pick) {
    return (
      <div className="rounded-tile bg-stage p-10 text-center">
        <p className="display text-[24px]">New swap stock lands every week.</p>
        <p className="mt-2 text-ink-2">Tell us what you have and what you want, and we&apos;ll match you.</p>
        <div className="mx-auto mt-6 max-w-lg text-left">
          <LeadForm type="swap" submitLabel="Find me a swap" messageLabel="What do you have, and what do you want?" />
        </div>
      </div>
    );
  }

  const topUp = Math.max(0, pick.price - value);
  const gradeName = grades.find((g) => g.id === grade)!.name;
  const wa = waLink(
    whatsapp ?? DEFAULT_SETTINGS.whatsapp,
    `Hi JDHub, I'd like to swap my ${model} ${storage} (${gradeName}) for the ${pick.name} (${pick.spec}, ref ${pick.id}) and pay the ${formatNaira(topUp)} difference.`,
  );

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <div className="rounded-tile border border-line p-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[14px] font-bold text-muted">You give</p>
            <div key={model} className="fade-in h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stage">
              <ProductImage item={tradeInImage(model)} width={250} className="h-16 w-16" artClassName="h-12 w-12" />
            </div>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <select
              aria-label="Your model"
              value={model}
              onChange={(e) => {
                const m = e.target.value;
                setModel(m);
                setStorage(Object.keys(tradeInModels.find((x) => x.model === m)!.storage)[0]);
                setStarting(false);
              }}
              className="field"
            >
              {tradeInModels.map((m) => (
                <option key={m.model}>{m.model}</option>
              ))}
            </select>
            <select aria-label="Storage" value={storage} onChange={(e) => setStorage(e.target.value)} className="field">
              {storages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div role="group" aria-label="Condition" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {grades.map((g) => (
              <button key={g.id} type="button" aria-pressed={grade === g.id} onClick={() => setGrade(g.id)} className="chip text-center text-[13px] font-bold">
                {g.name}
              </button>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-muted">Trade-in value</p>
          <p key={value} className="display fade-in text-[32px]" aria-live="polite">
            {formatNaira(value)}
          </p>
        </div>

        <div className="grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-white">
            <Icon name="swap" size={26} />
          </span>
        </div>

        <div className="flex items-center gap-4 rounded-tile bg-stage p-6">
          <div key={pick.id} className="fade-in h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-white">
            <ProductImage item={pick} width={330} className="h-32 w-32" artClassName="h-28 w-28" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-muted">You get</p>
            <Link href={`/product/${pick.id}`} className="mt-1 block text-[20px] font-bold hover:underline">
              {pick.name}
            </Link>
            <p className="text-[13px] text-muted">{pick.spec}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <GradePill grade={pick.grade} />
              {pick.stock === 1 && <span className="text-[12px] font-bold text-sale">Only 1 left</span>}
            </div>
            <p className="mt-3 text-[15px]">{formatNaira(pick.price)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-tile bg-ink p-8 text-center text-white md:p-12">
        <p className="text-[16px] text-white/75">
          Your {model} + <span className="font-bold text-white">{formatNaira(topUp)}</span> gets you
        </p>
        <p className="display mt-2 text-[30px] md:text-[44px]">{pick.name}</p>
        {starting ? (
          <div className="fade-in mx-auto mt-8 max-w-lg text-left">
            <LeadForm
              type="swap"
              dark
              details={{
                tradeIn: `${model} ${storage}`,
                tradeInGrade: gradeName,
                tradeInValue: String(value),
                productId: pick.id,
                product: pick.name,
                topUp: String(topUp),
              }}
              submitLabel="Start my swap"
              messageLabel="Pickup area or questions (optional)"
              successTitle="Swap request received."
              successBody="We'll reserve your pick and call or WhatsApp you to book the inspection."
            />
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-white mt-3 w-full">
              <WhatsAppGlyph size={18} /> Or continue on WhatsApp
            </a>
          </div>
        ) : (
          <button type="button" onClick={() => setStarting(true)} className="btn btn-white btn-lg mt-8">
            Start this swap
          </button>
        )}
        <p className="mt-4 text-[12px] text-white/50">Trade-in value confirmed at inspection. Top-up paid into escrow.</p>
      </div>

      {suggestions.length > 0 && (
        <div>
          <h2 className="display text-[24px] md:text-[32px]">Swap picks for your {model}</h2>
          <p className="mt-2 text-[15px] text-ink-2">In stock now, sorted by the smallest top-up.</p>
          <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={pick.id === s.id}
                onClick={() => {
                  setTarget(s.id);
                  setStarting(false);
                }}
                className={`w-60 shrink-0 rounded-tile bg-stage p-5 text-left ring-accent transition hover:-translate-y-0.5 motion-reduce:transform-none ${pick.id === s.id ? "ring-2" : "hover:bg-[#ececec]"}`}
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-white">
                  <ProductImage item={s} width={330} className="aspect-square w-full" artClassName="h-28 w-28" />
                </div>
                <p className="mt-3 text-[15px] font-bold">{s.name}</p>
                <p className="text-[12px] text-muted">{s.spec}</p>
                <p className="mt-3 text-[13px]">
                  + <span className="font-bold">{formatNaira(s.price - value)}</span> top-up
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
