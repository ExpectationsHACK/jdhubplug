"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge as Pill, EmptyState, inputCls, relTime, type Tone } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { adjustStockAction, bulkProductsAction, setStockAction, updatePriceAction } from "@/app/admin/(panel)/products/actions";
import { formatNaira } from "@/lib/reference";
import type { Badge, ProductStatus } from "@/lib/types";
import { Dialog } from "./Dialog";
import { InlinePrice, StockNote, StockStepper } from "./InlineEditors";
import { s } from "./styles";
import { useToast } from "./Toasts";
import type { BulkOp, ProductRow } from "./types";
import { useOptimisticRows } from "./useOptimisticRows";
import { EMPTY_FILTERS, toQuery, type Filters, type SortKey, SORTS } from "./filters";
import { BADGES, CATEGORY_LABEL, CATEGORY_OPTIONS, GRADE_LABEL, GRADE_OPTIONS, MAX_STOCK, roundTo500, stockState } from "./validate";

// The products list: search, filters, sort, pagination, inline price/stock edits and
// bulk actions. Filters live in the URL so views can be bookmarked and linked to
// (e.g. /admin/products?stock=low).

const PAGE_SIZE = 50;

const STATUS_TONE: Record<ProductStatus, Tone> = { active: "green", draft: "amber", archived: "neutral" };
const STATUS_LABEL: Record<ProductStatus, string> = { active: "Active", draft: "Draft", archived: "Archived" };

const compare: Record<SortKey, (a: ProductRow, b: ProductRow) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  "price-desc": (a, b) => b.price - a.price,
  "price-asc": (a, b) => a.price - b.price,
  "stock-asc": (a, b) => a.stock - b.stock,
  "stock-desc": (a, b) => b.stock - a.stock,
  sold: (a, b) => b.sold - a.sold || b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name, "en"),
};

type Chip = { key: string; label: string; count: number; active: boolean; apply: Partial<Filters> };

