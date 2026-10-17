"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveOfferAction } from "@/app/admin/(panel)/offers/actions";
import { Icon } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { discountSticker, formatNaira, shortDuration } from "@/components/offers/format";
import { useNow } from "@/components/offers/useOffer";
import { describeDiscount, offerAppliesTo, offerUnitPrice } from "@/lib/pricing";
import type { CategorySlug, Offer, OfferDiscount, OfferScope } from "@/lib/types";
import { inputCls, labelCls } from "../ui";
import { isRedirect } from "./OfferRowActions";
import { ProductPicker, type PickerProduct } from "./ProductPicker";
import {
  CATEGORY_SLUGS,
  isoToLagosInput,
  lagosInputToIso,
  normalizeOfferCode,
  validateOfferInput,
  type OfferFieldErrors,
  type OfferInput,
} from "./offerInput";

const DISCOUNT_TYPES: { id: OfferDiscount["type"]; label: string; hint: string }[] = [
  { id: "percent", label: "Percent off", hint: "e.g. 10% off every eligible item" },
  { id: "fixed", label: "Naira off", hint: "A fixed amount off each item" },
  { id: "price", label: "Flash price", hint: "One price per item (specific products)" },
];

const SCOPES: { id: OfferScope["type"]; label: string }[] = [
  { id: "all", label: "All products" },
  { id: "categories", label: "Categories" },
  { id: "brands", label: "Brands" },
  { id: "products", label: "Specific products" },
];

const CATEGORY_LABEL: Record<CategorySlug, string> = { phones: "Phones", accessories: "Accessories", gadgets: "Gadgets", cars: "Cars" };

