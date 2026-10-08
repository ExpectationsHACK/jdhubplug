// Order/stock/offer integration test against the in-memory store.
// Run: npm run test:orders
process.env.JDHUB_MEMORY_ONLY = "1";
import { placeOrder, transitionOrder, sweepExpiredOrders } from "../lib/orders";
import { setStock, getProduct, saveOffer, getOfferStats, getSettings, saveSettings, getOrder, saveOrder } from "../lib/store";

const cust = { name: "Ada", phone: "08031234567", state: "Lagos", address: "1 Allen Ave" };
const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

const id = "iphone-13-1";
const before = await getProduct(id);
assert(before && before.stock === 1, `seeded ${id} stock=1 (got ${before?.stock})`);

// Two buyers race for the last unit.
const [a, b] = await Promise.all([
  placeOrder({ items: [{ productId: id, qty: 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" }),
  placeOrder({ items: [{ productId: id, qty: 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" }),
]);
assert([a, b].filter((r) => r.ok).length === 1, "exactly one of two concurrent buyers gets the last unit");
const loser = [a, b].find((r) => !r.ok)!;
assert(!loser.ok && /sold out/.test(loser.error), `loser told it sold out: ${!loser.ok && loser.error}`);
const after = await getProduct(id);
assert(after!.stock === 0 && after!.sold === 1, `stock 0 sold 1 after purchase (got ${after!.stock}/${after!.sold})`);

const won = (a.ok ? a : b) as Extract<typeof a, { ok: true }>;
assert(won.order.total === won.order.subtotal + won.order.deliveryFee, "total = subtotal + delivery");
await transitionOrder(won.order.id, "cancelled", "test");
await transitionOrder(won.order.id, "cancelled", "test"); // idempotent
const restocked = await getProduct(id);
assert(restocked!.stock === 1 && restocked!.sold === 0, `cancel restores stock once (got ${restocked!.stock}/${restocked!.sold})`);

let threw = false;
try { await transitionOrder(won.order.id, "paid", "test"); } catch { threw = true; }
assert(threw, "can't pay a cancelled order");

// Offer: 10% off phones, usage limit 1.
const now = Date.now();
await saveOffer({ code: "Phone10", title: "t", headline: "h", description: "d", discount: { type: "percent", value: 10 }, scope: { type: "categories", categories: ["phones"] }, startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 86400000).toISOString(), active: true, usageLimit: 1, createdAt: "", updatedAt: "" });
const o1 = await placeOrder({ items: [{ productId: id, qty: 1 }, { productId: "airpods-pro-2-1", qty: 2 }], offerCode: "PHONE10", customer: cust, delivery: "pickup", pickupHub: "Lagos", paymentMethod: "transfer" });
assert(o1.ok, `offer order placed ${!o1.ok ? o1.error : ""}`);
if (o1.ok) {
  const phone = o1.order.lines.find((l) => l.productId === id)!;
  const pods = o1.order.lines.find((l) => l.productId !== id)!;
  assert(phone.finalUnitPrice === Math.round(phone.unitPrice * 0.9 / 50) * 50, `phone discounted 10% (${phone.unitPrice} -> ${phone.finalUnitPrice})`);
  assert(pods.finalUnitPrice === pods.unitPrice, "accessory not discounted by phones-only offer");
  assert(o1.order.deliveryFee === 0, "pickup has no delivery fee");
  assert(o1.order.offerCode === "phone10", "offer code normalised on order");
  const st = await getOfferStats("phone10");
  assert(st.orders === 1 && st.revenue === o1.order.total, `offer stats recorded ${JSON.stringify(st)}`);
}
// Usage limit reached -> offer no longer applies, order still placed at full price? (offer not-live -> order placed without discount)
const o2 = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], offerCode: "phone10", customer: cust, delivery: "delivery", paymentMethod: "transfer" });
assert(o2.ok && !o2.order.offerCode && o2.order.discount === 0, "exhausted offer not applied");

// Over-ordering stock
await setStock("airpods-pro-2-1", 4);
const pods = await getProduct("airpods-pro-2-1");
const big = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: pods!.stock + 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" });
assert(!big.ok && /Only/.test(big.error), `can't order more than in stock: ${!big.ok && big.error}`);

// Reservation expiry
const s = await getSettings(); await saveSettings({ ...s, reservationMinutes: 0 });
const exp = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], customer: cust, delivery: "delivery", paymentMethod: "transfer" });
const stockBeforeSweep = (await getProduct("airpods-pro-2-1"))!.stock;
await new Promise((r) => setTimeout(r, 20));
const n = await sweepExpiredOrders();
const stockAfterSweep = (await getProduct("airpods-pro-2-1"))!.stock;
assert(n >= 1 && stockAfterSweep > stockBeforeSweep, `expired unpaid orders cancelled and restocked (${n} swept, stock ${stockBeforeSweep}->${stockAfterSweep})`);
if (exp.ok) assert((await getOrder(exp.order.id))!.status === "cancelled", "expired order marked cancelled");
// Paid orders are never swept
if (o1.ok) { await transitionOrder(o1.order.id, "paid", "test", { paymentReference: "ref1" }); const p = await getOrder(o1.order.id); assert(p!.status === "paid" && !p!.reservedUntil && p!.payment.paidAt, "paid order clears reservation"); }