export function ProductsTable({
  products,
  lowStock,
  canEdit,
  canStock,
  initial,
  now,
  notice,
}: {
  products: ProductRow[];
  lowStock: number;
  canEdit: boolean;
  canStock: boolean;
  initial: Filters;
  now: number;
  notice?: string;
}) {
  const { rows, run, isPending, isFlashing } = useOptimisticRows(products);
  const [f, setF] = useState<Filters>(initial);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<null | "price" | "stock" | "delete">(null);
  const [percent, setPercent] = useState("10");
  const [bulkStock, setBulkStock] = useState("1");
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const headCheck = useRef<HTMLInputElement>(null);
  const noticeSeen = useRef<number | null>(null);
  const canSelect = canEdit || canStock;

  // One-off notices passed in the URL (e.g. after deleting a product).
  useEffect(() => {
    if (notice && noticeSeen.current !== now) {
      noticeSeen.current = now;
      toast.push(notice);
    }
  }, [notice, now, toast]);

  // Keep the URL in sync with the view without a navigation.
  useEffect(() => {
    const url = `${window.location.pathname}${toQuery(f)}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [f]);

  // "/" focuses search, like most admin tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const update = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, page: 1, ...patch }));
    setSelected(new Set());
  };

  const haystack = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of rows) m.set(p.id, `${p.name} ${p.brand} ${p.id} ${p.spec} ${p.model} ${p.seller}`.toLowerCase());
    return m;
  }, [rows]);

  const brands = useMemo(() => [...new Set(rows.map((p) => p.brand))].sort((a, b) => a.localeCompare(b)), [rows]);

  const counts = useMemo(() => {
    const c = { all: rows.length, active: 0, draft: 0, archived: 0, low: 0, out: 0 };
    for (const p of rows) {
      c[p.status]++;
      if (p.status === "archived") continue;
      const st = stockState(p.stock, lowStock, p.category);
      if (st === "low") c.low++;
      if (st === "out") c.out++;
    }
    return c;
  }, [rows, lowStock]);

  const filtered = useMemo(() => {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter(
      (p) =>
        (!f.status || p.status === f.status) &&
        (!f.category || p.category === f.category) &&
        (!f.brand || p.brand === f.brand) &&
        (!f.grade || p.grade === f.grade) &&
        (!f.stock || (stockState(p.stock, lowStock, p.category) === f.stock && (f.status === "archived" || p.status !== "archived"))) &&
        terms.every((t) => haystack.get(p.id)!.includes(t)),
    );
    return out.sort(compare[f.sort] ?? compare.newest);
  }, [rows, f, haystack, lowStock]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPage = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const someOnPage = visible.some((p) => selected.has(p.id));

  useEffect(() => {
    if (headCheck.current) headCheck.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  const chips: Chip[] = [
    { key: "all", label: "All", count: counts.all, active: !f.status && !f.stock, apply: { status: "", stock: "" } },
    { key: "active", label: "Active", count: counts.active, active: f.status === "active" && !f.stock, apply: { status: "active", stock: "" } },
    { key: "draft", label: "Draft", count: counts.draft, active: f.status === "draft" && !f.stock, apply: { status: "draft", stock: "" } },
    { key: "archived", label: "Archived", count: counts.archived, active: f.status === "archived" && !f.stock, apply: { status: "archived", stock: "" } },
    { key: "low", label: "Low stock", count: counts.low, active: f.stock === "low" && !f.status, apply: { status: "", stock: "low" } },
    { key: "out", label: "Sold out", count: counts.out, active: f.stock === "out" && !f.status, apply: { status: "", stock: "out" } },
  ];

  const hasFilters = !!(f.q || f.status || f.stock || f.category || f.brand || f.grade);

  // ------------------------------------------------------------ mutations

  const savePrice = (p: ProductRow, price: number) =>
    run([p.id], (r) => ({ ...r, price, was: r.was && r.was > price ? r.was : undefined }), () => updatePriceAction(p.id, price));

  const adjust = (p: ProductRow, delta: number) =>
    run([p.id], (r) => ({ ...r, stock: Math.max(0, r.stock + delta) }), () => adjustStockAction(p.id, delta), { quiet: true });

  const setUnits = (p: ProductRow, units: number) => run([p.id], (r) => ({ ...r, stock: units }), () => setStockAction(p.id, units), { quiet: true });

  const selectedRows = rows.filter((p) => selected.has(p.id));

  const bulk = (op: BulkOp) => {
    const ids = [...selected];
    if (!ids.length) return;
    const patch = (r: ProductRow): ProductRow | null => {
      switch (op.type) {
        case "status":
          return { ...r, status: op.status };
        case "featured":
          return { ...r, featured: op.featured };
        case "badge":
          return { ...r, badge: op.badge ?? undefined };
        case "price": {
          const price = roundTo500(r.price * (1 + op.percent / 100));
          return { ...r, price, was: r.was && r.was > price ? r.was : undefined };
        }
        case "stock":
          return { ...r, stock: op.units };
        case "delete":
          return null;
      }
    };
    setDialog(null);
    run(ids, patch, () => bulkProductsAction(ids, op), {
      onDone: (ok) => {
        if (ok && op.type === "delete") setSelected(new Set());
      },
    });
  };

  const pct = Number(percent);
  const pctValid = Number.isFinite(pct) && pct !== 0 && pct >= -90 && pct <= 200 && percent.trim() !== "";
  const stockN = Number(bulkStock);
  const stockValid = /^\d+$/.test(bulkStock.trim()) && stockN <= MAX_STOCK;

  // ------------------------------------------------------------ render

  return (
    <div className={selected.size ? "pb-28" : ""}>
      {/* Saved views */}
      <div role="tablist" aria-label="Product views" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {chips.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={c.active}
            onClick={() => update(c.apply)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              c.active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-ink"
            }`}
          >
            {c.label}
            <span
              className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                c.active ? "bg-white/20" : c.key === "out" && c.count ? "bg-[#fde8ef] text-sale" : c.key === "low" && c.count ? "bg-[#fff4e0] text-[#b45309]" : "bg-stage text-muted"
              }`}
            >
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 rounded-2xl border border-line bg-white p-3">
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search name, brand, id or spec"
            className={`${inputCls} pl-10 md:pr-10`}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted md:block">/</kbd>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterPill label="Category" value={f.category} onChange={(v) => update({ category: v as Filters["category"] })} options={CATEGORY_OPTIONS.map((c) => [c.value, c.label] as [string, string])} />
          <FilterPill label="Brand" value={f.brand} onChange={(v) => update({ brand: v })} options={brands.map((b) => [b, b] as [string, string])} />
          <FilterPill label="Grade" value={f.grade} onChange={(v) => update({ grade: v as Filters["grade"] })} options={GRADE_OPTIONS.map((g) => [g.value, g.label] as [string, string])} />
          <FilterPill
            label="Stock"
            value={f.stock}
            onChange={(v) => update({ stock: v as Filters["stock"] })}
            options={[
              ["in", "In stock"],
              ["low", `Low (≤ ${lowStock})`],
              ["out", "Sold out"],
            ]}
          />
          <FilterPill
            label="Status"
            value={f.status}
            onChange={(v) => update({ status: v as Filters["status"] })}
            options={[
              ["active", "Active"],
              ["draft", "Draft"],
              ["archived", "Archived"],
            ]}
          />
          {hasFilters && (
            <button type="button" onClick={() => update({ ...EMPTY_FILTERS, sort: f.sort })} className="px-2 text-[13px] font-bold text-ink underline underline-offset-4">
              Clear all
            </button>
          )}
          <span className="ml-auto flex items-center gap-3">
            <span aria-live="polite" className="hidden text-[13px] text-muted sm:inline">
              {filtered.length === rows.length ? `${rows.length} products` : `${filtered.length} of ${rows.length}`}
            </span>
            <FilterPill
              label="Sort"
              value={f.sort}
              always
              onChange={(v) => setF((prev) => ({ ...prev, sort: v as SortKey, page: 1 }))}
              options={SORTS.map((o) => [o.value, o.label] as [string, string])}
            />
          </span>
        </div>
      </div>

      {/* Select-all banner */}
      {canSelect && allOnPage && filtered.length > visible.length && (
        <div className="mb-3 rounded-xl bg-[#eef3ff] px-4 py-2.5 text-[13px] text-accent-deep">
          {selected.size === filtered.length ? (
            <>
              All {filtered.length} matching products are selected.{" "}
              <button type="button" className="font-bold underline" onClick={() => setSelected(new Set())}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              All {visible.length} on this page are selected.{" "}
              <button type="button" className="font-bold underline" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}>
                Select all {filtered.length} matching
              </button>
            </>
          )}
        </div>
      )}

      {!rows.length ? (
        <EmptyState
          title="No products yet"
          body="Add your first product, or import a CSV to load your catalog in one go."
          action={
            canEdit ? (
              <div className="flex justify-center gap-2">
                <Link href="/admin/products/import" className="btn btn-outline">
                  Import CSV
                </Link>
                <Link href="/admin/products/new" className="btn btn-primary">
                  Add product
                </Link>
              </div>
            ) : undefined
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          title="No products match"
          body="Try a different search or clear the filters."
          action={
            <button type="button" onClick={() => update({ ...EMPTY_FILTERS, sort: f.sort })} className="btn btn-outline">
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="relative hidden overflow-x-auto rounded-2xl border border-line bg-white md:block">
            <table className="adm-table w-full min-w-[980px] text-left text-[14px] [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  {canSelect && (
                    <th className="w-10">
                      <input
                        ref={headCheck}
                        type="checkbox"
                        aria-label="Select all products on this page"
                        checked={allOnPage}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            visible.forEach((p) => (allOnPage ? next.delete(p.id) : next.add(p.id)));
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-ink"
                      />
                    </th>
                  )}
                  <th>Product</th>
                  <th>Category</th>
                  <th>Grade</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th className="text-right">Sold</th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className={`${isFlashing(p.id) ? s.flash : ""} ${selected.has(p.id) ? "[&>td]:bg-[#f5f8ff]" : ""}`}>
                    {canSelect && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onChange={() => toggle(setSelected, p.id)}
                          className="h-4 w-4 accent-ink"
                        />
                      </td>
                    )}
                    <td className="max-w-[300px]">
                      <ProductCell p={p} />
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{CATEGORY_LABEL[p.category]}</td>
                    <td>
                      <span className="whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[12px] font-bold text-ink-2">{GRADE_LABEL[p.grade]}</span>
                    </td>
                    <td>
                      <InlinePrice value={p.price} was={p.was} label={p.name} disabled={!canEdit} pending={isPending(p.id)} onSave={(n) => savePrice(p, n)} />
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-0.5">
                        <StockStepper
                          value={p.stock}
                          label={p.name}
                          size="sm"
                          lowThreshold={lowStock}
                          disabled={!canStock}
                          pending={isPending(p.id)}
                          onAdjust={(d) => adjust(p, d)}
                          onSet={(n) => setUnits(p, n)}
                        />
                        <StockNote value={p.stock} lowThreshold={lowStock} />
                      </div>
                    </td>
                    <td>
                      <Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill>
                    </td>
                    <td className="text-right tabular-nums">{p.sold}</td>
                    <td className="whitespace-nowrap text-[13px] text-muted" title={new Date(p.updatedAt).toLocaleString("en-NG")}>
                      {relTime(p.updatedAt, now)}
                    </td>
                    <td>
                      <RowActions p={p} canEdit={canEdit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="space-y-3 md:hidden">
            {visible.map((p) => (
              <li key={p.id} className={`rounded-2xl border bg-white p-4 ${selected.has(p.id) ? "border-accent" : "border-line"} ${isFlashing(p.id) ? s.flash : ""}`}>
                <div className="flex items-start gap-3">
                  {canSelect && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={() => toggle(setSelected, p.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-ink"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <ProductCell p={p} wrap />
                  </div>
                  <RowActions p={p} canEdit={canEdit} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill>
                  <span>{CATEGORY_LABEL[p.category]}</span>
                  <span aria-hidden>·</span>
                  <span>{GRADE_LABEL[p.grade]}</span>
                  <span aria-hidden>·</span>
                  <span>{p.sold} sold</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <InlinePrice value={p.price} was={p.was} label={p.name} disabled={!canEdit} pending={isPending(p.id)} onSave={(n) => savePrice(p, n)} />
                  <div className="flex items-center gap-2">
                    <StockNote value={p.stock} lowThreshold={lowStock} />
                    <StockStepper
                      value={p.stock}
                      label={p.name}
                      size="sm"
                      lowThreshold={lowStock}
                      disabled={!canStock}
                      pending={isPending(p.id)}
                      onAdjust={(d) => adjust(p, d)}
                      onSet={(n) => setUnits(p, n)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <nav aria-label="Pagination" className="mt-4 flex flex-col items-center justify-between gap-3 text-[13px] text-muted sm:flex-row">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <PageButton disabled={page <= 1} onClick={() => goPage(page - 1)} label="Previous page">
                  <Icon name="chevronLeft" size={16} />
                </PageButton>
                {pageList(page, pages).map((n, i) =>
                  n === 0 ? (
                    <span key={`gap${i}`} className="px-1">
                      …
                    </span>
                  ) : (
                    <PageButton key={n} active={n === page} onClick={() => goPage(n)} label={`Page ${n}`}>
                      {n}
                    </PageButton>
                  ),
                )}
                <PageButton disabled={page >= pages} onClick={() => goPage(page + 1)} label="Next page">
                  <Icon name="chevronRight" size={16} />
                </PageButton>
              </div>
            )}
          </nav>
        </>
      )}

      {/* Bulk action bar */}
      {canSelect && selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className={`${s.bulkbar} fixed bottom-4 left-1/2 z-40 w-[calc(100vw-32px)] max-w-fit -translate-x-1/2 rounded-full bg-ink text-white shadow-[0_16px_40px_rgba(0,0,0,0.3)] lg:ml-32`}
        >
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 py-2">
            <span className="shrink-0 whitespace-nowrap px-3 text-[13px] font-bold">
              <span className="tabular-nums">{selected.size}</span> selected
            </span>
            <span aria-hidden className="h-5 w-px shrink-0 bg-white/20" />
            {canEdit && (
              <>
                <BarSelect
                  label="Set status"
                  onPick={(v) => bulk({ type: "status", status: v as ProductStatus })}
                  options={[
                    ["active", "Set active"],
                    ["draft", "Set draft"],
                    ["archived", "Archive"],
                  ]}
                />
                <BarButton onClick={() => bulk({ type: "featured", featured: true })}>Feature</BarButton>
                <BarButton onClick={() => bulk({ type: "featured", featured: false })}>Unfeature</BarButton>
                <BarSelect
                  label="Badge"
                  onPick={(v) => bulk({ type: "badge", badge: v === "none" ? null : (v as Badge) })}
                  options={[...BADGES.map((b) => [b, b] as [string, string]), ["none", "Clear badge"]]}
                />
                <BarButton onClick={() => setDialog("price")}>Adjust price</BarButton>
              </>
            )}
            {canStock && <BarButton onClick={() => setDialog("stock")}>Set stock</BarButton>}
            {canEdit && (
              <BarButton onClick={() => setDialog("delete")} danger>
                Delete
              </BarButton>
            )}
            <span aria-hidden className="h-5 w-px shrink-0 bg-white/20" />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog
        open={dialog === "price"}
        onClose={() => setDialog(null)}
        title={`Adjust ${selected.size} ${selected.size === 1 ? "price" : "prices"}`}
        description="Raise or lower prices by a percentage. New prices are rounded to the nearest ₦500. Compare-at prices that end up below the new price are cleared."
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!pctValid} onClick={() => bulk({ type: "price", percent: pct })}>
              Apply {pctValid ? `${pct > 0 ? "+" : ""}${pct}%` : ""}
            </button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Change (%)</span>
          <div className="flex items-center gap-2">
            {[-10, -5, 5, 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPercent(String(v))}
                aria-pressed={pct === v}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-bold ${pct === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}
              >
                {v > 0 ? `+${v}` : v}%
              </button>
            ))}
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              inputMode="decimal"
              aria-label="Custom percentage"
              aria-invalid={!pctValid || undefined}
              className={`${inputCls} w-24`}
            />
          </div>
        </label>
        {pctValid && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-[13px]">
            {selectedRows.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-ink-2">{p.name}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  <span className="text-muted">{formatNaira(p.price)}</span> → <b>{formatNaira(roundTo500(p.price * (1 + pct / 100)))}</b>
                </span>
              </li>
            ))}
            {selectedRows.length > 4 && <li className="px-3 py-2 text-muted">and {selectedRows.length - 4} more</li>}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={dialog === "stock"}
        onClose={() => setDialog(null)}
        title={`Set stock for ${selected.size} ${selected.size === 1 ? "product" : "products"}`}
        description="Every selected product gets exactly this many units. Use 0 to mark them sold out."
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!stockValid} onClick={() => bulk({ type: "stock", units: stockN })}>
              Set to {stockValid ? stockN : "…"}
            </button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Units in stock</span>
          <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} inputMode="numeric" aria-invalid={!stockValid || undefined} className={`${inputCls} w-32`} />
        </label>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        tone="danger"
        title={`Delete ${selected.size} ${selected.size === 1 ? "product" : "products"}?`}
        description={
          <>
            This can&apos;t be undone. Past orders keep their details, but the products disappear from the store and the admin.{" "}
            <b>Archiving</b> hides them and keeps them for reference.
          </>
        }
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-outline" onClick={() => bulk({ type: "status", status: "archived" })}>
              Archive instead
            </button>
            <button type="button" className="btn bg-sale text-white hover:bg-[#b8003c]" onClick={() => bulk({ type: "delete" })}>
              Delete
            </button>
          </>
        }
      >
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-stage px-3 py-2 text-[13px] text-ink-2">
          {selectedRows.slice(0, 8).map((p) => (
            <li key={p.id} className="truncate">
              {p.name} <span className="text-muted">· {p.id}</span>
            </li>
          ))}
          {selectedRows.length > 8 && <li className="text-muted">and {selectedRows.length - 8} more</li>}
        </ul>
      </Dialog>
    </div>
  );

  function goPage(n: number) {
    setF((prev) => ({ ...prev, page: n }));
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
}

function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  set((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

/** Page numbers with gaps (0) for long ranges: 1 … 4 5 6 … 12 */
function pageList(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push(0);
    out.push(n);
  });
  return out;
}

function ProductCell({ p, wrap }: { p: ProductRow; wrap?: boolean }) {
  const marks = (
    <>
      {p.featured && (
        <span title="Featured" className="shrink-0 text-accent">
          <Icon name="star" size={14} className="fill-current" label="Featured" />
        </span>
      )}
      {p.badge && (
        <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-bold ${p.badge === "Hot deal" ? "bg-sale text-white" : "bg-stage text-ink-2"}`}>{p.badge}</span>
      )}
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href={`/admin/products/${p.id}`} tabIndex={-1} aria-hidden className="shrink-0 overflow-hidden rounded-xl bg-stage">
        <ProductImage item={p} width={120} className="h-12 w-12" artClassName="h-10 w-10" />
      </Link>
      <div className="min-w-0">
        {wrap ? (
          <>
            <Link href={`/admin/products/${p.id}`} className="line-clamp-2 font-bold leading-snug hover:underline">
              {p.name}
            </Link>
            <p className="line-clamp-1 text-[12px] text-muted">{p.spec || p.brand}</p>
            {(p.featured || p.badge) && <div className="mt-1 flex items-center gap-1.5">{marks}</div>}
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              <Link href={`/admin/products/${p.id}`} className="truncate font-bold hover:underline">
                {p.name}
              </Link>
              {marks}
            </div>
            <p className="truncate text-[12px] text-muted">{p.spec || p.brand}</p>
            <p className="truncate font-mono text-[11px] text-muted/80">{p.id}</p>
          </>
        )}
      </div>
    </div>
  );
}