const DURATIONS: [string, number][] = [
  ["24 hours", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["30 days", 30],
];

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1 text-[12px] font-bold text-sale">
      <Icon name="alert" size={14} /> {msg}
    </p>
  );
}

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="display grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] text-white">{n}</span>
        <div>
          <h2 className="text-[16px] font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on ? "bg-ok" : "bg-[#cfd3d8]"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/** Create / edit form for an offer with a live preview of its landing page. */
export function OfferForm({
  mode,
  initial,
  products,
  brands,
  existingCodes,
  origin,
}: {
  mode: "create" | "edit";
  initial: OfferInput;
  products: PickerProduct[];
  brands: string[];
  existingCodes: string[];
  origin: string;
}) {
  const [v, setV] = useState<OfferInput>(initial);
  const [codeTouched, setCodeTouched] = useState(mode === "edit" || !!initial.code);
  const [errors, setErrors] = useState<OfferFieldErrors>({});
  const [brandQ, setBrandQ] = useState("");
  const [pending, start] = useTransition();
  const now = useNow(60_000);

  const set = <K extends keyof OfferInput>(k: K, val: OfferInput[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const codeTaken = mode === "create" && existingCodes.includes(normalizeOfferCode(v.code));

  // Build an Offer-shaped object from the form for the preview (falls back gracefully).
  const preview = useMemo(() => {
    const parsed = validateOfferInput(v);
    const value = Number(v.discountValue) || 0;
    const discount: OfferDiscount = { type: v.discountType, value } as OfferDiscount;
    const scope: OfferScope = parsed.ok
      ? parsed.value.scope
      : v.scopeType === "categories"
        ? { type: "categories", categories: v.categories as CategorySlug[] }
        : v.scopeType === "brands"
          ? { type: "brands", brands: v.brands }
          : v.scopeType === "products"
            ? { type: "products", productIds: v.productIds }
            : { type: "all" };
    const offer: Offer = {
      code: normalizeOfferCode(v.code) || "your-code",
      title: v.title || "Offer title",
      headline: v.headline || v.title || "Your headline goes here",
      description: v.description,
      discount,
      scope,
      startsAt: lagosInputToIso(v.startsAt) ?? new Date(0).toISOString(),
      endsAt: lagosInputToIso(v.endsAt) ?? new Date(0).toISOString(),
      active: v.active,
      createdAt: "",
      updatedAt: "",
    };
    const eligible = products.filter((p) => p.status === "active" && offerAppliesTo(offer, p));
    return { offer, eligible };
  }, [v, products]);

  const heroCandidates = preview.eligible.length ? preview.eligible : products.filter((p) => p.status === "active");
  const hero =
    products.find((p) => p.id === v.heroProductId) ?? preview.eligible.find((p) => p.stock > 0 && (p.photo || p.imageUrl)) ?? preview.eligible[0];
  const samples = preview.eligible.filter((p) => p.stock > 0).slice(0, 4);
  const filteredBrands = brands.filter((b) => b.toLowerCase().includes(brandQ.toLowerCase()));

  const startsMs = Date.parse(preview.offer.startsAt);
  const endsMs = Date.parse(preview.offer.endsAt);
  const previewState =
    now === null ? null : !v.active ? "Paused" : now < startsMs ? `Starts in ${shortDuration(startsMs - now)}` : now >= endsMs ? "Ended" : `Ends in ${shortDuration(endsMs - now)}`;

  const setDuration = (days: number) => {
    const start = lagosInputToIso(v.startsAt) ?? new Date().toISOString();
    set("endsAt", isoToLagosInput(new Date(Date.parse(start) + days * 86_400_000).toISOString()));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const local = validateOfferInput(v);
    const errs: OfferFieldErrors = local.ok ? {} : { ...local.errors };
    if (codeTaken) errs.code = "An offer already uses this code.";
    if (local.ok && v.discountType === "price" && v.scopeType !== "products") errs.discountType = "A flash price only works with specific products.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-invalid=true], [role=alert]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    start(async () => {
      try {
        const res = await saveOfferAction(v, mode === "edit" ? initial.code : null);
        if (res && !res.ok) setErrors(res.errors);
      } catch (err) {
        if (isRedirect(err)) throw err;
        setErrors({ form: err instanceof Error ? err.message : "Couldn't save. Try again." });
      }
    });
  };

  const err = (k: keyof OfferInput) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `err-${k}`, "data-invalid": true } : {});
  const valueSuffix = v.discountType === "percent" ? "%" : null;
  const valuePrefix = v.discountType === "percent" ? null : "₦";

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-5">
        {errors.form && (
          <p role="alert" className="rounded-xl border border-[#f6c2d3] bg-[#fdf0f4] px-4 py-3 text-[14px] font-bold text-sale">
            {errors.form}
          </p>
        )}

        <Section n={1} title="Details" description="What shoppers see on the landing page and in shared links.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="o-title" className={labelCls}>
                Title
              </label>
              <input
                id="o-title"
                value={v.title}
                maxLength={80}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!codeTouched) set("code", normalizeOfferCode(e.target.value));
                }}
                placeholder="Sallah Sale"
                className={inputCls}
                {...err("title")}
              />
              <FieldError id="err-title" msg={errors.title} />
            </div>
            <div>
              <label htmlFor="o-code" className={labelCls}>
                Code
              </label>
              <div className={`flex items-center rounded-xl border ${errors.code || codeTaken ? "border-sale" : "border-line"} bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-accent ${mode === "edit" ? "bg-stage" : ""}`}>
                <span className="shrink-0 pl-3 text-[13px] text-muted">/o/</span>
                <input
                  id="o-code"
                  value={v.code}
                  maxLength={40}
                  readOnly={mode === "edit"}
                  onChange={(e) => {
                    setCodeTouched(true);
                    set("code", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  onBlur={() => set("code", normalizeOfferCode(v.code))}
                  placeholder="sallah-sale"
                  className="w-full min-w-0 rounded-xl bg-transparent py-2.5 pl-1 pr-3 font-mono text-[14px] outline-none read-only:text-muted"
                  aria-describedby="o-code-hint"
                  {...err("code")}
                />
              </div>
              <p id="o-code-hint" className="mt-1 text-[12px] text-muted">
                {mode === "edit"
                  ? "Codes can't change once created, so printed QR codes keep working."
                  : codeTaken
                    ? ""
                    : "Letters, numbers and dashes. Suggested from the title."}
              </p>
              {codeTaken && !errors.code && <FieldError id="err-code-taken" msg="An offer already uses this code." />}
              <FieldError id="err-code" msg={errors.code} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="o-headline" className={labelCls}>
                Headline <span className="font-normal text-muted">(optional, defaults to the title)</span>
              </label>
              <input
                id="o-headline"
                value={v.headline}
                maxLength={120}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Sallah prices. Graded phones from ₦95,000."
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="o-desc" className={labelCls}>
                Description <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="o-desc"
                value={v.description}
                maxLength={400}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
                placeholder="One or two lines about the deal. Lead with what the buyer gets."
                className={`${inputCls} resize-y`}
              />
              <p className="mt-1 text-right text-[11px] text-muted">{v.description.length}/400</p>
            </div>
          </div>
        </Section>

        <Section n={2} title="Discount" description="Applied per unit at checkout, never below ₦0. Prices round to the nearest ₦50.">
          <div role="group" aria-label="Discount type" className="grid gap-2 sm:grid-cols-3">
            {DISCOUNT_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={v.discountType === d.id}
                onClick={() => set("discountType", d.id)}
                className="chip text-left"
              >
                <span className="block text-[14px] font-bold">{d.label}</span>
                <span className="mt-0.5 block text-[12px] text-muted">{d.hint}</span>
              </button>
            ))}
          </div>
          <FieldError id="err-discountType" msg={errors.discountType} />
          <div className="mt-4 max-w-xs">
            <label htmlFor="o-value" className={labelCls}>
              {v.discountType === "percent" ? "Percent off" : v.discountType === "fixed" ? "Naira off each item" : "Flash price per item"}
            </label>
            <div className={`flex items-center rounded-xl border ${errors.discountValue ? "border-sale" : "border-line"} bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-accent`}>
              {valuePrefix && <span className="pl-3 text-[14px] font-bold text-muted">{valuePrefix}</span>}
              <input
                id="o-value"
                inputMode="numeric"
                value={v.discountValue}
                onChange={(e) => set("discountValue", e.target.value.replace(/[^\d]/g, ""))}
                placeholder={v.discountType === "percent" ? "10" : "25000"}
                className="w-full min-w-0 rounded-xl bg-transparent px-3 py-2.5 text-[15px] font-bold outline-none"
                {...err("discountValue")}
              />
              {valueSuffix && <span className="pr-3 text-[14px] font-bold text-muted">{valueSuffix}</span>}
            </div>
            {v.discountType !== "percent" && Number(v.discountValue) > 0 && (
              <p className="mt-1 text-[12px] text-muted">{formatNaira(Number(v.discountValue))}</p>
            )}
            <FieldError id="err-discountValue" msg={errors.discountValue} />
          </div>
        </Section>

        <Section n={3} title="Eligible products" description={`${preview.eligible.length} active product${preview.eligible.length === 1 ? "" : "s"} covered right now.`}>
          <div role="group" aria-label="Offer covers" className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={v.scopeType === s.id}
                onClick={() => set("scopeType", s.id)}
                className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${v.scopeType === s.id ? "bg-ink text-white" : "bg-white text-ink-2 ring-1 ring-line hover:ring-ink"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <FieldError id="err-scopeType" msg={errors.scopeType} />

          {v.scopeType === "categories" && (
            <div className="mt-4">
              <p className={labelCls}>Categories</p>
              <div className="flex flex-wrap gap-2" {...err("categories")}>
                {CATEGORY_SLUGS.map((c) => {
                  const on = v.categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("categories", on ? v.categories.filter((x) => x !== c) : [...v.categories, c])}
                      className="chip flex items-center gap-2 py-2.5"
                    >
                      {on && <Icon name="check" size={14} strokeWidth={2.5} className="text-accent" />}
                      {CATEGORY_LABEL[c]}
                      <span className="text-[12px] text-muted">{products.filter((p) => p.category === c && p.status === "active").length}</span>
                    </button>
                  );
                })}
              </div>
              <FieldError id="err-categories" msg={errors.categories} />
            </div>
          )}

          {v.scopeType === "brands" && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className={`${labelCls} mb-0`}>Brands {v.brands.length > 0 && <span className="text-muted">({v.brands.length} selected)</span>}</p>
                <label className="sr-only" htmlFor="o-brand-q">
                  Filter brands
                </label>
                <input id="o-brand-q" type="search" value={brandQ} onChange={(e) => setBrandQ(e.target.value)} placeholder="Filter brands" className={`${inputCls} max-w-[200px] py-1.5`} />
              </div>
              <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto" {...err("brands")}>
                {filteredBrands.map((b) => {
                  const on = v.brands.some((x) => x.toLowerCase() === b.toLowerCase());
                  return (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("brands", on ? v.brands.filter((x) => x.toLowerCase() !== b.toLowerCase()) : [...v.brands, b])}
                      className="chip flex items-center gap-1.5 px-3 py-2"
                    >
                      {on && <Icon name="check" size={14} strokeWidth={2.5} className="text-accent" />}
                      {b}
                    </button>
                  );
                })}
                {filteredBrands.length === 0 && <p className="text-[13px] text-muted">No brands match.</p>}
              </div>
              <FieldError id="err-brands" msg={errors.brands} />
            </div>
          )}

          {v.scopeType === "products" && (
            <div className="mt-4" {...err("productIds")}>
              <p className={labelCls}>Products {v.productIds.length > 0 && <span className="text-muted">({v.productIds.length} selected)</span>}</p>
              <ProductPicker products={products} selected={v.productIds} onChange={(ids) => set("productIds", ids)} label="Offer products" invalid={!!errors.productIds} />
              <FieldError id="err-productIds" msg={errors.productIds} />
            </div>
          )}
          {v.discountType === "price" && v.scopeType !== "products" && (
            <p className="mt-3 rounded-xl bg-[#fff4e0] px-3 py-2 text-[13px] text-[#7a4b00]">A flash price sets one price for every covered item, so pick specific products.</p>
          )}
        </Section>

        <Section n={4} title="Schedule" description="Times are Lagos time (WAT, UTC+1). The link shows a countdown before and during the offer.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="o-start" className={labelCls}>
                Starts
              </label>
              <input id="o-start" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputCls} {...err("startsAt")} />
              <FieldError id="err-startsAt" msg={errors.startsAt} />
            </div>
            <div>
              <label htmlFor="o-end" className={labelCls}>
                Ends
              </label>
              <input id="o-end" type="datetime-local" value={v.endsAt} min={v.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} className={inputCls} {...err("endsAt")} />
              <FieldError id="err-endsAt" msg={errors.endsAt} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-muted">Run for</span>
            {DURATIONS.map(([label, days]) => (
              <button key={label} type="button" onClick={() => setDuration(days)} className="rounded-full bg-stage px-3 py-1 text-[12px] font-bold text-ink-2 transition hover:bg-ink hover:text-white">
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section n={5} title="Limits" description="Optional. Leave empty for no limit.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="o-limit" className={labelCls}>
                Usage limit (orders)
              </label>
              <input
                id="o-limit"
                inputMode="numeric"
                value={v.usageLimit ?? ""}
                onChange={(e) => set("usageLimit", e.target.value.replace(/[^\d]/g, "") || null)}
                placeholder="Unlimited"
                className={inputCls}
                {...err("usageLimit")}
              />
              <p className="mt-1 text-[12px] text-muted">The offer shows as sold out after this many orders.</p>
              <FieldError id="err-usageLimit" msg={errors.usageLimit} />
            </div>
            <div>
              <label htmlFor="o-min" className={labelCls}>
                Minimum order (₦, before discount)
              </label>
              <input
                id="o-min"
                inputMode="numeric"
                value={v.minSubtotal ?? ""}
                onChange={(e) => set("minSubtotal", e.target.value.replace(/[^\d]/g, "") || null)}
                placeholder="No minimum"
                className={inputCls}
                {...err("minSubtotal")}
              />
              {Number(v.minSubtotal) > 0 && <p className="mt-1 text-[12px] text-muted">{formatNaira(Number(v.minSubtotal))}</p>}
              <FieldError id="err-minSubtotal" msg={errors.minSubtotal} />
            </div>
          </div>
        </Section>

        <Section n={6} title="Landing page" description="The hero product is the big animated photo on the offer page and the image in link previews.">
          <ProductPicker
            products={heroCandidates}
            selected={v.heroProductId ? [v.heroProductId] : []}
            onChange={(ids) => set("heroProductId", ids[0] ?? null)}
            multiple={false}
            label="Hero product"
            emptyHint="No eligible products yet."
          />
          <p className="mt-2 text-[12px] text-muted">{v.heroProductId ? "" : "Not set: the first eligible product with a photo is used."}</p>
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-stage p-4">
            <div>
              <label htmlFor="o-active" className="text-[14px] font-bold">
                Active
              </label>
              <p className="text-[12px] text-muted">{v.active ? "Runs on schedule." : "Paused: the link shows a friendly “taking a break” page."}</p>
            </div>
            <Toggle id="o-active" on={v.active} onChange={(x) => set("active", x)} label="Offer active" />
          </div>
        </Section>

        {/* Save bar */}
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-5">
          <p className="hidden text-[13px] text-muted sm:block">
            {Object.values(errors).some(Boolean) ? <span className="font-bold text-sale">Fix the highlighted fields.</span> : "Changes go live on the store as soon as you save."}
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Link href="/admin/offers" className="btn btn-outline">
              Cancel
            </Link>
            <button type="submit" disabled={pending} className="btn btn-primary min-w-[140px]">
              {pending ? "Saving…" : mode === "create" ? "Create offer" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <aside aria-label="Preview" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
          Live preview
          <span className="font-mono normal-case tracking-normal">
            {origin.replace(/^https?:\/\//, "")}/o/{preview.offer.code}
          </span>
        </p>
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div
            className="relative overflow-hidden bg-ink p-5 text-white"
            style={{ background: "radial-gradient(70% 90% at 80% 40%, rgba(26,92,255,.55), rgba(11,42,138,.3) 45%, #000 80%)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${previewState?.startsWith("Ends") ? "bg-[#3ddc84]" : "bg-[#f5c06b]"}`} />
              {previewState ?? "…"}
            </p>
            <div className="mt-3 grid grid-cols-[1fr_120px] items-center gap-3">
              <div className="min-w-0">
                <p className="display break-words text-[22px] leading-[1.1]">{preview.offer.headline}</p>
                {v.description && <p className="mt-2 line-clamp-3 text-[12px] text-white/75">{v.description}</p>}
                <span className="mt-3 inline-block rounded-full bg-sale px-2.5 py-1 text-[11px] font-extrabold uppercase">
                  {Number(v.discountValue) > 0 ? describeDiscount(preview.offer) : "Set a discount"}
                </span>
              </div>
              <div className="relative aspect-square">
                <div aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(26,92,255,.9),transparent_70%)] blur-xl" />
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white">
                  {hero ? (
                    <ProductImage key={hero.id} item={hero} width={330} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-ink">
                      <Icon name="gift" size={32} strokeWidth={1.25} />
                    </span>
                  )}
                </div>
                {Number(v.discountValue) > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-sale text-center leading-none shadow-lg">
                    <span className="display text-[13px] font-extrabold">{discountSticker(preview.offer.discount).main}</span>
                    <span className="text-[7px] font-bold uppercase">{discountSticker(preview.offer.discount).sub}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Sample prices</p>
            {samples.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">No in-stock products covered yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {samples.map((p) => {
                  const after = Number(v.discountValue) > 0 ? offerUnitPrice(preview.offer, p.price) : p.price;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stage">
                        <ProductImage item={p} width={120} className="h-10 w-10" artClassName="h-8 w-8" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{p.name}</span>
                        <span className="block truncate text-[11px] text-muted">{p.spec}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-[13px] font-bold ${after < p.price ? "text-sale" : ""}`}>{formatNaira(after)}</span>
                        {after < p.price && <s className="block text-[11px] text-muted">{formatNaira(p.price)}</s>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {Number(v.minSubtotal) > 0 && <p className="mt-2 text-[11px] text-muted">On orders of {formatNaira(Number(v.minSubtotal))} or more.</p>}
          </div>
        </div>
      </aside>
    </form>
  );
}
