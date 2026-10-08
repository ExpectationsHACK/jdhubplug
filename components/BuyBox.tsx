"use client";

import { useState } from "react";
import { formatNaira, grades, whatsappLink, type Listing } from "@/lib/catalog";
import { GradePill } from "./ProductCard";
import { Icon } from "./Icon";

export function BuyBox({ item }: { item: Listing }) {
  const [opts, setOpts] = useState<Record<string, string>>(
    Object.fromEntries((item.options ?? []).map((o) => [o.label, o.values[0]])),
  );
  const [protect, setProtect] = useState(false);
  const isCar = item.category === "cars";
  // Higher storage/memory tiers add a step to the price; colour never does.
  const priced = (label: string) => !isCar && (label === "Storage" || label === "Memory");
  const step = (item.options ?? []).reduce((sum, o) => sum + (priced(o.label) ? o.values.indexOf(opts[o.label]) * 65000 : 0), 0);
  const protection = isCar ? 0 : Math.round((item.price * 0.06) / 500) * 500;
  const total = item.price + step + (protect ? protection : 0);
  const grade = grades.find((g) => g.id === item.grade)!;
  const summary = [item.name, ...Object.values(opts)].join(", ");

  return (
    <div>
      <p className="text-[14px] font-bold text-muted">{item.brand}</p>
      <h1 className="display mt-1 text-[28px] md:text-[36px]">{item.name}</h1>
      <p className="mt-2 flex items-center gap-1 text-[14px] text-ink-2">
        <Icon name="star" size={15} className="fill-ink" /> {item.rating} · {item.reviews} reviews
      </p>

      <div className="mt-6 rounded-tile bg-stage p-5">
        <div className="flex items-center gap-2">
          <GradePill grade={item.grade} />
          <span className="text-[14px] font-bold">{grade.summary}</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{isCar ? grade.carDetail : grade.detail}</p>
      </div>

      {(item.options ?? []).map((o) => (
        <fieldset key={o.label} className="mt-8">
          <legend className="mb-3 text-[16px] font-bold">{o.label}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {o.values.map((v, k) => (
              <button
                key={v}
                type="button"
                aria-pressed={opts[o.label] === v}
                onClick={() => setOpts((s) => ({ ...s, [o.label]: v }))}
                className="chip"
              >
                <span className="block font-bold">{v}</span>
                {priced(o.label) && k > 0 && <span className="text-[12px] text-muted">+{formatNaira(k * 65000)}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {!isCar && (
        <fieldset className="mt-8">
          <legend className="mb-3 text-[16px] font-bold">JDHub Care</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={!protect} onClick={() => setProtect(false)} className="chip">
              <span className="block font-bold">90-day warranty</span>
              <span className="text-[12px] text-muted">Included</span>
            </button>
            <button type="button" aria-pressed={protect} onClick={() => setProtect(true)} className="chip">
              <span className="block font-bold">12-month Care+</span>
              <span className="text-[12px] text-muted">+{formatNaira(protection)} · screen & battery cover</span>
            </button>
          </div>
        </fieldset>
      )}

      <div className="mt-8 flex items-center gap-3 rounded-tile border border-line p-4">
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

      {/* Summary */}
      <div className="mt-8 border-t border-line pt-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-muted">Total</p>
            <p className="text-[28px] font-bold">{formatNaira(total)}</p>
            {item.was && <p className="text-[13px] text-muted line-through">{formatNaira(item.was + step)}</p>}
          </div>
          <p className="max-w-[55%] text-right text-[12px] text-muted">{summary}</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a href="/swap" className="btn btn-outline btn-lg">
            <Icon name="swap" size={18} /> Swap for this
          </a>
          <a
            href={whatsappLink(`Hi JDHub, I'd like to buy: ${summary} (${formatNaira(total)}) with escrow protection.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg"
          >
            Buy now
          </a>
        </div>
        <ul className="mt-5 space-y-2 text-[13px] text-ink-2">
          <li className="flex items-center gap-2">
            <Icon name="shield" size={18} /> Escrow-protected: pay now, funds release when you confirm delivery
          </li>
          <li className="flex items-center gap-2">
            <Icon name="truck" size={18} /> {isCar ? "Inspection drive available at JDHub Auto hubs" : "Delivery in 1–3 days or free hub pickup"}
          </li>
          <li className="flex items-center gap-2">
            <Icon name="scan" size={18} /> {isCar ? "VIN history and inspection report included" : "IMEI / serial verified clean"}
          </li>
        </ul>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-line bg-white px-4 py-3 pr-24 md:hidden">
        <div>
          <p className="text-[12px] text-muted">Total</p>
          <p className="text-[18px] font-bold">{formatNaira(total)}</p>
        </div>
        <a
          href={whatsappLink(`Hi JDHub, I'd like to buy: ${summary} (${formatNaira(total)}) with escrow protection.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Buy now
        </a>
      </div>
    </div>
  );
}
