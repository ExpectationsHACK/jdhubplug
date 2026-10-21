"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { formatNaira, getCategory, grades } from "@/lib/reference";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "../cart/AddToCartButton";
import { Icon } from "../Icon";
import { ProductImage } from "../ProductImage";
import { GradePill } from "../ProductCard";
import { WishlistButton } from "../wishlist/WishlistButton";
import { compareHref } from "./store";

type Row = { label: string; cells: React.ReactNode[]; /** Comparable text; rows without it never count as different. */ raw?: string[] };

/** Side-by-side comparison with a "show only differences" toggle. The URL is the state, so it's shareable. */
export function CompareTable({ products }: { products: Product[] }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const ids = products.map((p) => p.id);

  useEffect(() => {
    track("compare_viewed", { product_ids: ids, category: products[0]?.category, count: ids.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join()]);

  const grade = (p: Product) => grades.find((g) => g.id === p.grade)!;
  const attrKeys = [...new Set(products.flatMap((p) => Object.keys(p.attrs ?? {})))];
  const rows: Row[] = [
    { label: "Price", cells: products.map((p) => <PriceCell key={p.id} p={p} />), raw: products.map((p) => String(p.price)) },
    { label: "Grade", cells: products.map((p) => <GradePill key={p.id} grade={p.grade} />), raw: products.map((p) => p.grade) },
    {
      label: "Condition",
      cells: products.map((p) => (
        <span key={p.id}>
          <b>{grade(p).summary}</b>
          <span className="mt-1 block text-[13px] text-ink-2">{p.category === "cars" ? grade(p).carDetail : grade(p).detail}</span>
        </span>
      )),
      raw: products.map((p) => p.grade),
    },
    { label: "Brand", cells: products.map((p) => p.brand), raw: products.map((p) => p.brand) },
    ...attrKeys.map((k) => ({
      label: k,
      cells: products.map((p) => p.attrs?.[k] || <span key={p.id} className="text-muted">—</span>),
      raw: products.map((p) => (p.attrs?.[k] ?? "").trim().toLowerCase()),
    })),
    { label: "Ships from", cells: products.map((p) => p.state), raw: products.map((p) => p.state) },
    {
      label: "Seller",
      cells: products.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1">
          {p.seller}
          {p.verified && <Icon name="verified" size={15} className="text-accent" label="Verified seller" />}
        </span>
      )),
      raw: products.map((p) => `${p.seller}|${p.verified}`),
    },
    {
      label: "Stock",
      cells: products.map((p) => (
        <span key={p.id} className={`font-bold ${p.stock <= 0 || p.stock === 1 ? "text-sale" : "text-ok"}`}>
          {p.stock <= 0 ? "Sold out" : p.stock === 1 ? "Only 1 left" : `${p.stock} in stock`}
        </span>
      )),
      raw: products.map((p) => (p.stock <= 0 ? "0" : p.stock === 1 ? "1" : "many")),
    },
  ];
  const isDiff = (r: Row) => !!r.raw && new Set(r.raw).size > 1;
  const shown = onlyDiff ? rows.filter(isDiff) : rows;
  const mixed = new Set(products.map((p) => p.category)).size > 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-bold">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-4 w-4 accent-ink" />
          Show only differences
        </label>
        <button type="button" onClick={copy} className="btn btn-outline min-h-9 px-4 py-2 text-[13px]" aria-live="polite">
          {copied ? (
            <>
              <Icon name="check" size={16} /> Link copied
            </>
          ) : (
            "Copy link to share"
          )}
        </button>
      </div>
      {mixed && (
        <p role="note" className="mb-4 rounded-xl bg-stage px-4 py-3 text-[14px] text-ink-2">
          These products are from different categories, so some rows won&apos;t line up.
        </p>
      )}

      <div className="overflow-x-auto rounded-tile border border-line">
        <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-[14px]">
          <caption className="sr-only">Comparison of {products.map((p) => p.name).join(", ")}</caption>
          <colgroup>
            <col className="w-[120px] md:w-[180px]" />
            {products.map((p) => (
              <col key={p.id} />
            ))}
          </colgroup>
          <thead>
            <tr className="align-top">
              <td className="sticky left-0 z-[1] bg-white p-3 text-[12px] text-muted md:p-4">
                {getCategory(products[0].category)?.name ?? ""} · {products.length} items
              </td>
              {products.map((p) => (
                <th key={p.id} scope="col" className="p-3 font-normal md:p-4">
                  <div className="relative">
                    <Link href={`/product/${p.id}`} aria-label={p.name} className="block overflow-hidden rounded-xl bg-stage focus-visible:outline-2 focus-visible:outline-accent">
                      <ProductImage item={p} width={360} className={`aspect-square w-full ${p.stock <= 0 ? "opacity-60 grayscale" : ""}`} artClassName="h-3/4 w-3/4" />
                    </Link>
                    <WishlistButton product={p} className="absolute right-2 top-2 bg-white/90 p-1.5" size={18} />
                  </div>
                  <Link href={`/product/${p.id}`} className="mt-3 block text-[15px] font-bold leading-snug hover:underline">
                    {p.name}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-muted">{p.spec}</p>
                  {products.length > 2 && (
                    <Link href={compareHref(ids.filter((x) => x !== p.id))} className="mt-2 inline-block text-[12px] font-bold text-muted underline-offset-4 hover:text-ink hover:underline" aria-label={`Remove ${p.name} from comparison`}>
                      Remove
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const diff = isDiff(r);
              return (
                <tr key={r.label} className={`border-t border-line align-top ${diff ? "bg-[#fffaf0]" : ""}`}>
                  <th scope="row" className={`sticky left-0 z-[1] p-3 text-[13px] font-bold text-ink-2 md:p-4 ${diff ? "bg-[#fffaf0]" : "bg-white"}`}>
                    {r.label}
                    {diff && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#b45309]">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> Differs
                      </span>
                    )}
                  </th>
                  {r.cells.map((c, i) => (
                    <td key={ids[i]} className="break-words p-3 md:p-4">
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
            {onlyDiff && !shown.length && (
              <tr className="border-t border-line">
                <td colSpan={products.length + 1} className="p-6 text-center text-ink-2">
                  These items match on every detail except the listing itself.
                </td>
              </tr>
            )}
            <tr className="border-t border-line align-top">
              <th scope="row" className="sticky left-0 z-[1] bg-white p-3 text-[13px] font-bold text-ink-2 md:p-4">
                <span className="sr-only">Buy</span>
              </th>
              {products.map((p) => (
                <td key={p.id} className="p-3 md:p-4">
                  {p.stock > 0 ? (
                    <AddToCartButton product={p} className="btn btn-primary w-full px-3" />
                  ) : (
                    <Link href={`/product/${p.id}#notify-me`} className="btn btn-outline w-full px-3">
                      Notify me
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceCell({ p }: { p: Product }) {
  return (
    <span>
      <b className="text-[16px]">{formatNaira(p.price)}</b>
      {p.was && p.was > p.price && <span className="ml-2 text-[12px] text-muted line-through">{formatNaira(p.was)}</span>}
    </span>
  );
}
