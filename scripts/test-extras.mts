// Back-in-stock alerts and wishlist tests against the in-memory store.
// Run: npm run test:extras
process.env.JDHUB_MEMORY_ONLY = "1";
// No email/SMS provider: alerts must be recorded as attempted ("skipped"), never as sent.
delete process.env.RESEND_API_KEY;
delete process.env.TERMII_API_KEY;

import { createStockAlert, getStockAlert, listStockAlerts, MAX_ALERTS_PER_CONTACT, processStockAlerts, waitlistDemand } from "../lib/stock-alerts";
import { getProduct, listProducts, saveProducts, setStock } from "../lib/store";
import { mergeWishlist, setWishlistItem, WISHLIST_MAX, getWishlist } from "../lib/wishlist";
import type { Product } from "../lib/types";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok  ", m); };

// ---------------------------------------------------------------- Alerts
const all = await listProducts();
const base = (await getProduct("iphone-13-1"))!;
assert(base, "seeded product exists");
const model = base.model;
const units = all.filter((p) => p.model === model);
for (const u of units) await setStock(u.id, 0);
const p = (await getProduct(base.id))!;
assert(p.stock === 0, `every ${model} unit sold out (${units.length} units)`);

const a1 = await createStockAlert({ product: p, channel: "email", contact: "ada@example.com" });
const a2 = await createStockAlert({ product: p, channel: "email", contact: "ada@example.com" });
assert(a1.ok && a2.ok && a2.duplicate && a1.alert.id === a2.alert.id, "same contact + model is deduplicated");
const a3 = await createStockAlert({ product: p, channel: "sms", contact: "+2348031234567" });
assert(a3.ok && !a3.duplicate, "another contact gets its own alert");
if (units.length > 1) {
  const other = (await getProduct(units.find((u) => u.id !== p.id)!.id))!;
  const a4 = await createStockAlert({ product: other, channel: "email", contact: "ada@example.com", exact: true });
  assert(a4.ok && a1.ok && a4.duplicate && a4.alert.id === a1.alert.id && a4.alert.exact && a4.alert.productId === other.id, "asking again from another listing updates the alert, not a new one");
  await createStockAlert({ product: p, channel: "email", contact: "ada@example.com", exact: false });
}
assert((await listStockAlerts()).filter((a) => a.model === model).length === 2, "two alerts stored for the model");

const demand = (await waitlistDemand()).find((d) => d.model === model);
assert(demand && demand.waiting === 2 && demand.inStock === 0, `waitlistDemand counts waiting alerts (${JSON.stringify(demand)})`);

const none = await processStockAlerts();
assert(none.matched === 0 && none.sent === 0, "nothing sent while the model is sold out");

await setStock(p.id, 1);
// Two runs at once: the lock lets only one of them message anyone.
const [r1, r2] = await Promise.all([processStockAlerts(), processStockAlerts()]);
const attempted = r1.sent + r1.skipped + r2.sent + r2.skipped;
assert(attempted === 2 && r1.sent + r2.sent === 0, `each alert attempted exactly once, none falsely "sent" (${JSON.stringify([r1, r2])})`);
const after1 = (await getStockAlert(a1.ok ? a1.alert.id : ""))!;
assert(after1.status === "skipped" && after1.attempts === 1 && after1.notifiedProductId === p.id && !!after1.notifiedAt, `stored status skipped with history (${after1.status}, ${after1.history.map((h) => h.event).join(">")})`);
const again = await processStockAlerts();
assert(again.matched === 0 && again.skipped === 0, "a second run sends nothing (idempotent)");
assert((await waitlistDemand()).every((d) => d.model !== model), "notified model leaves the demand list");

const a5 = await createStockAlert({ product: p, channel: "email", contact: "ada@example.com" });
assert(a5.ok && !a5.duplicate && a5.inStockNow === 1, "after notifying, the shopper can sign up again (told a unit is in stock)");
const ignored = await processStockAlerts();
assert(ignored.matched === 0, "units already in stock at sign-up don't trigger the new alert");

// Exact-listing alerts ignore other units of the model.
const [x, y] = units;
if (x && y) {
  await setStock(x.id, 0);
  await setStock(y.id, 0);
  const ex = await createStockAlert({ product: (await getProduct(x.id))!, channel: "email", contact: "exact@example.com", exact: true });
  await setStock(y.id, 1);
  await processStockAlerts({ model });
  assert(ex.ok && (await getStockAlert(ex.alert.id))!.status === "waiting", "exact alert not triggered by another unit");
  await setStock(x.id, 1);
  const r = await processStockAlerts({ model });
  assert(r.matched >= 1 && ex.ok && (await getStockAlert(ex.alert.id))!.status === "skipped", "exact alert triggered when that listing returns");
}

// Cap per contact.
const models = [...new Map(all.map((q) => [q.model, q])).values()].filter((q) => q.model !== model);
let capped = false;
for (let i = 0; i < MAX_ALERTS_PER_CONTACT + 1 && i < models.length; i++) {
  const r = await createStockAlert({ product: models[i], channel: "email", contact: "busy@example.com" });
  if (!r.ok) capped = i === MAX_ALERTS_PER_CONTACT;
}
assert(capped, `at most ${MAX_ALERTS_PER_CONTACT} waiting alerts per contact`);

// ---------------------------------------------------------------- Wishlist
const ids = all.map((q) => q.id);
const merged = await mergeWishlist("C-TEST", [ids[0], ids[1], "no-such-product", "../../etc", 42, ids[0]]);
assert(merged.length === 2 && merged[0] === ids[0] && merged[1] === ids[1], `merge drops unknown/invalid ids and duplicates (${merged.join(",")})`);
const merged2 = await mergeWishlist("C-TEST", [ids[2], ids[1]]);
assert(merged2.join() === [ids[2], ids[0], ids[1]].join(), "merging again adds only new local items, newest first");
const removed = await setWishlistItem("C-TEST", ids[0], false);
assert(!removed.includes(ids[0]) && removed.length === 2, "remove one item");
const unknown = await setWishlistItem("C-TEST", "ghost-product", true);
assert(unknown.length === 2, "adding a product that doesn't exist is ignored");

// Make sure there are more than WISHLIST_MAX products, then merge them all.
if (ids.length <= WISHLIST_MAX + 5) {
  const extra: Product[] = Array.from({ length: WISHLIST_MAX + 10 - ids.length }, (_, i) => ({ ...base, id: `wish-extra-${i}`, stock: 1, createdAt: "", updatedAt: "" }));
  await saveProducts(extra);
  ids.push(...extra.map((e) => e.id));
}
const big = await mergeWishlist("C-CAP", ids);
assert(big.length === WISHLIST_MAX && big[0] === ids[0], `merge caps at ${WISHLIST_MAX} (got ${big.length})`);
const plus = await setWishlistItem("C-CAP", ids[ids.length - 1], true);
assert(plus.length === WISHLIST_MAX && plus[0] === ids[ids.length - 1], "adding to a full list keeps the cap, newest first");
assert((await getWishlist("C-CAP")).join() === plus.join(), "server copy persisted");
