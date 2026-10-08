"use server";

import {
  hubState,
  normalizePhone,
  STATES,
  validateCheckout,
  type CheckoutInput,
  type CheckoutPreview,
  type PreviewInput,
  type PreviewLine,
  type SubmitResult,
} from "@/components/checkout/shared";
import { TAGS } from "@/lib/data";
import { placeOrder } from "@/lib/orders";
import { initializeTransaction, paystackEnabled, requestOrigin, siteUrl } from "@/lib/paystack";
import { describeDiscount, priceCart, type PricedCart } from "@/lib/pricing";
import { refreshFromAction } from "@/lib/revalidate";
import { getOffer, getOfferStats, getProducts, getSettings, logAudit, normalizeCode } from "@/lib/store";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

// Checkout Server Actions. Everything the client sends is treated as untrusted:
// items are re-priced against live stock/offers and every field is re-validated.

const MAX_LINES = 50;
const MAX_QTY = 20;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanItems(raw: unknown): { productId: string; qty: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { productId: string; qty: number }[] = [];
  for (const r of raw.slice(0, MAX_LINES)) {
    if (!r || typeof r !== "object") continue;
    const { productId, qty } = r as { productId?: unknown; qty?: unknown };
    const id = str(productId, 80);
    const q = typeof qty === "number" && Number.isFinite(qty) ? Math.floor(qty) : 0;
    if (!/^[a-z0-9-]+$/i.test(id) || q < 1) continue;
    out.push({ productId: id, qty: Math.min(q, MAX_QTY) });
  }
  return out;
}

const cleanDelivery = (v: unknown): DeliveryMethod => (v === "pickup" ? "pickup" : "delivery");

const OFFER_MESSAGES: Record<NonNullable<PricedCart["offerProblem"]>, string> = {
  "not-found": "We couldn't find that code.",
  "not-live": "This offer isn't running right now.",
  "min-subtotal": "Add a little more to your cart to use this offer.",
  "no-eligible-items": "This offer doesn't cover the items in your cart.",
};

function toPreview(cart: PricedCart, freeDeliveryOver: number, minSubtotal?: number): CheckoutPreview {
  const lines: PreviewLine[] = cart.lines.map((l) => ({
    productId: l.product.id,
    name: l.product.name ?? "Unavailable item",
    spec: l.product.spec ?? "",
    photo: l.product.photo,
    imageUrl: l.product.imageUrl,
    art: l.product.art ?? "phone",
    tint: l.product.tint ?? "#cccccc",
    category: l.product.category,
    qty: l.qty,
    unitPrice: l.unitPrice,
    finalUnitPrice: l.finalUnitPrice,
    lineTotal: l.lineTotal,
    offerApplied: l.offerApplied,
    problem: l.problem,
    available: l.available,
  }));
  let offerMessage = cart.offerProblem ? OFFER_MESSAGES[cart.offerProblem] : undefined;
  if (cart.offerProblem === "min-subtotal" && minSubtotal) {
    offerMessage = `Spend ₦${minSubtotal.toLocaleString("en-NG")} or more to use this offer.`;
  }
  return {
    lines,
    subtotal: cart.subtotal,
    discount: cart.discount,
    deliveryFee: cart.deliveryFee,
    total: cart.total,
    freeDeliveryOver,
    offer: cart.offer ? { code: cart.offer.code, title: cart.offer.title, label: describeDiscount(cart.offer) } : undefined,
    offerProblem: cart.offerProblem,
    offerMessage,
    ok: cart.ok,
  };
}

async function price(input: { items: { productId: string; qty: number }[]; offerCode: string; delivery: DeliveryMethod; state: string }) {
  const [products, settings] = await Promise.all([getProducts(input.items.map((i) => i.productId)), getSettings()]);
  const offer = input.offerCode ? await getOffer(input.offerCode) : null;
  const stats = offer ? await getOfferStats(offer.code) : undefined;
  const cart = priceCart({
    items: input.items,
    products,
    offer: offer ?? undefined,
    offerOrders: stats?.orders,
    offerCodeSupplied: !!input.offerCode,
    settings,
    delivery: input.delivery,
    state: input.state,
    now: Date.now(),
  });
  return toPreview(cart, settings.freeDeliveryOver, offer?.minSubtotal);
}

