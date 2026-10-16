"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/admin/(panel)/settings/actions";
import type { Settings } from "@/lib/types";
import { FormField, MoneyInput, Switch, fieldCls } from "./form-bits";
import { naira } from "./format";
import { HeroPicker, type PickerProduct } from "./HeroPicker";
import { HubsEditor } from "./HubsEditor";
import { AdminIcon } from "./icons";
import { LIMITS, normalizeWhatsapp, parseMoney, type SettingsErrors } from "./settings-schema";
import s from "./core.module.css";

/**
 * Store settings form. Submits through onSubmit + startTransition (not `action=`) so a
 * failed validation never wipes what the user typed; after a successful save the fields
 * remount from the saved values, which shows any normalisation (e.g. WhatsApp digits).
 */
export function SettingsForm({ settings, products, readOnly }: { settings: Settings; products: PickerProduct[]; readOnly: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const [, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [seenSavedAt, setSeenSavedAt] = useState<number | undefined>(undefined);
  const [hiddenMsgAt, setHiddenMsgAt] = useState<number | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // A new successful save: clear the dirty flag and remount from the saved values.
  if (state.ok && state.savedAt && state.savedAt !== seenSavedAt) {
    setSeenSavedAt(state.savedAt);
    setDirty(false);
    setFormKey((k) => k + 1);
  }

  // Move focus to the first invalid field so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (state.errors && Object.keys(state.errors).length) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state.errors]);

  // Fade the success message after a few seconds.
  useEffect(() => {
    if (!state.ok || !state.savedAt) return;
    const at = state.savedAt;
    const t = setTimeout(() => setHiddenMsgAt(at), 5000);
    return () => clearTimeout(t);
  }, [state.ok, state.savedAt]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const errors = pending ? undefined : state.errors;
  const markDirty = () => setDirty(true);
  const discard = () => {
    setDirty(false);
    setFormKey((k) => k + 1);
  };

  const showSuccess = !dirty && !pending && state.ok && state.message && state.savedAt !== hiddenMsgAt;
  const showError = !pending && state.ok === false && state.message;
  const barVisible = !readOnly && (dirty || pending || !!showSuccess || !!showError);

  return (
    <form
      key={formKey}
      ref={formRef}
      noValidate
      onInput={(e) => {
        // Only named fields are settings; the hero picker's search box doesn't count.
        if (!readOnly && (e.target as HTMLInputElement).name) markDirty();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="pb-28"
    >
      <fieldset disabled={readOnly} className="min-w-0">
        <legend className="sr-only">Store settings</legend>
        <Fields settings={settings} products={products} errors={errors} readOnly={readOnly} onChange={markDirty} />
      </fieldset>

      {!readOnly && (
        <div
          className={`sticky bottom-4 z-20 mt-8 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${
            barVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
          aria-hidden={!barVisible}
          inert={!barVisible}
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] md:px-5">
            <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 text-[14px] font-bold">
              {pending ? (
                <>
                  <AdminIcon name="refresh" size={16} className="motion-safe:animate-spin" /> Saving…
                </>
              ) : showError ? (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-sale" aria-hidden /> {state.message}
                </>
              ) : dirty ? (
                <>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden /> Unsaved changes
                </>
              ) : showSuccess ? (
                <span className={`flex items-center gap-2 ${s.pop}`}>
                  <AdminIcon name="check" size={16} strokeWidth={2} className="text-[#6ee7a8]" /> {state.message}
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              {dirty && (
                <button type="button" onClick={discard} disabled={pending} className="btn btn-ghost-white min-h-9 px-4 py-2 text-[13px]">
                  Discard
                </button>
              )}
              <button type="submit" disabled={pending || !dirty} className="btn btn-white min-h-9 px-5 py-2 text-[13px] disabled:bg-white/20 disabled:text-white/60">
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Fields({
  settings,
  products,
  errors,
  readOnly,
  onChange,
}: {
  settings: Settings;
  products: PickerProduct[];
  errors?: SettingsErrors;
  readOnly: boolean;
  onChange: () => void;
}) {
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [promo, setPromo] = useState({ enabled: settings.promoEnabled, text: settings.promoText, link: settings.promoLink });
  const [fees, setFees] = useState({
    lagos: String(settings.deliveryFeeLagos),
    other: String(settings.deliveryFeeOther),
    free: String(settings.freeDeliveryOver),
  });

  const wa = normalizeWhatsapp(whatsapp);
  const waPretty = wa.startsWith("234") && wa.length === 13 ? `+234 ${wa.slice(3, 6)} ${wa.slice(6, 9)} ${wa.slice(9)}` : wa ? `+${wa}` : "";
  const free = parseMoney(fees.free);
  const other = parseMoney(fees.other);
  const lagos = parseMoney(fees.lagos);

  return (
    <div className="flex flex-col gap-8">
      <Section id="store" title="Store details" description="How buyers reach you. The WhatsApp number powers every “Chat on WhatsApp” button.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Store name" error={errors?.storeName} className="md:col-span-2">
            <input name="storeName" defaultValue={settings.storeName} maxLength={60} required autoComplete="organization" className={fieldCls(errors?.storeName)} />
          </FormField>
          <FormField
            label="WhatsApp number"
            error={errors?.whatsapp}
            hint={
              waPretty && !errors?.whatsapp ? (
                <span className="flex flex-wrap items-center gap-x-2">
                  Saved as {wa}.
                  {wa.length >= 11 && (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline underline-offset-2">
                      Test link ↗
                    </a>
                  )}
                </span>
              ) : (
                "0803 123 4567 or 2348031234567. We convert it to international format."
              )
            }
          >
            <input
              name="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              maxLength={24}
              className={fieldCls(errors?.whatsapp)}
            />
          </FormField>
          <FormField label="Phone (shown on the site)" error={errors?.phone}>
            <input name="phone" defaultValue={settings.phone} inputMode="tel" autoComplete="tel" maxLength={30} className={fieldCls(errors?.phone)} />
          </FormField>
          <FormField label="Contact email" error={errors?.email} className="md:col-span-2">
            <input name="email" type="email" defaultValue={settings.email} autoComplete="email" maxLength={200} className={fieldCls(errors?.email)} />
          </FormField>
        </div>
      </Section>

      <Section id="promo" title="Promo strip" description="The thin black banner above the storefront navigation.">
        <div className="flex flex-col gap-4">
          <Switch
            name="promoEnabled"
            label="Show the promo strip"
            checked={promo.enabled}
            onChange={(enabled) => {
              setPromo((p) => ({ ...p, enabled }));
              onChange();
            }}
            disabled={readOnly}
          />
          <FormField label="Message" error={errors?.promoText} hint={`${promo.text.length}/160 characters`}>
            <input
              name="promoText"
              value={promo.text}
              onChange={(e) => setPromo((p) => ({ ...p, text: e.target.value }))}
              maxLength={160}
              className={fieldCls(errors?.promoText)}
            />
          </FormField>
          <FormField label="Link" optional error={errors?.promoLink} hint="A site path like /trust or a full https:// link.">
            <input
              name="promoLink"
              value={promo.link}
              onChange={(e) => setPromo((p) => ({ ...p, link: e.target.value }))}
              maxLength={300}
              placeholder="/trust"
              className={fieldCls(errors?.promoLink)}
            />
          </FormField>
          <div>
            <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-muted">Preview</p>
            <div
              className={`flex min-h-10 flex-wrap items-center justify-center gap-x-3 rounded-xl bg-ink px-4 py-2 text-center text-[12px] text-white transition-opacity md:text-[13px] ${
                promo.enabled ? "" : "opacity-40"
              }`}
            >
              <span className="break-words">{promo.text || "Your message"}</span>
              {promo.link && <span className="font-bold underline underline-offset-4">Learn more</span>}
            </div>
            {!promo.enabled && <p className="mt-1 text-[12px] text-muted">Hidden on the storefront.</p>}
          </div>
        </div>
      </Section>

      <Section id="orders" title="Orders & stock" description="Every purchase takes units out of stock instantly. These control when items count as low and how long unpaid orders hold them.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Low-stock alert at" error={errors?.lowStockThreshold} hint="Products with this many units or fewer show as low stock.">
            <input
              name="lowStockThreshold"
              type="number"
              min={0}
              max={LIMITS.lowStock}
              step={1}
              defaultValue={settings.lowStockThreshold}
              className={fieldCls(errors?.lowStockThreshold)}
            />
          </FormField>
          <FormField
            label="Hold unpaid orders for (hours)"
            error={errors?.reservationHours}
            hint="Then they cancel automatically and the items go back on sale. 24 hours suits bank transfers."
          >
            <input
              name="reservationHours"
              type="number"
              min={LIMITS.reservationHours.min}
              max={LIMITS.reservationHours.max}
              step={0.5}
              defaultValue={Math.round((settings.reservationMinutes / 60) * 100) / 100}
              className={fieldCls(errors?.reservationHours)}
            />
          </FormField>
        </div>
      </Section>

      <Section id="delivery" title="Delivery fees" description="Charged at checkout. Pickup from a hub is always free.">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Lagos" error={errors?.deliveryFeeLagos}>
            <MoneyInput name="deliveryFeeLagos" value={fees.lagos} onChange={(e) => setFees((f) => ({ ...f, lagos: e.target.value }))} error={errors?.deliveryFeeLagos} />
          </FormField>
          <FormField label="Other states" error={errors?.deliveryFeeOther}>
            <MoneyInput name="deliveryFeeOther" value={fees.other} onChange={(e) => setFees((f) => ({ ...f, other: e.target.value }))} error={errors?.deliveryFeeOther} />
          </FormField>
          <FormField label="Free delivery from" error={errors?.freeDeliveryOver} hint="0 turns free delivery off.">
            <MoneyInput name="freeDeliveryOver" value={fees.free} onChange={(e) => setFees((f) => ({ ...f, free: e.target.value }))} error={errors?.freeDeliveryOver} />
          </FormField>
        </div>
        {Number.isFinite(lagos) && Number.isFinite(other) && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-stage px-3 py-2.5 text-[13px] text-ink-2">
            <AdminIcon name="truck" size={16} className="mt-0.5 shrink-0" />
            <span>
              Delivery costs {naira(lagos)} in Lagos and {naira(other)} elsewhere
              {Number.isFinite(free) && free > 0 ? `, and it's free on orders of ${naira(free)} or more.` : ". There's no free-delivery threshold."}
            </span>
          </p>
        )}
      </Section>

      <Section id="hubs" title="Pickup hubs" description="Buyers can choose to collect from one of these at checkout. Order matters: the first hub is the default.">
        <HubsEditor initial={settings.hubs} errors={errors} disabled={readOnly} onChange={onChange} />
      </Section>

      <Section id="bank" title="Bank transfer" description="Shown to buyers who choose to pay by transfer. Leave all three empty to hide transfer details.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Bank" error={errors?.bankName}>
            <input name="bankName" defaultValue={settings.bank.bankName} maxLength={60} placeholder="e.g. GTBank" className={fieldCls(errors?.bankName)} />
          </FormField>
          <FormField label="Account number" error={errors?.accountNumber} hint="10 digits (NUBAN)">
            <input
              name="accountNumber"
              defaultValue={settings.bank.accountNumber}
              inputMode="numeric"
              maxLength={14}
              autoComplete="off"
              className={`${fieldCls(errors?.accountNumber)} tabular-nums`}
            />
          </FormField>
          <FormField label="Account name" error={errors?.accountName} className="md:col-span-2">
            <input name="accountName" defaultValue={settings.bank.accountName} maxLength={80} placeholder="JDHub Technologies Ltd" className={fieldCls(errors?.accountName)} />
          </FormField>
        </div>
      </Section>

      <Section id="storefront" title="Storefront" description="What shoppers see on the home page and in listings.">
        <div className="flex flex-col gap-6">
          <Switch
            name="hideSoldOut"
            label="Hide sold-out items"
            description="Sold-out products disappear from listings instead of showing a “Sold out” tag. Their pages stay reachable."
            defaultChecked={settings.hideSoldOut}
            disabled={readOnly}
          />
          <Switch
            name="requireAccountForCheckout"
            label="Require sign-in at checkout"
            description="Shoppers confirm their phone or email with a one-time code before placing an order. Needs an SMS (Termii) or email (Resend) key; without one, checkout stays open to guests."
            defaultChecked={settings.requireAccountForCheckout}
            disabled={readOnly}
          />
          <div className="border-t border-line pt-5">
            <p className="text-[14px] font-bold">Hero showcase</p>
            <p className="mb-3 mt-0.5 text-[13px] text-muted">Up to {LIMITS.heroProducts} products, in the order they appear on the home page.</p>
            <HeroPicker products={products} initial={settings.heroProductIds} error={errors?.heroProductIds} disabled={readOnly} onChange={onChange} />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-20 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
      <div>
        <h2 id={`${id}-title`} className="text-[16px] font-bold">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">{description}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-line bg-white p-4 md:p-6">{children}</div>
    </section>
  );
}
