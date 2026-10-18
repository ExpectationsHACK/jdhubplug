// Verified-review integration test against the in-memory store.
// Run: npm run test:reviews
process.env.JDHUB_MEMORY_ONLY = "1";
import { placeOrder, transitionOrder } from "../lib/orders";
import {
  applyToAggregate,
  checkEligibility,
  getAggregate,
  getRatingSummaries,
  getReview,
  rebuildAggregates,
  reviewsForLines,
  saveReviewSettings,
  setReviewReply,
  setReviewStatus,
  submitReview,
} from "../lib/reviews";
import { cleanText, displayName, emptyAggregate, reviewLinkFor } from "../lib/reviews-shared";
import { getOrder, getProduct, setStock } from "../lib/store";
import type { Order } from "../lib/types";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

const cust = { name: "Ada  Okafor-Bello", phone: "08031234567", state: "Lagos", address: "1 Allen Ave" };
const pid = "airpods-pro-2-1";
const model = (await getProduct(pid))!.model; // seeds the store first
await setStock(pid, 10);

async function deliveredOrder(): Promise<Order> {
  const r = await placeOrder({ items: [{ productId: pid, qty: 1 }], customer: cust, delivery: "pickup", pickupHub: "Lagos", paymentMethod: "transfer" });
  if (!r.ok) throw new Error(r.error);
  return r.order;
}
async function deliver(id: string) {
  for (const s of ["paid", "processing", "shipped", "delivered"] as const) await transitionOrder(id, s, "test");
  return (await getOrder(id))!;
}
const input = (o: Order, rating: number, body = "Exactly as graded, battery is great.") => ({ orderId: o.id, token: o.token, productId: pid, rating, title: "Lovely", body });

// --- Eligibility
const o1 = await deliveredOrder();
const early = await submitReview(input(o1, 5));
assert(!early.ok && /delivered/.test(early.error), `not delivered -> rejected (${!early.ok && early.error})`);
assert(!(await checkEligibility(await getOrder(o1.id), pid)).ok, "checkEligibility rejects a pending order");

const badToken = await submitReview({ ...input(o1, 5), token: "0".repeat(32) });
assert(!badToken.ok && badToken.error === "Order not found.", "wrong token -> rejected");

await deliver(o1.id);
const wrongLine = await submitReview({ ...input(o1, 5), productId: "iphone-13-1" });
assert(!wrongLine.ok, "item not on the order -> rejected");
const badRating = await submitReview(input(o1, 6));
assert(!badRating.ok && badRating.field === "rating", "rating outside 1-5 -> rejected");
const shortBody = await submitReview(input(o1, 5, "ok"));
assert(!shortBody.ok && shortBody.field === "body", "too-short body -> rejected");
const longBody = await submitReview(input(o1, 5, "x".repeat(5000)));
assert(!longBody.ok && longBody.field === "body", "too-long body -> rejected");

const r1 = await submitReview(input(o1, 5, "Great\u0000 unit‮.\n\n\n\nWould buy again."));
assert(r1.ok, `delivered -> accepted ${!r1.ok ? r1.error : ""}`);
if (!r1.ok) throw new Error("cannot continue");
assert(r1.review.status === "pending", "moderation is the default (pending)");
assert(r1.review.verified === true && r1.review.productModel === model, "review is verified and attached to the model");
assert(r1.review.name === "Ada O.", `name shown is first name + last initial (${r1.review.name})`);
assert(r1.review.body === "Great unit.\n\nWould buy again.", `control chars stripped, blank lines collapsed (${JSON.stringify(r1.review.body)})`);
assert(cleanText("<b>hi</b>", 100) === "<b>hi</b>", "markup kept as text (escaped on render)");
assert(displayName("  ") === "Verified buyer" && displayName("tobi") === "Tobi", "displayName fallbacks");

