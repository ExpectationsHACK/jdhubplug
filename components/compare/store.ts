"use client";

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/types";
import { COMPARE_MAX } from "./limits";

// Compare list: up to 4 products from one category, in localStorage. A product from a
// different category (or a 5th one) waits in `pending` until the shopper chooses to
// replace the list or cancel; the CompareTray shows that prompt.

export { COMPARE_MAX };
const KEY = "jd_compare";

export type CompareItem = Pick<Product, "id" | "name" | "category" | "photo" | "imageUrl" | "art" | "tint">;
export type ComparePending = { item: CompareItem; reason: "category" | "full" };
type State = { items: CompareItem[]; pending: ComparePending | null };

const EMPTY: State = { items: [], pending: null };
let state: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (state) return state;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const items = Array.isArray(raw) ? (raw as CompareItem[]).filter((i) => typeof i?.id === "string" && typeof i.category === "string").slice(0, COMPARE_MAX) : [];
    state = { items, pending: null };
  } catch {
    state = { ...EMPTY };
  }
  return state;
}

function write(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.items));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

const slimItem = (p: CompareItem): CompareItem => ({ id: p.id, name: p.name, category: p.category, photo: p.photo, imageUrl: p.imageUrl, art: p.art, tint: p.tint });

export const compare = {
  /** Add, or remove if already there. Returns false when the choice is pending (see tray). */
  toggle(p: CompareItem): boolean {
    const cur = read();
    if (cur.items.some((i) => i.id === p.id)) {
      write({ ...cur, items: cur.items.filter((i) => i.id !== p.id) });
      return true;
    }
    if (cur.items.length && cur.items[0].category !== p.category) {
      write({ ...cur, pending: { item: slimItem(p), reason: "category" } });
      return false;
    }
    if (cur.items.length >= COMPARE_MAX) {
      write({ ...cur, pending: { item: slimItem(p), reason: "full" } });
      return false;
    }
    write({ items: [...cur.items, slimItem(p)], pending: null });
    track("compare_add", { product_id: p.id, category: p.category, count: cur.items.length + 1 });
    return true;
  },
  remove(id: string) {
    const cur = read();
    write({ ...cur, items: cur.items.filter((i) => i.id !== id) });
  },
  clear() {
    write({ items: [], pending: null });
  },
  /** Resolve a pending add: a new category starts a fresh list; a full list drops its oldest item. */
  acceptPending() {
    const cur = read();
    if (!cur.pending) return;
    const { item, reason } = cur.pending;
    const items = reason === "category" ? [item] : [...cur.items.slice(1), item];
    write({ items, pending: null });
    track("compare_add", { product_id: item.id, category: item.category, count: items.length, replaced: reason });
  },
  dismissPending() {
    write({ ...read(), pending: null });
  },
};

export function useCompare() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const compareHref = (ids: string[]) => `/compare?ids=${ids.map(encodeURIComponent).join(",")}`;
