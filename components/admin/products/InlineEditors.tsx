"use client";

import { useRef, useState } from "react";
import { formatNaira } from "@/lib/reference";
import { s } from "./styles";
import { MAX_PRICE, MAX_STOCK, parseWhole } from "./validate";

// Inline price and stock editors used by the product list and the inventory screen.
// They only collect input; the parent applies it optimistically and calls the action.

export function InlinePrice({
  value,
  was,
  label,
  disabled,
  pending,
  onSave,
}: {
  value: number;
  was?: number;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  onSave: (price: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (disabled) {
    return (
      <span className="whitespace-nowrap font-bold">
        {formatNaira(value)}
        {was && <span className="ml-1.5 text-[12px] font-normal text-muted line-through">{formatNaira(was)}</span>}
      </span>
    );
  }

  const start = () => {
    setDraft(value.toLocaleString("en-NG"));
    setError("");
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commit = (fromBlur: boolean) => {
    if (draft === null) return;
    const n = parseWhole(draft);
    if (n === null || n <= 0 || n > MAX_PRICE) {
      if (fromBlur) {
        setDraft(null);
        setError("");
      } else setError("Enter a whole naira amount above ₦0");
      return;
    }
    setDraft(null);
    setError("");
    if (n !== value) onSave(n);
  };

  if (draft !== null) {
    return (
      <span className="relative inline-flex flex-col">
        <span className="flex items-center rounded-lg border border-accent bg-white pl-2 ring-2 ring-accent/25">
          <span aria-hidden className="text-[13px] text-muted">
            ₦
          </span>
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            inputMode="numeric"
            aria-label={`Price for ${label}`}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onBlur={() => commit(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(false);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(null);
                setError("");
              }
            }}
            className="w-[7.5rem] bg-transparent px-1.5 py-1.5 text-[14px] font-bold outline-none"
          />
        </span>
        {error && <span className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-sale px-2 py-1 text-[11px] font-bold text-white">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={`Edit price for ${label}, currently ${formatNaira(value)}`}
      className={`group/price -mx-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-left font-bold transition-colors hover:bg-stage focus-visible:outline-2 focus-visible:outline-accent ${pending ? s.pending : ""}`}
    >
      <span>
        {formatNaira(value)}
        {was && <span className="ml-1.5 text-[12px] font-normal text-muted line-through">{formatNaira(was)}</span>}
      </span>
      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-muted opacity-0 transition-opacity group-hover/price:opacity-100 group-focus-visible/price:opacity-100">
        <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z" />
      </svg>
    </button>
  );
}

export function StockStepper({
  value,
  label,
  disabled,
  pending,
  lowThreshold,
  onAdjust,
  onSet,
  size = "md",
}: {
  value: number;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  lowThreshold: number;
  onAdjust: (delta: number) => void;
  onSet: (units: number) => void;
  size?: "sm" | "md";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const tone = value <= 0 ? "text-sale" : value <= lowThreshold ? "text-[#b45309]" : "text-ink";

  if (disabled) {
    return <span className={`font-bold tabular-nums ${tone}`}>{value}</span>;
  }

  const commit = () => {
    if (draft === null) return;
    const n = parseWhole(draft);
    setDraft(null);
    if (n !== null && n <= MAX_STOCK && n !== value) onSet(n);
  };

  const btn =
    "grid shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-2";
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <span role="group" aria-label={`Stock for ${label}`} className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-white p-0.5 ${pending ? s.pending : ""}`}>
      <button type="button" className={`${btn} ${dim}`} disabled={value <= 0} onClick={() => onAdjust(-1)} aria-label={`Remove one unit of ${label}`}>
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        value={draft ?? String(value)}
        inputMode="numeric"
        type="number"
        min={0}
        max={MAX_STOCK}
        aria-label={`Units in stock for ${label}`}
        onFocus={(e) => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        className={`${s.qty} w-11 bg-transparent text-center text-[14px] font-bold tabular-nums outline-none focus:rounded-md focus:ring-2 focus:ring-accent ${tone}`}
      />
      <button type="button" className={`${btn} ${dim}`} disabled={value >= MAX_STOCK} onClick={() => onAdjust(1)} aria-label={`Add one unit of ${label}`}>
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Marker next to a stock number. "Sold out" is spelled out; low stock is already shown
 * by the amber number, so it's only announced to screen readers to keep lists calm.
 */
export function StockNote({ value, lowThreshold }: { value: number; lowThreshold: number }) {
  if (value <= 0) return <span className="text-[11px] font-bold uppercase tracking-wide text-sale">Sold out</span>;
  if (value <= lowThreshold) return <span className="sr-only">Low stock</span>;
  return null;
}
