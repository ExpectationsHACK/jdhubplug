// Checkout types and validation shared by the client form and the Server Actions.
// Isomorphic: no server imports. The server always re-runs these checks.

import { states } from "@/lib/reference";
import type { ArtKind, CategorySlug, DeliveryMethod, Hub, PaymentMethod } from "@/lib/types";

export type LineProblem = "missing" | "inactive" | "sold-out" | "insufficient";

export type PreviewLine = {
  productId: string;
  name: string;
  spec: string;
  photo?: string;
  imageUrl?: string;
  art: ArtKind;
  tint: string;
  category?: CategorySlug;
  qty: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  offerApplied: boolean;
  problem?: LineProblem;
  available: number;
};

export type CheckoutPreview = {
  lines: PreviewLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  /** 0 when free delivery is switched off. */
  freeDeliveryOver: number;
  offer?: { code: string; title: string; label: string };
  offerProblem?: "not-found" | "not-live" | "min-subtotal" | "no-eligible-items";
  offerMessage?: string;
  ok: boolean;
};

export type PreviewInput = {
  items: { productId: string; qty: number }[];
  offerCode?: string | null;
  delivery?: DeliveryMethod;
  state?: string;
};

export type CheckoutInput = PreviewInput & {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state: string;
  delivery: DeliveryMethod;
  pickupHub?: string;
  payment: PaymentMethod;
  note?: string;
  /** Honeypot: real shoppers never see or fill this. */
  company?: string;
  /** PostHog distinct id, so the server-side order event joins this visitor's journey. */
  analyticsId?: string;
};

export type SubmitResult =
  | { ok: true; redirectTo: string; orderId: string; external: boolean }
  | { ok: false; error: string; field?: keyof CheckoutInput; preview?: CheckoutPreview };

export const STATES = states;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  paystack: "Card, bank or USSD (Paystack)",
  transfer: "Bank transfer",
  whatsapp: "Pay via WhatsApp",
};

/** Digits-only Nigerian number normalised to +234XXXXXXXXXX, or null if it can't be one. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  let local: string;
  if (d.startsWith("234") && d.length === 13) local = d.slice(3);
  else if (d.startsWith("0") && d.length === 11) local = d.slice(1);
  else if (d.length === 10 && !d.startsWith("0")) local = d;
  else return null;
  if (!/^[789]\d{9}$/.test(local)) return null;
  return `+234${local}`;
}

export const isEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);

/** The Nigerian state a pickup hub sits in (falls back to the hub city if it's a listed state). */
export function hubState(hub: Pick<Hub, "city">): string | null {
  const c = hub.city.toLowerCase();
  if (c.includes("abuja")) return "Abuja (FCT)";
  if (c.includes("port harcourt") || c.includes("rivers")) return "Rivers";
  if (c.includes("ibadan")) return "Oyo";
  return states.find((s) => s.toLowerCase() === c) ?? null;
}

export type FieldErrors = Partial<Record<"name" | "phone" | "email" | "address" | "city" | "state" | "pickupHub" | "payment", string>>;

/** Contact/delivery/payment checks. Returns an empty object when everything is valid. */
export function validateCheckout(
  input: Pick<CheckoutInput, "name" | "phone" | "email" | "address" | "city" | "state" | "delivery" | "pickupHub" | "payment">,
  ctx: { hubs: Pick<Hub, "city">[]; paystack: boolean },
): FieldErrors {
  const e: FieldErrors = {};
  if (input.name.trim().length < 2) e.name = "Enter your full name.";
  if (!normalizePhone(input.phone)) e.phone = "Enter a Nigerian phone number, e.g. 0803 123 4567.";
  if (input.email?.trim() && !isEmail(input.email.trim())) e.email = "That email doesn't look right.";
  if (input.delivery === "delivery") {
    if (!STATES.includes(input.state)) e.state = "Choose your state.";
    if ((input.address ?? "").trim().length < 5) e.address = "Enter a delivery address.";
    if ((input.city ?? "").trim().length < 2) e.city = "Enter your city or area.";
  } else if (input.delivery === "pickup") {
    if (!ctx.hubs.some((h) => h.city === input.pickupHub)) e.pickupHub = "Choose a pickup hub.";
  } else {
    e.address = "Choose delivery or pickup.";
  }
  const allowed: PaymentMethod[] = ctx.paystack ? ["paystack", "transfer", "whatsapp"] : ["transfer", "whatsapp"];
  if (!allowed.includes(input.payment)) e.payment = "Choose a payment method.";
  return e;
}

export const lineProblemText = (l: Pick<PreviewLine, "problem" | "available">) =>
  l.problem === "insufficient"
    ? `Only ${l.available} left`
    : l.problem === "sold-out"
      ? "Sold out"
      : l.problem
        ? "No longer available"
        : "";