/** Live, server-priced summary for the cart drawer and the checkout page. */
export async function previewCheckout(input: PreviewInput): Promise<CheckoutPreview> {
  const items = cleanItems(input?.items);
  const state = STATES.includes(str(input?.state, 40)) ? str(input?.state, 40) : "Lagos";
  const offerCode = normalizeCode(str(input?.offerCode, 60));
  return price({ items, offerCode, delivery: cleanDelivery(input?.delivery), state });
}

/** Validate, reserve stock and create the order. Stock is taken atomically by placeOrder. */
export async function submitOrder(raw: CheckoutInput): Promise<SubmitResult> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Something went wrong. Please try again." };
  // Bots fill every field; pretend nothing happened.
  if (str(raw.company, 100)) return { ok: false, error: "Please check your details and try again." };

  const settings = await getSettings();
  const paystack = paystackEnabled();
  const delivery = cleanDelivery(raw.delivery);
  const payment = (["paystack", "transfer", "whatsapp"] as const).includes(raw.payment) ? (raw.payment as PaymentMethod) : ("" as PaymentMethod);
  const input = {
    name: str(raw.name, 80),
    phone: str(raw.phone, 30),
    email: str(raw.email, 120),
    address: str(raw.address, 200),
    city: str(raw.city, 60),
    state: str(raw.state, 40),
    delivery,
    pickupHub: str(raw.pickupHub, 80),
    payment,
  };

  const errors = validateCheckout(input, { hubs: settings.hubs, paystack });
  const first = Object.entries(errors)[0];
  if (first) return { ok: false, error: first[1], field: first[0] as keyof CheckoutInput };

  const items = cleanItems(raw.items);
  if (!items.length) return { ok: false, error: "Your cart is empty." };

  const hub = delivery === "pickup" ? settings.hubs.find((h) => h.city === input.pickupHub) : undefined;
  const state = hub ? (hubState(hub) ?? (STATES.includes(input.state) ? input.state : "Lagos")) : input.state;
  const offerCode = normalizeCode(str(raw.offerCode, 60)) || undefined;

  const result = await placeOrder({
    items,
    offerCode,
    customer: {
      name: input.name,
      phone: normalizePhone(input.phone)!,
      email: input.email || undefined,
      address: delivery === "delivery" ? input.address : undefined,
      city: delivery === "delivery" ? input.city : hub?.city,
      state,
    },
    delivery,
    pickupHub: hub?.city,
    paymentMethod: payment,
    customerNote: str(raw.note, 500) || undefined,
  });

  if (!result.ok) {
    const preview = result.cart
      ? toPreview(result.cart, settings.freeDeliveryOver)
      : await price({ items, offerCode: offerCode ?? "", delivery, state });
    return { ok: false, error: result.error, preview };
  }

  const { order } = result;
  // Stock changed: refresh product pages, grids and offer counters right away.
  refreshFromAction(TAGS.catalog, TAGS.offers);
  await logAudit({
    by: "customer",
    action: "order.placed",
    target: order.id,
    detail: `${order.lines.reduce((s, l) => s + l.qty, 0)} item(s), ₦${order.total.toLocaleString("en-NG")}, ${payment}`,
  }).catch(() => undefined);

  const orderUrl = `/order/${order.id}?t=${order.token}`;
  if (payment === "paystack") {
    const init = await initializeTransaction(order, siteUrl(await requestOrigin()));
    if (init.ok) return { ok: true, redirectTo: init.url, orderId: order.id, external: true };
    // The order is reserved either way; the order page offers "Pay now" to retry.
    return { ok: true, redirectTo: `${orderUrl}&pay=failed`, orderId: order.id, external: false };
  }
  return { ok: true, redirectTo: orderUrl, orderId: order.id, external: false };
}
