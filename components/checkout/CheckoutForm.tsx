"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { submitOrder } from "@/app/(store)/checkout/actions";
import { useCart } from "@/components/cart/CartProvider";
import { Icon, type IconName } from "@/components/Icon";
import { ProductImage } from "@/components/ProductImage";
import { analyticsId, track } from "@/lib/analytics";
import { formatNaira } from "@/lib/reference";
import type { DeliveryMethod, Hub, PaymentMethod } from "@/lib/types";
import { FreeDeliveryMeter } from "./FreeDeliveryMeter";
import { CommerceMotion } from "./Motion";
import { PLACED_KEY } from "./placed";
import {
  lineProblemText,
  PAYMENT_LABEL,
  STATES,
  validateCheckout,
  type CheckoutPreview,
  type FieldErrors,
  type PreviewLine,
} from "./shared";
import { useCheckoutPreview } from "./usePreview";

export type CheckoutSettings = {
  hubs: Hub[];
  deliveryFeeLagos: number;
  deliveryFeeOther: number;
  freeDeliveryOver: number;
  reservationMinutes: number;
  whatsapp: string;
};

const PAYMENT_INFO: Record<PaymentMethod, { icon: IconName; body: string }> = {
  paystack: { icon: "wallet", body: "Card, bank transfer or USSD on Paystack. Confirmed instantly." },
  transfer: { icon: "store", body: "Transfer to JDHub's escrow account. Use your order number as the reference." },
  whatsapp: { icon: "chat", body: "Chat with our team to pay and arrange delivery." },
};

const holdText = (minutes: number) =>
  minutes >= 60 * 24 && minutes % (60 * 24) === 0
    ? `${minutes / 60 / 24 === 1 ? "24 hours" : `${minutes / 60 / 24} days`}`
    : minutes >= 60
      ? `${Math.round(minutes / 60)} hours`
      : `${minutes} minutes`;

/** Checkout: contact, delivery, payment and a live server-priced summary. */
export type CheckoutPrefill = { name?: string; phone?: string; email?: string; address?: string; city?: string; state?: string };