function RowActions({ p, canEdit }: { p: ProductRow; canEdit: boolean }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link
        href={`/admin/products/${p.id}`}
        aria-label={`${canEdit ? "Edit" : "View"} ${p.name}`}
        title={canEdit ? "Edit" : "View"}
        className="grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-stage hover:text-ink"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z" />
        </svg>
      </Link>
      {p.status === "active" && (
        <a
          href={`/product/${p.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`View ${p.name} on the store (opens in a new tab)`}
          title="View on store"
          className="grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-stage hover:text-ink"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
      )}
    </div>
  );
}

/** Compact filter control: a pill showing the current choice over a native select. */
function FilterPill({
  label,
  value,
  onChange,
  options,
  always,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  /** Always has a value (e.g. sort), so it's never shown as an active filter. */
  always?: boolean;
}) {
  const current = options.find(([v]) => v === value)?.[1];
  const active = !always && !!value;
  return (
    <label
      className={`relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1 ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-ink"
      }`}
    >
      <span className="whitespace-nowrap">
        {label}
        {(active || always) && current ? <span className={always ? "font-normal" : ""}>: {current}</span> : null}
      </span>
      <Icon name="chevronDown" size={14} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
        {!always && <option value="">{`All (${label.toLowerCase()})`}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function PageButton({ children, onClick, disabled, active, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] font-bold transition-colors disabled:opacity-30 ${
        active ? "bg-ink text-white" : "text-ink-2 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function BarButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
        danger ? "text-[#ff8fb1] hover:bg-sale hover:text-white" : "hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function BarSelect({ label, options, onPick }: { label: string; options: [string, string][]; onPick: (v: string) => void }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full py-2 pl-3.5 pr-3 text-[13px] font-bold transition-colors focus-within:outline-2 focus-within:outline-white hover:bg-white/15">
      {label}
      <Icon name="chevronDown" size={14} />
      <select
        aria-label={label}
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        <option value="" disabled>
          {label}
        </option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
