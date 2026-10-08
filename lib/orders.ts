import "server-only";

import { priceCart, type CartLineInput, type PricedCart } from "./pricing";
import {
  bumpOfferStat,
  getOffer,
  getOfferStats,
  getOrder,
  getProducts,
  getSettings,
  listOrders,
  logAudit,
  nextOrderId,
  releaseStock,
  reserveStock,
  saveOrder,
  withLock,
} from "./store";
import type { DeliveryMethod, Order, OrderStatus, PaymentMethod } from "./types";

// Order lifecycle. All stock movement for orders goes through this module:
//   placeOrder      reserves stock atomically (sold-out items can't be bought twice)
//   transitionOrder restores stock exactly once when an order is cancelled/refunded
//   sweepExpiredOrders cancels unpaid orders whose reservation window has passed

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "shipped", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid (in escrow)",
  processing: "Processing",
  shipped: "Shipped / ready at hub",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const RESTOCK_ON: OrderStatus[] = ["cancelled", "refunded"];

export type PlaceOrderInput = {
  items: CartLineInput[];
  offerCode?: string;
  customer: Order["customer"];
  delivery: DeliveryMethod;
  pickupHub?: string;
  paymentMethod: PaymentMethod;
  customerNote?: string;
};

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; cart?: PricedCart; soldOutId?: string };

/** Price the cart against live data, reserve stock and create the order. */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  if (!input.items.length) return { ok: false, error: "Your cart is empty." };
  if (input.items.length > 50) return { ok: false, error: "Too many items in one order." };

  // Opportunistically free stock held by abandoned orders before checking availability.
  await sweepExpiredOrders().catch(() => undefined);

  const [products, settings] = await Promise.all([getProducts(input.items.map((i) => i.productId)), getSettings()]);
  const offer = input.offerCode ? await getOffer(input.offerCode) : null;
  const stats = offer ? await getOfferStats(offer.code) : undefined;
  const nowMs = Date.now();

  const cart = priceCart({
    items: input.items,
    products,
    offer: offer ?? undefined,
    offerOrders: stats?.orders,
    offerCodeSupplied: !!input.offerCode,
    settings,
    delivery: input.delivery,
    state: input.customer.state,
    now: nowMs,
  });

  if (!cart.ok) {
    const bad = cart.lines.find((l) => l.problem);
    const name = bad?.product.name ?? "An item";
    const msg =
      bad?.problem === "sold-out" || bad?.problem === "missing" || bad?.problem === "inactive"
        ? `${name} has just sold out.`
        : bad?.problem === "insufficient"
          ? `Only ${bad.available} of ${name} left.`
          : "Some items in your cart are no longer available.";
    return { ok: false, error: msg, cart, soldOutId: bad?.product.id };
  }

  const reservation = await reserveStock(cart.lines.map((l) => ({ productId: l.product.id, qty: l.qty })));
  if (!reservation.ok) {
    const name = products.get(reservation.id)?.name ?? "An item";
    return {
      ok: false,
      error: reservation.available > 0 ? `Only ${reservation.available} of ${name} left.` : `${name} has just sold out.`,
      cart,
      soldOutId: reservation.id,
    };
  }

  const createdAt = new Date(nowMs).toISOString();
  const order: Order = {
    id: await nextOrderId(),
    token: crypto.randomUUID().replace(/-/g, ""),
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    lines: cart.lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      spec: l.product.spec,
      photo: l.product.photo,
      imageUrl: l.product.imageUrl,
      qty: l.qty,
      unitPrice: l.unitPrice,
      finalUnitPrice: l.finalUnitPrice,
    })),
    subtotal: cart.subtotal,
    discount: cart.discount,
    deliveryFee: cart.deliveryFee,
    total: cart.total,
    offerCode: cart.offer?.code,
    customer: input.customer,
    delivery: input.delivery,
    pickupHub: input.delivery === "pickup" ? input.pickupHub : undefined,
    payment: { method: input.paymentMethod },
    customerNote: input.customerNote,
    reservedUntil: new Date(nowMs + settings.reservationMinutes * 60_000).toISOString(),
    history: [{ at: createdAt, status: "pending", by: "customer", note: "Order placed, stock reserved" }],
  };

  try {
    await saveOrder(order);
  } catch (e) {
    // Never strand reserved stock if the order can't be written.
    await releaseStock(order.lines);
    throw e;
  }

  if (order.offerCode) {
    await Promise.all([bumpOfferStat(order.offerCode, "orders", 1), bumpOfferStat(order.offerCode, "revenue", order.total)]).catch(() => undefined);
  }

  return { ok: true, order };
}

