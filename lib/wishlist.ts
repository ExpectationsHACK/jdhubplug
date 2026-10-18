import "server-only";

import { getProducts, withLock } from "./store";
import { getDriver } from "./store/driver";

// Saved products for signed-in shoppers. Guests keep their list in localStorage
// (components/wishlist/store.ts); on sign-in it is merged into the server copy.
//
//   jd:wishlist:{customerId}  string  JSON array of product ids, newest first
//
// Ids from the browser are only trusted after an existence check, and lists are capped.

export const WISHLIST_MAX = 100;

const key = (customerId: string) => `jd:wishlist:${customerId}`;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

/** Well-formed, de-duplicated ids from untrusted input (no existence check). */
export function cleanIds(input: unknown, max = WISHLIST_MAX * 2): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === "string" && ID_RE.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

async function read(customerId: string): Promise<string[]> {
  const raw = await getDriver().get(key(customerId));
  if (!raw) return [];
  try {
    return cleanIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Keep ids of products that exist, in order, capped. */
async function existing(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const found = await getProducts(ids);
  return ids.filter((id) => found.has(id)).slice(0, WISHLIST_MAX);
}

export async function getWishlist(customerId: string): Promise<string[]> {
  return read(customerId);
}

/**
 * Merge a guest list into the account's list and return the result: server items keep
 * their order, local items not already saved go in front (they're the newest), unknown
 * products are dropped and the list is capped at WISHLIST_MAX.
 */
export async function mergeWishlist(customerId: string, localIds: unknown): Promise<string[]> {
  const local = cleanIds(localIds);
  return withLock(`wishlist:${customerId}`, async () => {
    const server = await read(customerId);
    const merged = [...local.filter((id) => !server.includes(id)), ...server];
    const next = await existing(merged);
    if (next.join() !== server.join()) await getDriver().set(key(customerId), JSON.stringify(next));
    return next;
  });
}

/** Add (newest first) or remove one product. Returns the updated list. */
export async function setWishlistItem(customerId: string, productId: string, saved: boolean): Promise<string[]> {
  const [id] = cleanIds([productId]);
  return withLock(`wishlist:${customerId}`, async () => {
    const cur = await read(customerId);
    if (!id) return cur;
    let next = cur.filter((x) => x !== id);
    if (saved) {
      if (!(await getProducts([id])).has(id)) return cur;
      next = [id, ...next].slice(0, WISHLIST_MAX);
    }
    if (next.join() !== cur.join()) await getDriver().set(key(customerId), JSON.stringify(next));
    return next;
  });
}
