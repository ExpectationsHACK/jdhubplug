"use client";

import { useState } from "react";
import { estimateOffer, formatNaira, grades, listings, tradeInModels, whatsappLink, type Grade } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { GradePill } from "./ProductCard";
import { Icon } from "./Icon";

const targets = listings.filter((l) => l.category === "phones" || l.category === "gadgets");

/** Swap-matching: value the trade-in, suggest upgrades, show the top-up. */
export function SwapPlanner() {
  const [model, setModel] = useState("iPhone 13");
  const [storage, setStorage] = useState("128GB");
  const [grade, setGrade] = useState<Grade>("great");
  const [target, setTarget] = useState<string>("iphone-14-1");

  const storages = Object.keys(tradeInModels.find((m) => m.model === model)?.storage ?? {});
  const value = estimateOffer(model, storage, grade);
  const pick = targets.find((t) => t.id === target)!;
  const topUp = Math.max(0, pick.price - value);
  // One pick per model, cheapest unit first, so the row isn't five copies of the same phone.
  const suggestions = [...targets]
    .filter((t) => t.price > value && t.name !== model)
    .sort((a, b) => a.price - b.price)
    .filter((t, i, all) => all.findIndex((x) => x.model === t.model) === i)
    .slice(0, 12);

  return (
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <div className="rounded-tile border border-line p-6">
          <p className="text-[14px] font-bold text-muted">You give</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              aria-label="Your model"
              value={model}
              onChange={(e) => {
                const m = e.target.value;
                setModel(m);
                setStorage(Object.keys(tradeInModels.find((x) => x.model === m)!.storage)[0]);
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
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {grades.map((g) => (
              <button key={g.id} type="button" aria-pressed={grade === g.id} onClick={() => setGrade(g.id)} className="chip text-center text-[13px] font-bold">
                {g.name}
              </button>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-muted">Trade-in value</p>
          <p className="display text-[32px]">{formatNaira(value)}</p>
        </div>

        <div className="grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-white">
            <Icon name="swap" size={26} />
          </span>
        </div>

        <div className="flex items-center gap-4 rounded-tile bg-stage p-6">
          <ProductImage item={pick} width={320} className="h-32 w-32 shrink-0 rounded-xl" artClassName="h-32 w-32" />
          <div>
            <p className="text-[14px] font-bold text-muted">You get</p>
            <p className="mt-1 text-[20px] font-bold">{pick.name}</p>
            <p className="text-[13px] text-muted">{pick.spec}</p>
            <div className="mt-2">
              <GradePill grade={pick.grade} />
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
        <a
          href={whatsappLink(
            `Hi JDHub, I'd like to swap my ${model} ${storage} (${grade}) for the ${pick.name} and pay ${formatNaira(topUp)} difference.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-white btn-lg mt-8"
        >
          Start this swap
        </a>
        <p className="mt-4 text-[12px] text-white/50">Trade-in value confirmed at inspection. Top-up paid into escrow.</p>
      </div>

      <div>
        <h2 className="display text-[24px] md:text-[32px]">Swap picks for your {model}</h2>
        <p className="mt-2 text-[15px] text-ink-2">Sorted by the smallest top-up.</p>
        <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={target === s.id}
              onClick={() => setTarget(s.id)}
              className={`w-60 shrink-0 rounded-tile bg-stage p-5 text-left ring-accent transition ${target === s.id ? "ring-2" : "hover:bg-[#ececec]"}`}
            >
              <ProductImage item={s} width={320} className="aspect-square w-full rounded-xl" artClassName="h-28 w-28" />
              <p className="mt-3 text-[15px] font-bold">{s.name}</p>
              <p className="text-[12px] text-muted">{s.spec}</p>
              <p className="mt-3 text-[13px]">
                + <span className="font-bold">{formatNaira(s.price - value)}</span> top-up
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
