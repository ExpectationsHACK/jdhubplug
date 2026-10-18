import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "./data";
import { DEFAULT_LEGAL, resolveLegal, withLegalDefaults, type DataRequest, type DsrStatus, type DsrType, type LegalDetails, type ResolvedLegal } from "./legal";
import { getCustomer, getSettings, saveCustomer } from "./store";
import { getDriver } from "./store/driver";
import type { Customer, Order } from "./types";

// Storage for legal details and data-subject requests (NDPA).
//
//   jd:legal      string LegalDetails JSON
//   jd:dsr        hash   id -> DataRequest JSON
//   jd:dsr:seq    counter for request ids

const K = {
  legal: "jd:legal",
  dsr: "jd:dsr",
  dsrSeq: "jd:dsr:seq",
};

const parse = <T>(s: string | null | undefined): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

// --------------------------------------------------------------------- Legal

export async function getLegal(): Promise<LegalDetails> {
  return withLegalDefaults(parse<Partial<LegalDetails>>(await getDriver().get(K.legal)) ?? DEFAULT_LEGAL);
}

export async function saveLegal(l: LegalDetails) {
  await getDriver().set(K.legal, JSON.stringify(l));
  return l;
}

/** Cached legal details for the storefront, merged with store settings. Refresh with TAGS.legal. */
export async function getLegalContent(): Promise<ResolvedLegal> {
  "use cache";
  cacheTag(TAGS.legal, TAGS.settings);
  cacheLife("hours");
  const [legal, settings] = await Promise.all([getLegal(), getSettings()]);
  return resolveLegal(legal, settings);
}

// ---------------------------------------------------- Data-subject requests

export async function createDataRequest(input: { type: DsrType; customerId?: string; contact?: string; message?: string }): Promise<DataRequest> {
  const d = getDriver();
  const n = await d.incr(K.dsrSeq);
  const at = new Date().toISOString();
  const req: DataRequest = {
    id: `DSR-${1000 + n}`,
    type: input.type,
    status: "new",
    customerId: input.customerId,
    contact: input.contact?.slice(0, 120),
    message: input.message?.slice(0, 2000),
    createdAt: at,
    updatedAt: at,
    history: [{ at, by: "customer", note: "Request submitted" }],
  };
  await d.hset(K.dsr, { [req.id]: JSON.stringify(req) });
  return req;
}

export async function getDataRequest(id: string): Promise<DataRequest | null> {
  return parse<DataRequest>(await getDriver().hget(K.dsr, id));
}

/** All requests, newest first. */
export async function listDataRequests(): Promise<DataRequest[]> {
  const all = await getDriver().hgetall(K.dsr);
  return Object.values(all)
    .map((j) => parse<DataRequest>(j))
    .filter((r): r is DataRequest => !!r)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveDataRequest(r: DataRequest) {
  const stamped = { ...r, updatedAt: new Date().toISOString() };
  await getDriver().hset(K.dsr, { [r.id]: JSON.stringify(stamped) });
  return stamped;
}

export async function setDataRequestStatus(id: string, status: DsrStatus, by: string, note?: string) {
  const r = await getDataRequest(id);
  if (!r) throw new Error(`Request ${id} not found`);
  return saveDataRequest({ ...r, status, history: [...r.history, { at: new Date().toISOString(), by, note: note || `Status: ${status}` }] });
}

/** Orders placed while signed in, plus earlier guest orders made with the same verified phone/email. */
export function customerOrders(c: Customer, all: Order[]) {
  const last10 = (s?: string) => (s ?? "").replace(/\D/g, "").slice(-10);
  return all.filter(
    (o) =>
      o.customerId === c.id ||
      (!!c.phone && last10(o.customer.phone) === last10(c.phone)) ||
      (!!c.email && !!o.customer.email && o.customer.email.toLowerCase() === c.email),
  );
}

/** "+234803•••4567" / "ad•••@gmail.com": enough to recognise a request without keeping the contact. */
export function maskContact(v?: string) {
  if (!v) return v;
  if (v.includes("@")) {
    const [u, dom] = v.split("@");
    return `${u.slice(0, 2)}•••@${dom}`;
  }
  return v.length > 7 ? `${v.slice(0, 7)}•••${v.slice(-4)}` : "•••";
}

/**
 * Anonymise a customer's profile: clear name, phone, email and address, remove
 * their phone/email lookup entries (via saveCustomer) and block the account so
 * the old session can't be used. Orders are kept for tax and accounting.
 */
export async function anonymiseCustomer(id: string): Promise<Customer | null> {
  const c = await getCustomer(id);
  if (!c) return null;
  const clean: Customer = { id: c.id, createdAt: c.createdAt, lastLoginAt: c.lastLoginAt, blocked: true };
  return saveCustomer(clean);
}