// --- Duplicates
const dup = await submitReview(input(o1, 1));
assert(!dup.ok && /already/.test(dup.error), "second review of the same order line -> rejected");
const [a, b] = await Promise.all([submitReview(input(o1, 2)), submitReview(input(o1, 3))]);
assert(!a.ok && !b.ok, "concurrent duplicates -> rejected");
const lines = await reviewsForLines([{ orderId: o1.id, productId: pid }]);
assert(lines.size === 1, "exactly one review stored for the line");

// --- Aggregates
assert((await getAggregate(model)).count === 0, "pending reviews don't count");
assert(!(await getRatingSummaries())[model], "no summary before anything is published");
await setReviewStatus(r1.review.id, "published", "test");
await setReviewStatus(r1.review.id, "published", "test"); // idempotent
let agg = await getAggregate(model);
assert(agg.count === 1 && agg.sum === 5 && agg.dist[4] === 1, `publish counts once ${JSON.stringify(agg)}`);

const o2 = await deliver((await deliveredOrder()).id);
const r2 = await submitReview(input(o2, 2, "Box was dented but phone fine."));
assert(r2.ok, "second buyer can review the same model");
if (r2.ok) {
  await setReviewStatus(r2.review.id, "published", "test");
  agg = await getAggregate(model);
  assert(agg.count === 2 && agg.sum === 7 && agg.dist[1] === 1, `two published: count 2 sum 7 ${JSON.stringify(agg)}`);
  assert((await getRatingSummaries())[model]?.average === 3.5, "average 3.5");

  await setReviewStatus(r1.review.id, "hidden", "test");
  agg = await getAggregate(model);
  assert(agg.count === 1 && agg.sum === 2 && agg.dist[4] === 0, `hide removes it ${JSON.stringify(agg)}`);
  await setReviewStatus(r1.review.id, "hidden", "test");
  assert((await getAggregate(model)).count === 1, "hiding twice changes nothing");
  await setReviewStatus(r1.review.id, "pending", "test");
  assert((await getAggregate(model)).count === 1, "hidden -> pending doesn't count");

  await setReviewStatus(r2.review.id, "hidden", "test");
  assert((await getAggregate(model)).count === 0 && !(await getRatingSummaries())[model], "all hidden -> no summary");
  await setReviewStatus(r2.review.id, "published", "test");
}
const before = JSON.stringify(await getAggregate(model));
await rebuildAggregates();
assert(JSON.stringify(await getAggregate(model)) === before, "rebuild matches the incremental aggregate");

const math = applyToAggregate(applyToAggregate(emptyAggregate(), 4, "pending", "published"), 4, "published", "hidden");
assert(math.count === 0 && math.sum === 0 && math.dist.every((n) => n === 0), "applyToAggregate round-trips to empty");

// --- Auto-publish
await saveReviewSettings({ autoPublish: true });
const o3 = await deliver((await deliveredOrder()).id);
await transitionOrder(o3.id, "completed", "test");
const r3 = await submitReview(input(o3, 4));
assert(r3.ok && r3.review.status === "published", "auto-publish publishes immediately (completed orders too)");
assert((await getAggregate(model)).count === 2, "auto-published review counted");
await saveReviewSettings({ autoPublish: false });

// --- Reply
if (r3.ok) {
  await setReviewReply(r3.review.id, "  Thanks Ada!\u0007 ", "Owner");
  const withReply = await getReview(r3.review.id);
  assert(withReply?.adminReply?.text === "Thanks Ada!" && withReply.adminReply.by === "Owner", "reply stored and cleaned");
  await setReviewReply(r3.review.id, "", "Owner");
  assert(!(await getReview(r3.review.id))?.adminReply, "empty reply removes it");
}

// --- Refunded orders can't be reviewed
const o4 = await deliver((await deliveredOrder()).id);
await transitionOrder(o4.id, "refunded", "test");
const r4 = await submitReview(input(o4, 1));
assert(!r4.ok, "refunded order -> rejected");

// --- Link helper
const link = reviewLinkFor(o1, "https://jdhub.ng/");
assert(link === `https://jdhub.ng/order/${o1.id}?t=${o1.token}#review`, `reviewLinkFor ${link}`);
