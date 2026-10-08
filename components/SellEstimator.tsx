"use client";

import { useState } from "react";
import { estimateOffer, formatNaira, grades, tradeInModels, whatsappLink, type Grade } from "@/lib/catalog";
import { Icon } from "./Icon";

/** Step-by-step instant offer: model → storage → condition → locked cash offer. */
export function SellEstimator({ mode = "sell" }: { mode?: "sell" | "swap" }) {
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [grade, setGrade] = useState<Grade | "">("");
  const storages = Object.keys(tradeInModels.find((m) => m.model === model)?.storage ?? {});
  const offer = model && storage && grade ? estimateOffer(model, storage, grade) : 0;
  const step = !model ? 1 : !storage ? 2 : !grade ? 3 : 4;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Step n={1} title="Choose your device" done={!!model} active={step === 1}>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setStorage("");
            }}
            className="field"
            aria-label="Model"
          >
            <option value="">Select model</option>
            {tradeInModels.map((m) => (
              <option key={m.model}>{m.model}</option>
            ))}
          </select>
        </Step>

        <Step n={2} title="Storage" done={!!storage} active={step === 2}>
          {model ? (
            <div className="grid grid-cols-3 gap-2">
              {storages.map((s) => (
                <button key={s} type="button" aria-pressed={storage === s} onClick={() => setStorage(s)} className="chip text-center font-bold">
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-muted">Choose a model first.</p>
          )}
        </Step>

        <Step n={3} title="Condition" done={!!grade} active={step === 3}>
          <div className="grid gap-2 sm:grid-cols-2">
            {grades.map((g) => (
              <button key={g.id} type="button" aria-pressed={grade === g.id} onClick={() => setGrade(g.id)} className="chip">
                <span className="flex items-center gap-2 font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] text-white">{g.letter}</span>
                  {g.name}
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-muted">{g.detail}</span>
              </button>
            ))}
          </div>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-tile bg-ink p-6 text-white">
          <p className="text-[14px] font-bold text-white/70">{mode === "swap" ? "Your trade-in value" : "Your instant offer"}</p>
          <p className="display mt-2 text-[40px]">{offer ? formatNaira(offer) : "₦ —"}</p>
          <p className="mt-1 text-[13px] text-white/60">
            {offer ? `${model} · ${storage} · ${grades.find((g) => g.id === grade)!.name}` : "Complete the steps to see your offer."}
          </p>
          <ul className="mt-6 space-y-2 border-t border-white/15 pt-5 text-[13px] text-white/80">
            <li className="flex gap-2">
              <Icon name="check" size={18} /> Offer locked for 7 days
            </li>
            <li className="flex gap-2">
              <Icon name="truck" size={18} /> Free pickup or drop at a JDHub hub
            </li>
            <li className="flex gap-2">
              <Icon name="wallet" size={18} /> Paid within 48 hours of inspection
            </li>
          </ul>
          <a
            href={
              offer
                ? whatsappLink(`Hi JDHub, I'd like to ${mode} my ${model} ${storage} (${grade}). Instant offer: ${formatNaira(offer)}.`)
                : undefined
            }
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!offer}
            className={`btn btn-lg mt-6 w-full ${offer ? "btn-white" : "pointer-events-none bg-white/20 text-white/50"}`}
          >
            {mode === "swap" ? "Use as trade-in" : "Lock in this offer"}
          </a>
        </div>
        <p className="mt-3 px-2 text-[12px] text-muted">
          Final offer confirmed after a free inspection. IMEI must be clean and the device signed out of iCloud / Google.
        </p>
      </aside>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  active,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-tile border p-6 transition-colors ${active ? "border-ink" : "border-line"}`}>
      <h3 className="mb-4 flex items-center gap-3 text-[18px] font-bold">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-[13px] ${
            done ? "bg-accent text-white" : active ? "bg-ink text-white" : "bg-stage text-muted"
          }`}
        >
          {done ? <Icon name="check" size={16} strokeWidth={2.5} /> : n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}
