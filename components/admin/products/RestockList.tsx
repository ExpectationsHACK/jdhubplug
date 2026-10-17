"use client";

import Link from "next/link";
import { useState } from "react";
import { adjustStockAction, setStockAction } from "@/app/admin/(panel)/products/actions";
import { ProductImage } from "@/components/ProductImage";
import { formatNaira } from "@/lib/reference";
import { s } from "./styles";
import type { ProductRow } from "./types";
import { useOptimisticRows } from "./useOptimisticRows";
import { MAX_STOCK, parseWhole } from "./validate";

// Low-stock / sold-out list with quick restock buttons (+1, +5, set exact).

export function RestockList({
  rows: serverRows,
  lowStock,
  canStock,
  emptyText,
}: {
  rows: ProductRow[];
  lowStock: number;
  canStock: boolean;
  emptyText: string;
}) {
  const { rows, run, isPending, isFlashing } = useOptimisticRows(serverRows);

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-stage/70 px-4 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ok">
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="text-[13px] text-ink-2">{emptyText}</p>
      </div>
    );
  }

  const add = (p: ProductRow, d: number) => run([p.id], (r) => ({ ...r, stock: Math.max(0, r.stock + d) }), () => adjustStockAction(p.id, d));
  const setTo = (p: ProductRow, n: number) => run([p.id], (r) => ({ ...r, stock: n }), () => setStockAction(p.id, n));

  return (
    // Long lists scroll inside the card so the rest of the page stays reachable.
    <ul className="-mr-2 max-h-[460px] divide-y divide-line overflow-y-auto pr-2">
      {rows.map((p) => (
        <li key={p.id} className={`flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap ${isFlashing(p.id) ? s.flash : ""}`}>
          <Link href={`/admin/products/${p.id}`} className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
            <span className="shrink-0 overflow-hidden rounded-xl bg-stage">
              <ProductImage item={p} width={120} className="h-11 w-11" artClassName="h-9 w-9" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold hover:underline">{p.name}</span>
              <span className="block truncate text-[12px] text-muted">
                {formatNaira(p.price)} · {p.sold} sold{p.status !== "active" ? ` · ${p.status}` : ""}
              </span>
            </span>
          </Link>
          <span className={`w-10 shrink-0 text-center text-[18px] max-sm:ml-auto font-bold tabular-nums ${p.stock <= 0 ? "text-sale" : p.stock <= lowStock ? "text-[#b45309]" : "text-ok"} ${isPending(p.id) ? s.pending : ""}`} aria-label={`${p.stock} in stock`}>
            {p.stock}
          </span>
          {canStock && <Restock name={p.name} disabled={isPending(p.id)} onAdd={(d) => add(p, d)} onSet={(n) => setTo(p, n)} />}
        </li>
      ))}
    </ul>
  );
}

function Restock({ name, disabled, onAdd, onSet }: { name: string; disabled: boolean; onAdd: (d: number) => void; onSet: (n: number) => void }) {
  const [exact, setExact] = useState("");
  const n = parseWhole(exact);
  const valid = n !== null && n <= MAX_STOCK;
  const pill = "h-8 shrink-0 rounded-full border border-line px-3 text-[13px] font-bold transition-colors hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <form
      className="flex shrink-0 items-center gap-1.5"
      aria-label={`Restock ${name}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) {
          onSet(n!);
          setExact("");
        }
      }}
    >
      <button type="button" className={pill} onClick={() => onAdd(1)} aria-label={`Add 1 unit of ${name}`}>
        +1
      </button>
      <button type="button" className={pill} onClick={() => onAdd(5)} aria-label={`Add 5 units of ${name}`}>
        +5
      </button>
      <span className="flex items-center rounded-full border border-line bg-white pl-1">
        <input
          value={exact}
          onChange={(e) => setExact(e.target.value)}
          inputMode="numeric"
          placeholder="Set"
          aria-label={`Set exact stock for ${name}`}
          className={`${s.qty} w-12 bg-transparent px-2 text-center text-[13px] outline-none`}
        />
        <button type="submit" disabled={!valid || disabled} className="h-8 rounded-full bg-ink px-3 text-[12px] font-bold text-white disabled:bg-line disabled:text-muted">
          Set
        </button>
      </span>
    </form>
  );
}
