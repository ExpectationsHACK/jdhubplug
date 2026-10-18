// Trade-in pipeline test against the in-memory store: transitions, customer token,
// swap credit (single use) and message logging without providers.
// Run: npm run test:tradein
process.env.JDHUB_MEMORY_ONLY = "1";
delete process.env.RESEND_API_KEY;
delete process.env.TERMII_API_KEY;
delete process.env.SUPABASE_URL;
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

import { placeOrder } from "../lib/orders";
import { createLead, getLead, getOffer, saveLead, setStock } from "../lib/store";
import {
  bookInspection,
  closeLead,
  ensureLeadToken,
  getLeadForCustomer,
  getPayoutAccount,
  initialTradeFields,
  issueSwapCredit,
  markContacted,
  notifyLead,
  recordInspection,
  recordPayout,
  respondToOffer,
  sendOffer,
  syncCreditRedemptions,
  TradeInError,
} from "../lib/tradein";
import { canTransition, normalizeStatus, parseBank, tradeStats } from "../lib/tradein-flow";
import type { InspectionChecklist, Lead } from "../lib/types";

const assert = (c: unknown, m: string) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok  ", m);
};
async function rejects(p: Promise<unknown>, m: string, re?: RegExp) {
  try {
    await p;
    assert(false, `${m} (did not throw)`);
  } catch (e) {
    assert(e instanceof TradeInError && (!re || re.test(e.message)), `${m}${e instanceof Error ? `: ${e.message}` : ""}`);
  }
}

const cust = { name: "Chidi Okeke", phone: "08031234567", message: "Pickup in Yaba" };
const checklist: InspectionChecklist = { imeiClean: true, accountSignedOut: true, screen: "minor", body: "ok", functions: "ok", batteryHealth: 86 };
const newTrade = async (type: "sell" | "swap", details: Record<string, string>, email?: string) => {
  const input = { type, ...cust, email, details };
  return createLead({ ...input, ...initialTradeFields(input) });
};

// ------------------------------------------------------------ Pure rules
assert(canTransition({ type: "sell", status: "new" }, "inspection_booked"), "sell: new → inspection_booked allowed");
assert(!canTransition({ type: "sell", status: "new" }, "paid"), "sell: new → paid refused");
assert(!canTransition({ type: "sell", status: "offer_sent" }, "paid"), "sell: offer_sent → paid refused (must accept first)");
assert(!canTransition({ type: "sell", status: "closed" }, "new"), "sell: closed is terminal");
assert(canTransition({ type: "swap", status: "offer_sent" }, "offer_sent"), "swap: a revised offer can be sent again");
assert(!canTransition({ type: "contact", status: "new" }, "inspection_booked"), "contact leads have no pipeline");
assert(canTransition({ type: "contact", status: "closed" }, "new"), "contact leads can be reopened");
assert(normalizeStatus({ type: "sell", status: "bogus" as Lead["status"] }) === "new", "unknown stored status maps to new");
assert(normalizeStatus({ type: "contact", status: "paid" }) === "new", "trade-only status on a contact lead maps to new");
assert(!parseBank({ bankName: "Zenith Bank", accountNumber: "123456789", accountName: "Chidi Okeke" }).ok, "9-digit account number refused");
assert(!parseBank({ bankName: "Bank of Nowhere", accountNumber: "0123456789", accountName: "Chidi Okeke" }).ok, "bank not on the list refused");
assert(parseBank({ bankName: "Zenith Bank", accountNumber: "0123 456 789", accountName: "Chidi Okeke" }).ok, "10-digit NUBAN with spaces accepted");

// ------------------------------------------------------------ Sell flow
const sell = await newTrade("sell", { model: "iPhone 14 Pro Max", storage: "256GB", grade: "Great", estimate: "695000" });
assert(sell.status === "new" && sell.token && sell.token.length >= 32, "new sell lead has a token");
assert(sell.trade?.estimate === 695000, "estimate parsed from details");
const lock = Date.parse(sell.trade!.estimateLockedUntil!) - Date.parse(sell.createdAt);
assert(Math.abs(lock - 7 * 86_400_000) < 5000, "estimate locked for 7 days");