/**
 * Move an order to a new status, restoring stock exactly once on cancel/refund.
 * Throws if the transition isn't allowed.
 */
export async function transitionOrder(
  id: string,
  next: OrderStatus,
  by: string,
  opts: { note?: string; paymentReference?: string; force?: boolean } = {},
): Promise<Order> {
  return withLock(`order:${id.toUpperCase()}`, () => transitionLocked(id, next, by, opts));
}

async function transitionLocked(
  id: string,
  next: OrderStatus,
  by: string,
  opts: { note?: string; paymentReference?: string; force?: boolean },
): Promise<Order> {
  const order = await getOrder(id);
  if (!order) throw new Error(`Order ${id} not found`);
  if (order.status === next) return order;
  if (!opts.force && !ORDER_FLOW[order.status].includes(next)) {
    throw new Error(`Can't move an order from "${STATUS_LABEL[order.status]}" to "${STATUS_LABEL[next]}".`);
  }

  const at = new Date().toISOString();
  const updated: Order = {
    ...order,
    status: next,
    history: [...order.history, { at, status: next, by, note: opts.note }],
  };

  if (next === "paid") {
    updated.payment = { ...order.payment, paidAt: at, reference: opts.paymentReference ?? order.payment.reference };
    updated.reservedUntil = undefined;
  }

  if (RESTOCK_ON.includes(next) && !order.restocked) {
    updated.restocked = true;
    await saveOrder(updated); // mark first, so a crash can't cause a double restock
    await releaseStock(order.lines);
    if (order.offerCode) {
      await Promise.all([bumpOfferStat(order.offerCode, "orders", -1), bumpOfferStat(order.offerCode, "revenue", -order.total)]).catch(() => undefined);
    }
    await logAudit({ by, action: `order.${next}`, target: order.id, detail: "Stock restored" }).catch(() => undefined);
    return updated;
  }

  const saved = await saveOrder(updated);
  await logAudit({ by, action: `order.${next}`, target: order.id, detail: opts.note }).catch(() => undefined);
  return saved;
}

export async function addOrderNote(id: string, by: string, note: string) {
  return withLock(`order:${id.toUpperCase()}`, async () => {
    const order = await getOrder(id);
    if (!order) throw new Error(`Order ${id} not found`);
    return saveOrder({ ...order, history: [...order.history, { at: new Date().toISOString(), status: "note", by, note }] });
  });
}

/** Cancel unpaid orders past their reservation window and restock them. Returns how many. */
export async function sweepExpiredOrders(): Promise<number> {
  const nowMs = Date.now();
  const expired = (await listOrders()).filter((o) => o.status === "pending" && o.reservedUntil && Date.parse(o.reservedUntil) < nowMs);
  for (const o of expired) {
    await transitionOrder(o.id, "cancelled", "system", { note: "Payment window expired; stock released" }).catch(() => undefined);
  }
  return expired.length;
}

/** Look up an order for a customer-facing page. Requires the secret token. */
export async function getOrderForCustomer(id: string, token: string) {
  const order = await getOrder(id);
  if (!order || !token || order.token !== token) return null;
  return order;
}

/** Order lookup by id + phone (for /track), comparing the last 10 digits of the phone. */
export async function findOrderByPhone(id: string, phone: string) {
  const order = await getOrder(id);
  const last10 = (s: string) => s.replace(/\D/g, "").slice(-10);
  if (!order || last10(order.customer.phone) !== last10(phone) || last10(phone).length < 10) return null;
  return order;
}
