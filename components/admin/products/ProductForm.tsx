"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { deleteProductAction, saveProductAction } from "@/app/admin/(panel)/products/actions";
import { Card, inputCls, labelCls, selectCls } from "@/components/admin/ui";
import { CartProvider } from "@/components/cart/CartProvider";
import { DeviceArt } from "@/components/DeviceArt";
import { Icon } from "@/components/Icon";
import { ProductCard } from "@/components/ProductCard";
import { formatNaira } from "@/lib/catalog";
import { productImageSrc } from "@/lib/photos";
import type { ArtKind, CategorySlug, Product } from "@/lib/types";
import { Dialog } from "./Dialog";
import { ImageUpload } from "./ImageUpload";
import { s } from "./styles";
import { useToast } from "./Toasts";
import type { SaveState } from "./types";
import {
  ART_KINDS,
  ATTR_TEMPLATES,
  BADGES,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  DEFAULT_ART,
  GRADE_OPTIONS,
  MAX_STOCK,
  SHIP_STATES,
  STATUS_OPTIONS,
  normaliseCommonsFile,
  parseWhole,
  validateProduct,
  type FieldErrors,
  type ProductInput,
} from "./validate";

// Create / edit form with a live storefront preview. Client-side checks give instant
// feedback; saveProductAction re-validates everything on the server.

type AttrRow = { key: string; k: string; v: string };
type FormValues = Omit<ProductInput, "attrs"> & { attrs: AttrRow[] };
type ImageTab = "commons" | "url" | "upload";

const TINTS = ["#2a2a2a", "#c9c9c9", "#8a8378", "#5d6470", "#1f2630", "#4b3d5c", "#e8b9c4", "#1a5cff", "#b0283a", "#2f6b4f"];

let rowSeq = 0;
const rowKey = () => `a${++rowSeq}`;

/** "450000" → "450,000" so amounts read naturally (parseWhole accepts both). */
const grouped = (raw: string) => {
  const n = parseWhole(raw);
  return n === null ? raw : n.toLocaleString("en-NG");
};

const toValues = (i: ProductInput): FormValues => ({
  ...i,
  price: grouped(i.price),
  was: grouped(i.was),
  attrs: i.attrs.map(([k, v]) => ({ key: rowKey(), k, v })),
});
const toInput = (v: FormValues): ProductInput => ({ ...v, attrs: v.attrs.map((a) => [a.k, a.v]) });
const snapshot = (v: FormValues) => JSON.stringify({ ...v, attrs: v.attrs.map((a) => [a.k, a.v]) });

const isBlobUrl = (u: string) => /\.blob\.vercel-storage\.com\//.test(u);

