"use client";

import { useCallback, useSyncExternalStore } from "react";
import { syncWishlistAction, toggleWishlistAction } from "@/app/(store)/wishlist/actions";
import { productProps, track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

// Client wishlist: product ids, newest first, in localStorage so guests keep their list.
// When a shopper is signed in (see WishlistSync), every change is also saved to their
// account and the server's answer becomes the local list.
//
// Read with useSyncExternalStore, like the cart: the server render (empty list) and the
// hydrated client render never disagree, and there is no setState in an effect.

const KEY = "jd_wishlist";
/** Which account the local list belongs to; cleared (with the list) on sign-out. */
const OWNER_KEY = "jd_wishlist_owner";
const MAX = 100;
const EMPTY: string[] = [];

let ids: string[] | null = null;
let account: { id: string; contact?: string } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): string[] {
  if (ids) return ids;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    ids = [];
  }
  return ids;
}

function write(next: string[]) {
  ids = next.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      ids = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};
const noopSubscribe = () => () => {};

/**
 * Called once per page load by WishlistSync with the signed-in customer (or null).
 * Merges the local list into the account on sign-in / first load of a session.
 */
export function bindAccount(next: { id: string; contact?: string } | null) {
  const prevId = account?.id ?? null;
  account = next;
  emit();
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
  if (!next) {
    // Signed out: don't leave the account's list on a shared device.
    if (owner) {
      try {
        localStorage.removeItem(OWNER_KEY);
      } catch {
        /* ignore */
      }
      write([]);
    }
    return;
  }
  if (prevId === next.id) return;
  syncWishlistAction(owner && owner !== next.id ? [] : read())
    .then((merged) => {
      if (!merged) return;
      try {
        localStorage.setItem(OWNER_KEY, next.id);
      } catch {
        /* ignore */
      }
      write(merged);
    })
    .catch(() => undefined);
}

type WishProduct = Pick<Product, "id" | "name" | "brand" | "category" | "price"> & Partial<Pick<Product, "grade">>;

export function useWishlist() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const has = useCallback((id: string) => list.includes(id), [list]);

  const toggle = useCallback((p: WishProduct) => {
    const cur = read();
    const saved = !cur.includes(p.id);
    write(saved ? [p.id, ...cur] : cur.filter((x) => x !== p.id));
    track(saved ? "wishlist_add" : "wishlist_remove", productProps(p));
    if (account) {
      toggleWishlistAction(p.id, saved)
        .then((server) => {
          if (server) write(server);
        })
        .catch(() => undefined);
    }
    return saved;
  }, []);

  const remove = useCallback((id: string) => {
    const cur = read();
    if (!cur.includes(id)) return;
    write(cur.filter((x) => x !== id));
    track("wishlist_remove", { product_id: id });
    if (account) toggleWishlistAction(id, false).catch(() => undefined);
  }, []);

  return { ids: list, count: list.length, has, toggle, remove, hydrated };
}

const getAccount = () => account;
/** The signed-in shopper ({ id, contact }) once WishlistSync has run, else null. */
export function useAccount() {
  return useSyncExternalStore(subscribe, getAccount, () => null);
}