export function CheckoutForm({ settings, paystack, prefill }: { settings: CheckoutSettings; paystack: boolean; prefill?: CheckoutPrefill }) {
  const cart = useCart();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [f, setF] = useState({
    name: prefill?.name ?? "",
    phone: prefill?.phone ? prefill.phone.replace(/^\+234/, "0") : "",
    email: prefill?.email ?? "",
    address: prefill?.address ?? "",
    city: prefill?.city ?? "",
    state: prefill?.state ?? "Lagos",
    note: "",
    company: "",
    pickupHub: settings.hubs[0]?.city ?? "",
  });
  const [delivery, setDelivery] = useState<DeliveryMethod>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>(paystack ? "paystack" : "transfer");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ msg: string; n: number } | null>(null);
  const [codeDraft, setCodeDraft] = useState<string | null>(null);

  const items = useMemo(() => cart.items.map((i) => ({ productId: i.product.id, qty: i.qty })), [cart.items]);

  // Funnel step: once per visit to checkout, after the cart has loaded.
  const tracked = useRef(false);
  useEffect(() => {
    if (!cart.hydrated || tracked.current || !cart.items.length) return;
    tracked.current = true;
    track("checkout_started", { items: cart.count, value: cart.subtotal, currency: "NGN", offer_code: cart.offerCode ?? undefined, signed_in: !!prefill });
  }, [cart.hydrated, cart.items.length, cart.count, cart.subtotal, cart.offerCode, prefill]);
  const { preview, loading, error: previewError, seed, refresh } = useCheckoutPreview(
    cart.hydrated && !placed ? { items, offerCode: cart.offerCode, delivery, state: f.state } : null,
  );

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k as keyof FieldErrors]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCheckout({ ...f, delivery, payment }, { hubs: settings.hubs, paystack });
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      setFormError({ msg: "Please check the highlighted fields.", n: Date.now() });
      return;
    }
    if (preview && !preview.ok) {
      setFormError({ msg: "Fix the items marked in your order summary first.", n: Date.now() });
      document.getElementById("summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setFormError(null);
    startTransition(async () => {
      try {
        const res = await submitOrder({ ...f, delivery, payment, items, offerCode: cart.offerCode, analyticsId: analyticsId() });
        if (res.ok) {
          setPlaced(true);
          try {
            sessionStorage.setItem(PLACED_KEY, res.orderId);
          } catch {
            /* storage unavailable: skip the celebration */
          }
          cart.clear();
          cart.setOfferCode(null);
          if (res.external) window.location.assign(res.redirectTo);
          else router.push(res.redirectTo);
          return;
        }
        if (res.preview) seed(res.preview);
        if (res.field) setErrors({ [res.field]: res.error } as FieldErrors);
        setFormError({ msg: res.error, n: Date.now() });
      } catch {
        setFormError({ msg: "We couldn't place your order. Check your connection and try again.", n: Date.now() });
        refresh();
      }
    });
  };

  if (!cart.hydrated) return <CheckoutSkeleton />;

  if (placed) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center" role="status" aria-live="polite">
        <CommerceMotion />
        <div>
          <span className="jdc-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-white">
            <Icon name="check" size={30} strokeWidth={2.25} />
          </span>
          <p className="display mt-6 text-[26px]">Order placed.</p>
          <p className="mt-2 text-ink-2">{payment === "paystack" ? "Taking you to Paystack…" : "Opening your order…"}</p>
        </div>
      </div>
    );
  }

  if (!cart.items.length) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-stage">
            <Icon name="cart" size={34} strokeWidth={1.25} />
          </span>
          <h2 className="display mt-6 text-[26px]">Your cart is empty.</h2>
          <p className="mt-2 text-ink-2">Add a graded phone, gadget or car to check out.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="btn btn-primary btn-lg">
              Shop all
            </Link>
            <Link href="/track" className="btn btn-outline btn-lg">
              Track an order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cartById = new Map(cart.items.map((i) => [i.product.id, i.product]));
  const appliedCode = cart.offerCode;
  const code = codeDraft ?? appliedCode ?? "";
  const problems = preview?.lines.filter((l) => l.problem) ?? [];

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
      <CommerceMotion />
      {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" name="company" value={f.company} onChange={set("company")} />
        </label>
      </div>

      <div className="min-w-0 space-y-4">
        {/* Mobile jump to summary */}
        <a href="#summary" className="flex items-center justify-between rounded-tile bg-stage px-5 py-4 text-[14px] lg:hidden">
          <span className="flex items-center gap-2 font-bold">
            <Icon name="cart" size={18} /> {cart.count} item{cart.count === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1 font-bold">
            {preview ? formatNaira(preview.total) : "…"} <Icon name="chevronDown" size={16} />
          </span>
        </a>

        <Section n={1} title="Contact" delay={0}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" error={errors.name}>
              <input name="name" autoComplete="name" value={f.name} onChange={set("name")} className="field" maxLength={80} />
            </Field>
            <Field label="Phone / WhatsApp" name="phone" error={errors.phone} hint="We'll call or WhatsApp delivery updates.">
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                value={f.phone}
                onChange={set("phone")}
                className="field"
                maxLength={20}
              />
            </Field>
            <Field label="Email (optional)" name="email" error={errors.email} className="sm:col-span-2" hint="For your receipt.">
              <input name="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} className="field" maxLength={120} />
            </Field>
          </div>
        </Section>

        <Section n={2} title="Delivery" delay={80}>
          <div role="radiogroup" aria-label="Delivery method" className="grid gap-3 sm:grid-cols-2">
            <Choice name="delivery" value="delivery" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} icon="truck" title="Deliver to me">
              {settings.freeDeliveryOver > 0
                ? `1–3 days. Free over ${formatNaira(settings.freeDeliveryOver)}.`
                : `1–3 days from ${formatNaira(settings.deliveryFeeLagos)}.`}
            </Choice>
            <Choice name="delivery" value="pickup" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} icon="store" title="Pick up at a hub">
              Free. Inspect before you take it home.
            </Choice>
          </div>

          {delivery === "delivery" ? (
            <div key="d" className="jdc-in-up mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Delivery address" name="address" error={errors.address} className="sm:col-span-2">
                <input
                  name="address"
                  autoComplete="street-address"
                  placeholder="House number, street, landmark"
                  value={f.address}
                  onChange={set("address")}
                  className="field"
                  maxLength={200}
                />
              </Field>
              <Field label="City / area" name="city" error={errors.city}>
                <input name="city" autoComplete="address-level2" placeholder="e.g. Ikeja" value={f.city} onChange={set("city")} className="field" maxLength={60} />
              </Field>
              <Field label="State" name="state" error={errors.state} hint={`Lagos ${formatNaira(settings.deliveryFeeLagos)} · other states ${formatNaira(settings.deliveryFeeOther)}`}>
                <select name="state" autoComplete="address-level1" value={f.state} onChange={set("state")} className="field">
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <fieldset key="p" className="jdc-in-up mt-5">
              <legend className="mb-3 text-[14px] font-bold">Choose a hub</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {settings.hubs.map((h) => (
                  <Choice
                    key={h.city}
                    name="pickupHub"
                    value={h.city}
                    checked={f.pickupHub === h.city}
                    onChange={() => setF((s) => ({ ...s, pickupHub: h.city }))}
                    icon="pin"
                    title={h.city}
                  >
                    {h.address}
                    <span className="mt-1 block text-muted">{h.hours}</span>
                  </Choice>
                ))}
              </div>
              {errors.pickupHub && <p className="mt-2 text-[13px] font-bold text-sale">{errors.pickupHub}</p>}
            </fieldset>
          )}
        </Section>

        <Section n={3} title="Payment" delay={160}>
          <div role="radiogroup" aria-label="Payment method" className="grid gap-3">
            {(paystack ? (["paystack", "transfer", "whatsapp"] as const) : (["transfer", "whatsapp"] as const)).map((m) => (
              <Choice key={m} name="payment" value={m} checked={payment === m} onChange={() => setPayment(m)} icon={PAYMENT_INFO[m].icon} title={PAYMENT_LABEL[m]}>
                {PAYMENT_INFO[m].body}
              </Choice>
            ))}
          </div>
          {errors.payment && <p className="mt-2 text-[13px] font-bold text-sale">{errors.payment}</p>}
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-stage p-4 text-[13px] text-ink-2">
            <Icon name="shield" size={18} className="mt-px shrink-0" />
            <span>
              Your money is held in escrow. The seller is paid only after you confirm the item matches its grade. Items are reserved for{" "}
              {holdText(settings.reservationMinutes)} while you pay.
            </span>
          </p>
        </Section>

        <Section n={4} title="Order note" optional delay={240}>
          <label htmlFor="note" className="sr-only">
            Order note
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Delivery instructions, a preferred time, or a question for us."
            value={f.note}
            onChange={set("note")}
            className="field"
          />
        </Section>
      </div>

      {/* ------------------------------------------------------------ Summary */}
      <aside id="summary" aria-label="Order summary" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
        <div className="jdc-in-up rounded-tile bg-stage p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold">Order summary</h2>
            <span className="text-[13px] text-muted" aria-live="polite">
              {loading ? "Updating…" : `${cart.count} item${cart.count === 1 ? "" : "s"}`}
            </span>
          </div>

          {problems.length > 0 && (
            <div role="alert" className="jdc-shake mt-4 rounded-xl border border-sale/30 bg-white p-3 text-[13px]">
              <p className="flex items-center gap-2 font-bold text-sale">
                <Icon name="alert" size={18} /> {problems.length === 1 ? "One item needs attention" : `${problems.length} items need attention`}
              </p>
              <p className="mt-1 text-ink-2">Someone bought these while you were shopping. Fix them below to continue.</p>
            </div>
          )}

          <ul className="mt-4 divide-y divide-line/80">
            {(
              preview?.lines.map((l) => ({ productId: l.productId, qty: l.qty, line: l as PreviewLine | null })) ??
              cart.items.map((i) => ({ productId: i.product.id, qty: i.qty, line: null }))
            ).map((raw, i) => {
              const l = raw.line;
              const p = cartById.get(raw.productId);
              const img = { photo: l?.photo ?? p?.photo, imageUrl: l?.imageUrl ?? p?.imageUrl, art: l?.art ?? p?.art ?? "phone", tint: l?.tint ?? p?.tint ?? "#ccc", name: (l?.name !== "Unavailable item" ? l?.name : undefined) ?? p?.name ?? "Item" };
              return (
                <li key={raw.productId} className="jdc-in-right flex gap-3 py-3" style={{ animationDelay: `${180 + i * 60}ms` }}>
                  <div className="relative shrink-0">
                    <div className={`h-16 w-16 overflow-hidden rounded-xl bg-white ${l?.problem ? "opacity-50 grayscale" : ""}`}>
                      <ProductImage item={img} width={250} className="h-16 w-16" artClassName="h-12 w-12" />
                    </div>
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
                      {raw.qty}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[14px] font-bold">{img.name}</p>
                    <p className="line-clamp-1 text-[12px] text-muted">{l?.spec ?? p?.spec}</p>
                    {l?.problem && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sale px-2 py-0.5 text-[11px] font-bold text-white">{lineProblemText(l)}</span>
                        {l.problem === "insufficient" ? (
                          <button type="button" onClick={() => cart.setQty(l.productId, l.available)} className="text-[12px] font-bold underline underline-offset-2">
                            Reduce to {l.available}
                          </button>
                        ) : (
                          <button type="button" onClick={() => cart.remove(l.productId)} className="text-[12px] font-bold underline underline-offset-2">
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[14px]">
                    {l ? (
                      l.problem ? (
                        <span className="text-muted line-through">{formatNaira(l.unitPrice * l.qty)}</span>
                      ) : (
                        <>
                          <p className="font-bold">{formatNaira(l.lineTotal)}</p>
                          {l.offerApplied && <p className="text-[12px] text-muted line-through">{formatNaira(l.unitPrice * l.qty)}</p>}
                        </>
                      )
                    ) : (
                      <span className="jdc-skeleton inline-block h-4 w-16 rounded" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <OfferCode
            value={code}
            applied={appliedCode}
            preview={preview}
            loading={loading}
            onChange={setCodeDraft}
            onApply={(c) => {
              cart.setOfferCode(c || null);
              setCodeDraft(null);
            }}
            onRemove={() => {
              cart.setOfferCode(null);
              setCodeDraft("");
            }}
          />

          <dl className={`mt-5 space-y-2 border-t border-line pt-4 text-[14px] transition-opacity ${loading ? "opacity-60" : ""}`}>
            <Row label="Subtotal" value={preview ? formatNaira(preview.subtotal) : null} />
            {preview && preview.discount > 0 && (
              <Row label={`Offer${preview.offer ? ` · ${preview.offer.code.toUpperCase()}` : ""}`} value={`−${formatNaira(preview.discount)}`} accent />
            )}
            <Row
              label={delivery === "pickup" ? "Hub pickup" : `Delivery · ${f.state}`}
              value={preview ? (preview.deliveryFee === 0 ? "Free" : formatNaira(preview.deliveryFee)) : null}
            />
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-[15px] font-bold">Total</dt>
              <dd className="display text-[26px]" aria-live="polite">
                {preview ? formatNaira(preview.total) : <span className="jdc-skeleton inline-block h-7 w-32 rounded" />}
              </dd>
            </div>
          </dl>

          {/* Free delivery is judged on the subtotal before offers (see deliveryFeeFor). */}
          {preview && preview.subtotal > 0 && delivery === "delivery" && (
            <FreeDeliveryMeter subtotal={preview.subtotal} threshold={preview.freeDeliveryOver} className="mt-4" />
          )}

          {previewError && (
            <p className="mt-3 text-[13px] text-sale">
              Couldn&apos;t refresh prices.{" "}
              <button type="button" onClick={refresh} className="font-bold underline">
                Retry
              </button>
            </p>
          )}

          {formError && (
            <p key={formError.n} role="alert" className="jdc-shake mt-4 flex items-start gap-2 rounded-xl bg-sale/10 p-3 text-[13px] font-bold text-sale">
              <Icon name="alert" size={18} className="shrink-0" /> {formError.msg}
            </p>
          )}

          <button type="submit" disabled={pending || !preview || problems.length > 0} className="btn btn-primary btn-lg mt-5 w-full">
            {pending ? (
              <>
                <Spinner /> Placing order…
              </>
            ) : payment === "paystack" ? (
              <>Pay {preview ? formatNaira(preview.total) : ""}</>
            ) : (
              "Place order"
            )}
          </button>
          <p className="mt-3 text-center text-[12px] text-muted">
            By placing your order you agree to JDHub&apos;s escrow and{" "}
            <Link href="/trust" className="underline underline-offset-2">
              7-day return terms
            </Link>
            .
          </p>
        </div>

        <ul className="mt-4 grid gap-2 px-1 text-[13px] text-ink-2">
          <li className="flex items-center gap-2">
            <Icon name="shield" size={18} /> Escrow-protected. Pay with confidence.
          </li>
          <li className="flex items-center gap-2">
            <Icon name="scan" size={18} /> Every unit graded and IMEI / serial checked.
          </li>
          <li className="flex items-center gap-2">
            <Icon name="swap" size={18} /> 7-day returns if it isn&apos;t as described.
          </li>
        </ul>
      </aside>
    </form>
  );
}

function OfferCode({
  value,
  applied,
  preview,
  loading,
  onChange,
  onApply,
  onRemove,
}: {
  value: string;
  applied: string | null;
  preview: CheckoutPreview | null;
  loading: boolean;
  onChange: (v: string) => void;
  onApply: (v: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const editing = value.trim().toLowerCase() !== (applied ?? "").toLowerCase();
  const ok = !!applied && !!preview?.offer && !loading;
  const problem = !!applied && !loading && !editing && preview?.offerMessage;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <label htmlFor={id} className="text-[13px] font-bold">
        Offer code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply(value.trim());
            }
          }}
          placeholder="Enter code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-invalid={!!problem}
          aria-describedby={`${id}-msg`}
          className="field min-w-0 flex-1 bg-white uppercase placeholder:normal-case"
        />
        {applied && !editing ? (
          <button type="button" onClick={onRemove} className="btn btn-outline shrink-0">
            Remove
          </button>
        ) : (
          <button type="button" onClick={() => onApply(value.trim())} disabled={!value.trim()} className="btn btn-primary shrink-0">
            Apply
          </button>
        )}
      </div>
      <p id={`${id}-msg`} aria-live="polite" className="mt-2 min-h-0 text-[13px]">
        {ok && !editing && (
          <span className="jdc-pop inline-flex items-center gap-1.5 font-bold text-accent">
            <Icon name="tag" size={16} /> {preview!.offer!.title}: {preview!.offer!.label}
          </span>
        )}
        {problem && <span className="font-bold text-sale">{preview!.offerMessage}</span>}
      </p>
    </div>
  );
}

function Section({ n, title, optional, delay, children }: { n: number; title: string; optional?: boolean; delay: number; children: React.ReactNode }) {
  return (
    <section className="jdc-in-up rounded-tile border border-line p-5 sm:p-6" style={{ animationDelay: `${delay}ms` }} aria-labelledby={`co-${n}`}>
      <h2 id={`co-${n}`} className="mb-5 flex items-center gap-3 text-[18px] font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[13px] text-white">{n}</span>
        {title}
        {optional && <span className="text-[13px] font-normal text-muted">Optional</span>}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  const id = `f-${name}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold">
        {label}
      </label>
      <div className={error ? "[&_.field]:border-sale" : ""}>
        {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      </div>
      {error ? (
        <p id={`${id}-err`} className="jdc-in-up mt-1.5 text-[12px] font-bold text-sale">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition-[border-color,box-shadow] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        checked ? "border-accent shadow-[inset_0_0_0_1px_var(--accent)]" : "border-line hover:border-[#999]"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${checked ? "bg-ink text-white" : "bg-stage"}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 text-[13px] text-ink-2">
        <span className="block text-[14px] font-bold text-ink">{title}</span>
        {children}
      </span>
      <span aria-hidden className={`ml-auto mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-accent" : "border-line"}`}>
        {checked && <span className="jdc-pop h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`font-bold ${accent ? "text-accent" : ""}`}>{value ?? <span className="jdc-skeleton inline-block h-4 w-20 rounded" />}</dd>
    </div>
  );
}

export function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />;
}

export function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12" aria-busy="true" aria-label="Loading checkout">
      <CommerceMotion />
      <div className="space-y-4">
        {[220, 260, 200].map((h, i) => (
          <div key={i} className="jdc-skeleton rounded-tile" style={{ height: h }} />
        ))}
      </div>
      <div className="jdc-skeleton h-[420px] rounded-tile" />
    </div>
  );
}