await rejects(recordInspection(sell.id, "test", { grade: "great", checklist, finalOffer: 650000 }), "can't record an inspection before booking", /Can't move/);
await rejects(sendOffer(sell.id, "test"), "can't send an offer before inspection");
await rejects(recordPayout(sell.id, "test", { method: "cash" }), "can't pay a new lead");
await rejects(respondToOffer(sell.id, "customer", "accepted"), "can't accept without an offer");

await markContacted(sell.id, "Ada");
await rejects(bookInspection(sell.id, "Ada", { at: new Date(Date.now() + 86_400_000).toISOString(), method: "dropoff", hub: "Atlantis" }), "unknown hub refused");
let l = await bookInspection(sell.id, "Ada", { at: new Date(Date.now() + 86_400_000).toISOString(), method: "dropoff", hub: "Lagos", staff: "Tunde" });
assert(l.status === "inspection_booked" && l.trade?.booking?.hub === "Lagos" && l.trade.booking.staff === "Tunde", "inspection booked at the Lagos hub");
l = await bookInspection(sell.id, "Ada", { at: new Date(Date.now() + 2 * 86_400_000).toISOString(), method: "pickup", address: "12 Herbert Macaulay Way, Yaba" });
assert(l.status === "inspection_booked" && l.trade?.booking?.method === "pickup", "inspection can be rebooked");
l = await recordInspection(sell.id, "Tunde", { grade: "great", checklist, finalOffer: 650000, notes: "Light scratches" });
assert(l.status === "inspected" && l.trade?.inspection?.finalOffer === 650000, "inspection recorded");
l = await sendOffer(sell.id, "Ada");
assert(l.status === "offer_sent" && !!l.trade?.offerSentAt, "offer sent");
await rejects(respondToOffer(sell.id, "customer", "accepted", { payout: { method: "swap_credit" } }), "sell leads can't take swap credit");

const bank = parseBank({ bankName: "Guaranty Trust Bank (GTBank)", accountNumber: "0123456789", accountName: "Chidi Okeke" });
if (!bank.ok) throw new Error(bank.error);
// Two answers race: exactly one wins under the lead lock.
const race = await Promise.allSettled([
  respondToOffer(sell.id, "customer", "accepted", { payout: { method: "bank", bank: bank.bank } }),
  respondToOffer(sell.id, "customer", "declined"),
]);
assert(race.filter((r) => r.status === "fulfilled").length === 1, "concurrent accept/decline: exactly one applies");
l = (await getLead(sell.id))!;
if (l.status === "declined") {
  // The decline won the race; send a revised offer and accept that.
  await sendOffer(sell.id, "Ada", 660000);
  l = await respondToOffer(sell.id, "customer", "accepted", { payout: { method: "bank", bank: bank.bank } });
}
assert(l.status === "accepted", "offer accepted");
assert(l.trade?.payoutChoice?.bank?.accountMasked === "******6789" && !JSON.stringify(l).includes("0123456789"), "lead stores only the masked account number");
assert((await getPayoutAccount(sell.id))?.accountNumber === "0123456789", "full account number kept in the admin-only key");
await rejects(recordPayout(sell.id, "Ada", { method: "bank" }), "bank payout needs a reference", /reference/);
l = await recordPayout(sell.id, "Ada", { method: "bank", reference: "GTB-TRF-889911" });
assert(l.status === "paid" && l.trade?.payout?.amount === l.trade?.inspection?.finalOffer && l.trade?.payout?.bank?.accountMasked === "******6789", "payout recorded with amount and masked bank");
await rejects(closeLead(sell.id, "Ada", "closed", ""), "closing needs a reason");
l = await closeLead(sell.id, "Ada", "closed", "Paid and device received");
assert(l.status === "closed" && l.trade?.closeReason === "Paid and device received", "closed with a reason");
await rejects(markContacted(sell.id, "Ada"), "closed lead can't move again");
const statusEvents = (l.history ?? []).filter((e) => e.kind === "status");
assert(statusEvents.every((e, i) => i === 0 || e.from === statusEvents[i - 1].to), "timeline from/to entries chain together");
assert(statusEvents.at(-1)?.to === "closed" && statusEvents.at(-1)?.by === "Ada", "timeline records who made each move");

// ------------------------------------------------------------ Token check
assert(!!(await getLeadForCustomer(sell.id, sell.token!)), "status page opens with the right token");
assert(!(await getLeadForCustomer(sell.id, sell.token!.replace(/.$/, (c) => (c === "a" ? "b" : "a")))), "wrong token refused");
assert(!(await getLeadForCustomer(sell.id, "")), "missing token refused");
assert(!(await getLeadForCustomer(sell.id, "../../etc")), "malformed token refused");
const contact = await createLead({ type: "contact", ...cust });
assert(!(await getLeadForCustomer(contact.id, "a".repeat(40))), "contact leads have no status page");
// A lead stored before the pipeline: old status, no token, no history.
const legacy: Lead = { id: "L-legacy-1", type: "swap", ...cust, status: "contacted", createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), updatedAt: new Date().toISOString() };
await saveLead(legacy);
const upgraded = await ensureLeadToken(legacy.id);
assert(!!upgraded?.token && upgraded.status === "contacted", "old lead gets a token lazily and keeps its status");
assert((await ensureLeadToken(legacy.id))?.token === upgraded?.token, "lazy token is stable");
assert(!!(await getLeadForCustomer(legacy.id, upgraded!.token!)), "old lead's new link works");