export function ProductForm({
  mode,
  product,
  initial,
  blobEnabled,
  suggestions,
  aside,
}: {
  mode: "create" | "edit";
  product?: Product;
  initial: ProductInput;
  blobEnabled: boolean;
  suggestions: { brands: string[]; sellers: string[]; models: string[] };
  /** Extra server-rendered cards shown under the form (performance, activity). */
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(() => toValues(initial));
  const [baseline, setBaseline] = useState(() => snapshot(toValues(initial)));
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  // Fields edited since the last server response (their server errors are stale).
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<ImageTab>(() => (initial.imageUrl ? (isBlobUrl(initial.imageUrl) ? "upload" : "url") : "commons"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const [state, formAction, saving] = useActionState<SaveState, FormData>(async (prev, fd) => {
    const res = await saveProductAction(prev, fd);
    setTouched(new Set());
    if (res.ok) {
      toast.push(res.message ?? "Saved.");
      if (res.created && res.id) {
        // Start the create form fresh for next time (the page stays mounted when hidden).
        if (mode === "create") {
          const fresh = toValues(initial);
          setValues(fresh);
          setBaseline(snapshot(fresh));
        } else setBaseline(snapshot(values));
        router.push(`/admin/products/${res.id}`);
      } else {
        setBaseline(snapshot(values));
      }
    } else if (res.error) {
      toast.push(res.error, "error");
    }
    return res;
  }, { nonce: 0 });

  const dirty = snapshot(values) !== baseline;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const btn = formRef.current?.querySelector<HTMLButtonElement>('button[name="intent"][value="save"]');
        if (btn && !btn.disabled) formRef.current?.requestSubmit(btn);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setTouched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
    if (clientErrors[k as keyof FieldErrors]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[k as keyof FieldErrors];
        return next;
      });
    }
  };

  const errorFor = (k: keyof FieldErrors) => clientErrors[k] ?? (touched.has(k) ? undefined : state.errors?.[k]);
  const errorList = Object.entries({ ...Object.fromEntries(Object.entries(state.errors ?? {}).filter(([k]) => !touched.has(k))), ...clientErrors }) as [keyof FieldErrors, string][];

  const fieldId = (k: string) => `${uid}-${k}`;
  const errProps = (k: keyof FieldErrors) => {
    const e = errorFor(k);
    return { id: fieldId(k), "aria-invalid": e ? true : undefined, "aria-describedby": e ? `${fieldId(k)}-err` : undefined };
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const res = validateProduct(toInput(values));
    if (!res.ok) {
      e.preventDefault();
      setClientErrors(res.errors);
      const first = Object.keys(res.errors)[0];
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
      toast.push("Check the highlighted fields.", "error");
    } else setClientErrors({});
  };

  const onCategory = (c: CategorySlug) => {
    setValues((prev) => ({
      ...prev,
      category: c,
      // Follow the category with the fallback illustration unless it was picked by hand.
      art: prev.art === DEFAULT_ART[prev.category as CategorySlug] || !prev.art ? DEFAULT_ART[c] : prev.art,
    }));
  };

  const applyTemplate = () => {
    const keys = ATTR_TEMPLATES[(values.category as CategorySlug) || "phones"] ?? [];
    const have = new Set(values.attrs.map((a) => a.k.trim().toLowerCase()));
    const add = keys.filter((k) => !have.has(k.toLowerCase())).map((k) => ({ key: rowKey(), k, v: "" }));
    set("attrs", [...values.attrs.filter((a) => a.k.trim() || a.v.trim()), ...add]);
  };

  // ---------------------------------------------------------------- preview

  const preview = useMemo<Product>(() => {
    const price = parseWhole(values.price) ?? 0;
    const was = parseWhole(values.was);
    let imageUrl: string | undefined;
    try {
      imageUrl = values.imageUrl && new URL(values.imageUrl).protocol === "https:" ? values.imageUrl : undefined;
    } catch {
      imageUrl = undefined;
    }
    const category = (CATEGORY_LABEL[values.category as CategorySlug] ? values.category : "phones") as CategorySlug;
    return {
      id: product?.id ?? "preview",
      model: values.model,
      category,
      brand: values.brand || "Brand",
      name: values.name.trim() || "Product name",
      spec: values.spec.trim() || "Spec line",
      price,
      was: was && was > price ? was : undefined,
      grade: (GRADE_OPTIONS.some((g) => g.value === values.grade) ? values.grade : "great") as Product["grade"],
      state: values.state || "Lagos",
      seller: values.seller,
      verified: values.verified,
      rating: product?.rating ?? 0,
      reviews: product?.reviews ?? 0,
      art: (ART_KINDS.includes(values.art as ArtKind) ? values.art : DEFAULT_ART[category]) as ArtKind,
      tint: /^#[0-9a-f]{6}$/i.test(values.tint) ? values.tint : "#2a2a2a",
      photo: normaliseCommonsFile(values.photo) || undefined,
      imageUrl,
      badge: BADGES.find((b) => b === values.badge),
      attrs: {},
      stock: parseWhole(values.stock) ?? 0,
      sold: product?.sold ?? 0,
      status: values.status as Product["status"],
      featured: values.featured,
      createdAt: product?.createdAt ?? "",
      updatedAt: product?.updatedAt ?? "",
    };
  }, [values, product]);

  const previewSrc = productImageSrc(preview, 480) ?? `art:${preview.art}:${preview.tint}`;
  const priceN = parseWhole(values.price);
  const wasN = parseWhole(values.was);
  const discount = priceN && wasN && wasN > priceN ? Math.round((1 - priceN / wasN) * 100) : 0;
  const stockN = parseWhole(values.stock);
  const template = ATTR_TEMPLATES[(values.category as CategorySlug) || "phones"] ?? [];
  const missingTemplate = template.filter((k) => !values.attrs.some((a) => a.k.trim().toLowerCase() === k.toLowerCase()));
  const busy = saving || deleting;

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}
      {product && <input type="hidden" name="stockOriginal" value={product.stock} />}
      <input type="hidden" name="photo" value={values.photo} />
      <input type="hidden" name="imageUrl" value={values.imageUrl} />
      <input type="hidden" name="art" value={values.art} />
      <input type="hidden" name="tint" value={values.tint} />

      {errorList.length > 0 && (
        <div role="alert" className="mb-6 rounded-2xl border border-[#f7b8cb] bg-[#fff5f8] p-4 text-[14px]">
          <p className="flex items-center gap-2 font-bold text-sale">
            <Icon name="alert" size={18} /> {errorList.length === 1 ? "1 field needs attention" : `${errorList.length} fields need attention`}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-9 text-ink-2">
            {errorList.map(([k, m]) => (
              <li key={k}>
                <a href={`#${fieldId(k)}`} className="underline underline-offset-2">
                  {m}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------ main column */}
        <div className="min-w-0 space-y-6">
          <Card title="Basics">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Name" required error={errorFor("name")} errId={`${fieldId("name")}-err`} className="md:col-span-2">
                <input {...errProps("name")} name="name" value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="e.g. iPhone 15 Pro" className={inputCls} />
              </FormField>
              <FormField label="Brand" required error={errorFor("brand")} errId={`${fieldId("brand")}-err`}>
                <input {...errProps("brand")} name="brand" list={`${uid}-brands`} value={values.brand} onChange={(e) => set("brand", e.target.value)} maxLength={60} className={inputCls} />
                <datalist id={`${uid}-brands`}>
                  {suggestions.brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="Category" required error={errorFor("category")} errId={`${fieldId("category")}-err`}>
                <select {...errProps("category")} name="category" value={values.category} onChange={(e) => onCategory(e.target.value as CategorySlug)} className={selectCls}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <fieldset className="md:col-span-2">
                <legend className={labelCls}>
                  Grade <span className="text-sale">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" id={fieldId("grade")}>
                  {GRADE_OPTIONS.map((g) => (
                    <label key={g.value} className="cursor-pointer">
                      <input type="radio" name="grade" value={g.value} checked={values.grade === g.value} onChange={() => set("grade", g.value)} className="peer sr-only" />
                      <span className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] transition-colors hover:border-[#999] peer-checked:border-accent peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-stage text-[12px] font-bold">{g.letter}</span>
                        <span className="font-bold">{g.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errorFor("grade") && <FieldError id={`${fieldId("grade")}-err`}>{errorFor("grade")}</FieldError>}
              </fieldset>
              <FormField label="Spec line" hint="Shown under the name on cards, e.g. 256GB · Natural Titanium · Battery 92%" error={errorFor("spec")} errId={`${fieldId("spec")}-err`} className="md:col-span-2">
                <input {...errProps("spec")} name="spec" value={values.spec} onChange={(e) => set("spec", e.target.value)} maxLength={160} className={inputCls} />
              </FormField>
              <FormField label="Model group" hint="Optional. Units with the same slug are grouped as one model. Leave empty to use the name." error={errorFor("model")} errId={`${fieldId("model")}-err`} className="md:col-span-2">
                <input
                  {...errProps("model")}
                  name="model"
                  list={`${uid}-models`}
                  value={values.model}
                  onChange={(e) => set("model", e.target.value)}
                  placeholder="e.g. iphone-15-pro"
                  maxLength={60}
                  className={`${inputCls} font-mono text-[13px]`}
                />
                <datalist id={`${uid}-models`}>
                  {suggestions.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </FormField>
            </div>
          </Card>

          <Card title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Price" required error={errorFor("price")} errId={`${fieldId("price")}-err`}>
                <NairaInput {...errProps("price")} name="price" value={values.price} onChange={(v) => set("price", v)} />
              </FormField>
              <FormField label="Compare-at price" hint="Optional “was” price, shown struck through. Must be higher than the price." error={errorFor("was")} errId={`${fieldId("was")}-err`}>
                <NairaInput {...errProps("was")} name="was" value={values.was} onChange={(v) => set("was", v)} />
              </FormField>
            </div>
            {priceN ? (
              <p className="mt-3 text-[13px] text-muted">
                Sells for <b className="text-ink">{formatNaira(priceN)}</b>
                {discount > 0 && (
                  <>
                    {" "}
                    · shows as <b className="text-sale">{discount}% off</b> {formatNaira(wasN!)}
                  </>
                )}
              </p>
            ) : null}
          </Card>

          <Card title="Inventory">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label htmlFor={fieldId("stock")} className={labelCls}>
                  Units in stock <span className="text-sale">*</span>
                </label>
                <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1">
                  <StepButton label="Remove one unit" disabled={!stockN} onClick={() => set("stock", String(Math.max(0, (stockN ?? 0) - 1)))}>
                    <path d="M5 12h14" />
                  </StepButton>
                  <input
                    {...errProps("stock")}
                    name="stock"
                    value={values.stock}
                    inputMode="numeric"
                    onChange={(e) => set("stock", e.target.value)}
                    className={`${s.qty} w-16 bg-transparent text-center text-[16px] font-bold tabular-nums outline-none focus:rounded-md focus:ring-2 focus:ring-accent`}
                  />
                  <StepButton label="Add one unit" disabled={(stockN ?? 0) >= MAX_STOCK} onClick={() => set("stock", String((stockN ?? 0) + 1))}>
                    <path d="M12 5v14M5 12h14" />
                  </StepButton>
                </div>
              </div>
              {product && (
                <dl className="flex gap-6 text-[13px]">
                  <div>
                    <dt className="text-muted">Sold</dt>
                    <dd className="display text-[20px]">{product.sold}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Status</dt>
                    <dd className={`text-[14px] font-bold ${product.stock <= 0 ? "text-sale" : "text-ok"}`}>{product.stock <= 0 ? "Sold out" : "In stock"}</dd>
                  </div>
                </dl>
              )}
            </div>
            {errorFor("stock") && <FieldError id={`${fieldId("stock")}-err`}>{errorFor("stock")}</FieldError>}
            <p className="mt-3 text-[12px] text-muted">
              {product
                ? `Stock changes apply relative to the ${product.stock} ${product.stock === 1 ? "unit" : "units"} in stock when you opened this page, so sales made meanwhile aren't lost. Purchases reduce stock automatically; at 0 the product shows as sold out.`
                : "Purchases reduce stock automatically. At 0 the product shows as sold out and can't be bought."}
            </p>
          </Card>

          <Card title="Media">
            <div role="tablist" aria-label="Image source" className="mb-4 flex gap-1 rounded-full bg-stage p-1">
              {(
                [
                  ["commons", "Commons"],
                  ["url", "Image URL"],
                  ["upload", "Upload"],
                ] as [ImageTab, string][]
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${uid}-panel`}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-full px-3 py-2 text-[13px] font-bold transition-colors ${tab === t ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tab}`}>
              {tab === "commons" && (
                <FormField
                  label="Commons file name"
                  hint="Paste a file name like Apple_iPhone_15_Pro.jpg, or a commons.wikimedia.org link. Credits are shown on the product page."
                  error={errorFor("photo")}
                  errId={`${fieldId("photo")}-err`}
                >
                  <div className="flex gap-2">
                    <input
                      {...errProps("photo")}
                      value={values.photo}
                      onChange={(e) => set("photo", e.target.value)}
                      onBlur={() => values.photo && set("photo", normaliseCommonsFile(values.photo))}
                      placeholder="Apple_iPhone_15_Pro.jpg"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <a
                      href={`https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=image&search=${encodeURIComponent(values.name || values.brand || "phone")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline shrink-0 px-4!"
                    >
                      Search <span className="sr-only">Wikimedia Commons (opens in a new tab)</span>
                      <span aria-hidden>↗</span>
                    </a>
                  </div>
                </FormField>
              )}
              {tab === "url" && (
                <FormField label="Image URL" hint="Any https:// image link. It's used instead of the Commons photo." error={errorFor("imageUrl")} errId={`${fieldId("imageUrl")}-err`}>
                  <input {...errProps("imageUrl")} value={values.imageUrl} onChange={(e) => set("imageUrl", e.target.value.trim())} placeholder="https://…" inputMode="url" className={inputCls} />
                </FormField>
              )}
              {tab === "upload" &&
                (blobEnabled ? (
                  <ImageUpload
                    onUploaded={(url) => {
                      set("imageUrl", url);
                      toast.push("Photo uploaded. Save to keep it.");
                    }}
                  />
                ) : (
                  <div className="rounded-2xl bg-[#eef3ff] p-4 text-[14px] text-accent-deep">
                    <p className="font-bold">Uploads aren&apos;t switched on yet</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">
                      <li>In Vercel, open your project → Storage → Create → Blob.</li>
                      <li>Connect the store to this project. That adds BLOB_READ_WRITE_TOKEN.</li>
                      <li>Redeploy. This tab will then accept photos up to 5 MB.</li>
                    </ol>
                    <p className="mt-2 text-[13px]">Until then, use a Commons file or paste an image URL.</p>
                  </div>
                ))}
            </div>

            {values.imageUrl && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.imageUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg bg-stage object-cover" />
                <div className="min-w-0 flex-1 text-[12px]">
                  <p className="font-bold text-ink">{isBlobUrl(values.imageUrl) ? "Uploaded photo" : "Image URL"} in use</p>
                  <p className="truncate text-muted">{values.imageUrl}</p>
                </div>
                <button type="button" onClick={() => set("imageUrl", "")} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold text-sale hover:bg-[#fde8ef]">
                  Remove
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <p className={labelCls}>Fallback illustration</p>
              <p className="-mt-1 mb-3 text-[12px] text-muted">Shown when there&apos;s no photo or it can&apos;t load.</p>
              <div role="radiogroup" aria-label="Illustration" className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                {ART_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={values.art === k}
                    aria-label={k}
                    title={k}
                    onClick={() => set("art", k)}
                    className={`grid aspect-square place-items-center rounded-xl border bg-stage transition-colors ${values.art === k ? "border-accent ring-1 ring-accent" : "border-transparent hover:border-line"}`}
                  >
                    <DeviceArt kind={k} tint={values.tint || "#2a2a2a"} className="h-4/5 w-4/5" />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[13px] font-bold text-ink-2">Tint</span>
                {TINTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-label={`Tint ${t}`}
                    aria-pressed={values.tint.toLowerCase() === t}
                    onClick={() => set("tint", t)}
                    style={{ background: t }}
                    className={`h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110 ${values.tint.toLowerCase() === t ? "ring-2 ring-accent ring-offset-2" : ""}`}
                  />
                ))}
                <label className="ml-1 inline-flex items-center gap-2 text-[13px] text-muted">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(values.tint) ? values.tint : "#2a2a2a"} onChange={(e) => set("tint", e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-white" />
                  Custom
                </label>
              </div>
            </div>
          </Card>

          <Card
            title="Attributes"
            actions={
              missingTemplate.length > 0 && (
                <button type="button" onClick={applyTemplate} className="rounded-full border border-line px-3 py-1.5 text-[13px] font-bold hover:border-ink">
                  Add {CATEGORY_LABEL[values.category as CategorySlug] ?? ""} fields
                </button>
              )
            }
          >
            <p className="-mt-2 mb-3 text-[13px] text-muted">Listed in the specs table on the product page. Suggested for this category: {template.join(", ")}.</p>
            {values.attrs.length > 0 && (
              <div className="space-y-2" id={fieldId("attrs")}>
                <datalist id={`${uid}-attr-keys`}>
                  {template.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
                {values.attrs.map((a, i) => (
                  <div key={a.key} className="flex items-start gap-2 rounded-xl max-sm:bg-stage/60 max-sm:p-2">
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <input
                      name="attrKey"
                      value={a.k}
                      list={`${uid}-attr-keys`}
                      aria-label={`Attribute ${i + 1} name`}
                      placeholder="Name"
                      maxLength={40}
                      onChange={(e) => set("attrs", values.attrs.map((x) => (x.key === a.key ? { ...x, k: e.target.value } : x)))}
                      className={`${inputCls} font-bold`}
                    />
                    <input
                      name="attrValue"
                      value={a.v}
                      aria-label={`${a.k || `Attribute ${i + 1}`} value`}
                      placeholder="Value"
                      maxLength={200}
                      onChange={(e) => set("attrs", values.attrs.map((x) => (x.key === a.key ? { ...x, v: e.target.value } : x)))}
                      className={inputCls}
                    />
                    </div>
                    <button
                      type="button"
                      onClick={() => set("attrs", values.attrs.filter((x) => x.key !== a.key))}
                      aria-label={`Remove ${a.k || `attribute ${i + 1}`}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-stage hover:text-sale"
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errorFor("attrs") && <FieldError id={`${fieldId("attrs")}-err`}>{errorFor("attrs")}</FieldError>}
            <button
              type="button"
              onClick={() => set("attrs", [...values.attrs, { key: rowKey(), k: "", v: "" }])}
              className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-ink underline-offset-4 hover:underline"
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add attribute
            </button>
          </Card>

          <Card title="Seller and location">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Seller" required error={errorFor("seller")} errId={`${fieldId("seller")}-err`}>
                <input {...errProps("seller")} name="seller" list={`${uid}-sellers`} value={values.seller} onChange={(e) => set("seller", e.target.value)} maxLength={80} className={inputCls} />
                <datalist id={`${uid}-sellers`}>
                  {suggestions.sellers.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="Ships from" required error={errorFor("state")} errId={`${fieldId("state")}-err`}>
                <select {...errProps("state")} name="state" value={values.state} onChange={(e) => set("state", e.target.value)} className={selectCls}>
                  {!SHIP_STATES.includes(values.state) && <option value={values.state}>{values.state || "Choose a state"}</option>}
                  {SHIP_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </FormField>
              <Toggle name="verified" label="Verified seller" hint="Shows the blue verified mark on cards." checked={values.verified} onChange={(v) => set("verified", v)} />
            </div>
          </Card>

          {aside && <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">{aside}</div>}
        </div>

        {/* ------------------------------------------------ side column */}
        <div className="min-w-0 space-y-6 lg:self-stretch">
          <Card title="Status">
            <fieldset>
              <legend className="sr-only">Status</legend>
              <div className="space-y-2" id={fieldId("status")}>
                {STATUS_OPTIONS.map((o) => (
                  <label key={o.value} className="block cursor-pointer">
                    <input type="radio" name="status" value={o.value} checked={values.status === o.value} onChange={() => set("status", o.value)} className="peer sr-only" />
                    <span className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-[#999] peer-checked:border-accent peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      <span
                        aria-hidden
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${o.value === "active" ? "bg-ok" : o.value === "draft" ? "bg-[#f59e0b]" : "bg-[#9a9a9a]"}`}
                      />
                      <span>
                        <span className="block text-[14px] font-bold">{o.label}</span>
                        <span className="block text-[12px] text-muted">{o.hint}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <Toggle name="featured" label="Featured" hint="Eligible for home page showcases." checked={values.featured} onChange={(v) => set("featured", v)} />
              <FormField label="Badge" error={errorFor("badge")} errId={`${fieldId("badge")}-err`}>
                <select {...errProps("badge")} name="badge" value={values.badge} onChange={(e) => set("badge", e.target.value)} className={selectCls}>
                  <option value="">No badge</option>
                  {BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </Card>

          <section aria-label="Live preview" className={`${s.stage} overflow-hidden rounded-2xl border border-line p-5 lg:sticky lg:top-20`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold">Preview</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${values.status === "active" ? "bg-[#e6f6ee] text-ok" : "bg-white text-muted"}`}>
                {values.status === "active" ? "Visible on store" : "Hidden from store"}
              </span>
            </div>
            <CartProvider>
              {/* The preview is a picture of the card: not focusable or clickable. */}
              <div inert className={`${s.previewCard} mx-auto max-w-[300px] select-none`}>
                <div key={previewSrc} className={s.previewPop}>
                  <ProductCard item={preview} />
                </div>
              </div>
            </CartProvider>
            <p className="mt-3 text-center text-[12px] text-muted">How the card appears in the store grid.</p>
          </section>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <p className="mr-auto flex min-w-0 items-center gap-2 text-[13px]" aria-live="polite">
            {saving ? (
              <span className="text-muted">Saving…</span>
            ) : dirty ? (
              <>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" />
                <span className="truncate font-bold">
                  Unsaved<span className="hidden sm:inline"> changes</span>
                </span>
              </>
            ) : state.ok ? (
              <span className={`${s.checkIn} flex min-w-0 items-center gap-1.5 font-bold text-ok`}>
                <Icon name="checkCircle" size={16} className="shrink-0" /> <span className="truncate">Saved</span>
              </span>
            ) : (
              <span className="hidden text-muted sm:inline">
                <kbd className="rounded border border-line px-1 text-[11px]">⌘S</kbd> to save
              </span>
            )}
          </p>
          {product && (
            <>
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="btn shrink-0 border-transparent px-3! text-sale hover:bg-[#fde8ef] disabled:bg-transparent sm:px-4!">
                Delete
              </button>
              {product.status === "active" ? (
                <span className="hidden md:contents">
                  <a href={`/product/${product.id}`} target="_blank" rel="noreferrer" className="btn btn-outline px-4!">
                    View on store <span aria-hidden>↗</span>
                  </a>
                </span>
              ) : null}
              <button type="submit" name="intent" value="duplicate" disabled={busy} className="btn btn-outline shrink-0 px-3! sm:px-4!">
                Save as new
              </button>
            </>
          )}
          <button type="submit" name="intent" value="save" disabled={busy} className="btn btn-primary shrink-0 px-5! sm:min-w-28">
            {saving ? "Saving…" : mode === "create" ? "Create product" : "Save"}
          </button>
        </div>
      </div>

      {product && (
        <Dialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          tone="danger"
          title={`Delete ${product.name}?`}
          description={
            <>
              This removes it from the store and the admin and can&apos;t be undone. Past orders keep their details. To hide it but keep it, set the status to <b>Archived</b>.
            </>
          }
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                className="btn bg-sale text-white hover:bg-[#b8003c]"
                onClick={() =>
                  startDelete(async () => {
                    setBaseline(snapshot(values)); // don't warn about unsaved changes on the way out
                    const res = await deleteProductAction(product.id);
                    if (res && !res.ok) {
                      setConfirmDelete(false);
                      toast.push(res.error, "error");
                    }
                  })
                }
              >
                {deleting ? "Deleting…" : "Delete product"}
              </button>
            </>
          }
        />
      )}
    </form>
  );
}

// ------------------------------------------------------------------ pieces

function FormField({
  label,
  hint,
  error,
  errId,
  required,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  errId: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = errId.replace(/-err$/, "");
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label} {required && <span className="text-sale">*</span>}
      </label>
      {children}
      {error ? <FieldError id={errId}>{error}</FieldError> : hint ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-[12px] font-bold text-sale">
      <Icon name="alert" size={14} /> {children}
    </p>
  );
}

function NairaInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void; name: string; id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted">
        ₦
      </span>
      <input
        {...rest}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const next = grouped(value);
          if (next !== value) onChange(next);
        }}
        className={`${inputCls} pl-8 font-bold tabular-nums`}
      />
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-2"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {children}
      </svg>
    </button>
  );
}

function Toggle({ name, label, hint, checked, onChange }: { name: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[14px] font-bold">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <input type="checkbox" name={name} value="1" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" role="switch" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-[#d4d4d4] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-ink peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2"
      />
    </label>
  );
}
