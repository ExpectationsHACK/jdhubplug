// Offer and cart pricing. Isomorphic: the client uses it for previews, the server
// re-runs it at checkout against fresh store data, so the client can never set prices.

import type { Offer, OfferState, OfferStats, Product, Settings } from "./types";

export function offerState(offer: Offer, now: number, stats?: Pick<OfferStats, "orders">): OfferState {
  if (!offer.active) return "paused";
  if (now < Date.parse(offer.startsAt)) return "scheduled";
  if (now >= Date.parse(offer.endsAt)) return "expired";
  if (offer.usageLimit !== undefined && stats && stats.orders >= offer.usageLimit) return "exhausted";
  return "live";
}

export function offerAppliesTo(offer: Offer, p: Pick<Product, "id" | "category" | "brand">): boolean {
  const s = offer.scope;
  switch (s.type) {
    case "all":
      return true;
    case "categories":
      return s.categories.includes(p.category);
    case "brands":
      return s.brands.some((b) => b.toLowerCase() === p.brand.toLowerCase());
    case "products":
      return s.productIds.includes(p.id);
  }
}

/** Unit price after the offer, never below ₦0 and never above the normal price. */
export function offerUnitPrice(offer: Offer, price: number): number {
  const d = offer.discount;
  let next = price;
  if (d.type === "percent") next = price * (1 - Math.min(100, Math.max(0, d.value)) / 100);
  if (d.type === "fixed") next = price - d.value;
  if (d.type === "price") next = d.value;
  // Round to the nearest ₦50 so offer prices read cleanly.
  return Math.max(0, Math.min(price, Math.round(next / 50) * 50));
}

export function describeDiscount(offer: Pick<Offer, "discount">): string {
  const d = offer.discount;
  if (d.type === "percent") return `${d.value}% off`;
  if (d.type === "fixed") return `₦${d.value.toLocaleString("en-NG")} off`;
  return `Flash price ₦${d.value.toLocaleString("en-NG")}`;
}

export type CartLineInput = { productId: string; qty: number };

export type PricedLine = {
  product: Product;
  qty: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  offerApplied: boolean;
  /** Set when the line can't be bought as requested. */
  problem?: "missing" | "inactive" | "sold-out" | "insufficient";
  available: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  offer?: Offer;
  /** Why a supplied offer code didn't apply, if it didn't. */
  offerProblem?: "not-found" | "not-live" | "min-subtotal" | "no-eligible-items";
  ok: boolean;
};

export function deliveryFeeFor(settings: Settings, method: "delivery" | "pickup", state: string, subtotal: number) {
  if (method === "pickup") return 0;
  if (settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver) return 0;
  return state === "Lagos" ? settings.deliveryFeeLagos : settings.deliveryFeeOther;
}

/**
 * Price a cart. `products` should be a lookup of current product data; `offer` is the
 * offer resolved from the code the shopper supplied (or undefined).
 */
export function priceCart(opts: {
  items: CartLineInput[];
  products: Map<string, Product> | Record<string, Product>;
  offer?: Offer;
  offerOrders?: number;
  offerCodeSupplied?: boolean;
  settings: Settings;
  delivery: "delivery" | "pickup";
  state: string;
  now: number;
}): PricedCart {
  const get = (id: string) =>
    opts.products instanceof Map ? opts.products.get(id) : (opts.products as Record<string, Product>)[id];

  const merged = new Map<string, number>();
  for (const i of opts.items) {
    const q = Math.max(0, Math.floor(i.qty));
    if (q > 0) merged.set(i.productId, (merged.get(i.productId) ?? 0) + q);
  }

  let offer = opts.offer;
  let offerProblem: PricedCart["offerProblem"];
  if (opts.offerCodeSupplied && !offer) offerProblem = "not-found";
  if (offer && offerState(offer, opts.now, { orders: opts.offerOrders ?? 0 }) !== "live") {
    offerProblem = "not-live";
    offer = undefined;
  }

  const lines: PricedLine[] = [];
  for (const [productId, qty] of merged) {
    const product = get(productId);
    if (!product) {
      lines.push({
        product: { id: productId } as Product,
        qty,
        unitPrice: 0,
        finalUnitPrice: 0,
        lineTotal: 0,
        offerApplied: false,
        problem: "missing",
        available: 0,
      });
      continue;
    }
    const problem: PricedLine["problem"] =
      product.status !== "active" ? "inactive" : product.stock <= 0 ? "sold-out" : product.stock < qty ? "insufficient" : undefined;
    lines.push({
      product,
      qty,
      unitPrice: product.price,
      finalUnitPrice: product.price,
      lineTotal: product.price * qty,
      offerApplied: false,
      problem,
      available: Math.max(0, product.stock),
    });
  }

  const subtotal = lines.reduce((s, l) => s + (l.problem ? 0 : l.unitPrice * l.qty), 0);

  if (offer) {
    const eligible = lines.filter((l) => !l.problem && offerAppliesTo(offer!, l.product));
    if (offer.minSubtotal && subtotal < offer.minSubtotal) {
      offerProblem = "min-subtotal";
      offer = undefined;
    } else if (!eligible.length) {
      offerProblem = "no-eligible-items";
      offer = undefined;
    } else {
      for (const l of eligible) {
        l.finalUnitPrice = offerUnitPrice(offer, l.unitPrice);
        l.lineTotal = l.finalUnitPrice * l.qty;
        l.offerApplied = l.finalUnitPrice < l.unitPrice;
      }
    }
  }

  const discounted = lines.reduce((s, l) => s + (l.problem ? 0 : l.lineTotal), 0);
  const discount = subtotal - discounted;
  const deliveryFee = lines.some((l) => !l.problem) ? deliveryFeeFor(opts.settings, opts.delivery, opts.state, subtotal) : 0;

  return {
    lines,
    subtotal,
    discount,
    deliveryFee,
    total: discounted + deliveryFee,
    offer,
    offerProblem,
    ok: lines.length > 0 && lines.every((l) => !l.problem),
  };
}