// ------------------------------------------------------------ Swap credit
const swap = await newTrade("swap", { tradeIn: "iPhone 12 128GB", tradeInGrade: "Good", tradeInValue: "60000" }, "chidi@example.com");
await bookInspection(swap.id, "Ada", { at: new Date(Date.now() + 3600_000).toISOString(), method: "dropoff", hub: "Abuja" });
await recordInspection(swap.id, "Tunde", { grade: "good", checklist, finalOffer: 50000 });
await sendOffer(swap.id, "Ada");
l = await respondToOffer(swap.id, "customer", "accepted", { payout: { method: "swap_credit" } });
const credit = l.trade?.credit;
assert(l.status === "accepted" && !!credit, "accepting a swap with swap credit issues a credit");
const offer = credit ? await getOffer(credit.code) : null;
assert(!!offer && offer.discount.type === "fixed" && offer.discount.value === 50000, "credit offer is a fixed discount equal to the final offer");
assert(offer?.usageLimit === 1 && offer.active && offer.scope.type === "all", "credit offer is single use and active");
const days = offer ? (Date.parse(offer.endsAt) - Date.parse(offer.startsAt)) / 86_400_000 : 0;
assert(Math.abs(days - 30) < 0.01, `credit expires in 30 days (${days.toFixed(2)})`);
assert((await issueSwapCredit(l, 50000)).code === credit?.code, "issuing again returns the same credit");
assert(!!l.trade?.credit && JSON.stringify(l.history).includes(credit!.code.toUpperCase()), "credit code logged on the timeline");

await setStock("airpods-pro-2-1", 5);
const buyer = { name: "Chidi Okeke", phone: "08031234567", state: "Lagos", address: "1 Allen Ave" };
const o1 = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], offerCode: credit!.code, customer: buyer, delivery: "pickup", pickupHub: "Lagos", paymentMethod: "transfer" });
assert(o1.ok && o1.order.discount === 50000, `credit applies once at checkout (${o1.ok ? o1.order.discount : !o1.ok && o1.error})`);
const o2 = await placeOrder({ items: [{ productId: "airpods-pro-2-1", qty: 1 }], offerCode: credit!.code, customer: buyer, delivery: "pickup", pickupHub: "Lagos", paymentMethod: "transfer" });
assert(o2.ok && o2.order.discount === 0 && !o2.order.offerCode, "credit can't be used a second time");
assert((await syncCreditRedemptions([(await getLead(swap.id))!])) === 1, "redemption sync marks one lead");
l = (await getLead(swap.id))!;
assert(l.status === "paid" && l.trade?.payout?.method === "swap_credit" && o1.ok && l.trade.payout.reference === o1.order.id, "swap lead marked paid via swap credit with the order id");
assert(l.trade?.credit?.orderId === (o1.ok ? o1.order.id : ""), "credit records the order that used it");
assert((await syncCreditRedemptions([l])) === 0, "sync is idempotent");

// Manual mark: a swap accepted for credit can be marked paid by staff.
const swap2 = await newTrade("swap", { tradeIn: "Galaxy S22", tradeInValue: "120000" });
await bookInspection(swap2.id, "Ada", { at: new Date().toISOString(), method: "pickup", address: "5 Awolowo Rd, Ikoyi" });
await recordInspection(swap2.id, "Tunde", { grade: "great", checklist, finalOffer: 110000 });
await sendOffer(swap2.id, "Ada");
await respondToOffer(swap2.id, "Ada (for customer)", "accepted", { payout: { method: "swap_credit" } });
l = await recordPayout(swap2.id, "Ada", { method: "swap_credit" });
assert(l.status === "paid" && l.trade?.payout?.reference === l.trade?.credit?.code.toUpperCase(), "manual swap credit payout uses the code as reference");

// ------------------------------------------------------------ Messages
const log = await notifyLead(swap.id, "credit", "https://jdhub.test");
assert(log.length > 0, `notify without providers doesn't throw (${log.join(" | ")})`);
const msgs = ((await getLead(swap.id))!.history ?? []).filter((e) => e.kind === "message");
assert(msgs.length === 1 && /set up/.test(msgs[0].note ?? ""), "message attempt logged on the timeline");
assert((await notifyLead("L-missing", "offer_sent", "https://jdhub.test")).length === 0, "notify on a missing lead is a no-op");

// ------------------------------------------------------------ Stats
const all = [await getLead(sell.id), await getLead(swap.id), await getLead(swap2.id), await getLead(legacy.id)].filter((x): x is Lead => !!x);
const st = tradeStats(all, Date.now());
assert(st.paidThisMonth >= 50000 + 110000 + 650000 && st.paidCountThisMonth === 3, `paid out this month counted (${st.paidThisMonth})`);
assert(st.open === 1, `open trade-ins counted (${st.open})`);
assert(st.compared === 3 && st.ratio !== null && st.ratio < 1, `final vs estimate compared (${st.ratio?.toFixed(3)})`);

console.log(process.exitCode ? "\nSome trade-in tests failed." : "\nAll trade-in tests passed.");
