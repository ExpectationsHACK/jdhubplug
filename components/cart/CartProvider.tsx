"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import type { Product } from "@/lib/types";

// Client cart. Lives in localStorage so it survives reloads. Prices here are only a
// preview: checkout re-prices everything on the server against live stock and offers.

export type CartProduct = Pick<
  Product,
  "id" | "name" | "spec" | "price" | "photo" | "imageUrl" | "stock" | "category" | "brand" | "art" | "tint"
>;

export type CartItem = { product: CartProduct; qty: number };

type CartContext = {
  items: CartItem[];
  count: number;
  /** Client-side estimate (before offers and delivery). */
  subtotal: number;
  hydrated: boolean;
  /** Add units. Returns false if stock doesn't allow it. `fromEl` launches the fly-to-cart animation. */
  add: (p: CartProduct, qty?: number, fromEl?: Element | null) => boolean;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  qtyOf: (id: string) => number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Offer code picked up from a special link (/o/{code}), applied at checkout. */
  offerCode: string | null;
  setOfferCode: (code: string | null) => void;
};

const Ctx = createContext<CartContext | null>(null);

const CART_KEY = "jd_cart_v1";
const OFFER_KEY = "jd_offer_v1";

export const toCartProduct = (p: CartProduct): CartProduct => ({
  id: p.id,
  name: p.name,
  spec: p.spec,
  price: p.price,
  photo: p.photo,
  imageUrl: p.imageUrl,
  stock: p.stock,
  category: p.category,
  brand: p.brand,
  art: p.art,
  tint: p.tint,
});

/** Fire the fly-to-cart animation from an element (usually the product image). */
export function launchFlyToCart(fromEl: Element | null | undefined, imageSrc?: string) {
  if (!fromEl || typeof window === "undefined") return;
  const rect = fromEl.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent("jd:fly", { detail: { rect, imageSrc } }));
}

// localStorage-backed external store, read with useSyncExternalStore so the server
// render (empty cart) and the hydrated client render never disagree.
type CartState = { items: CartItem[]; offerCode: string | null };
const EMPTY: CartState = { items: [], offerCode: null };
let state: CartState | null = null;
const listeners = new Set<() => void>();

function readState(): CartState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(CART_KEY);
    const items = raw ? (JSON.parse(raw) as CartItem[]).filter((i) => i?.product?.id && i.qty > 0) : [];
    state = { items, offerCode: localStorage.getItem(OFFER_KEY) };
  } catch {
    state = { ...EMPTY };
  }
  return state;
}

function writeState(next: CartState) {
  state = next;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next.items));
    if (next.offerCode) localStorage.setItem(OFFER_KEY, next.offerCode);
    else localStorage.removeItem(OFFER_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY || e.key === OFFER_KEY) {
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
const noopSubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, readState, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [isOpen, setOpen] = useState(false);
  const { items, offerCode } = snapshot;

  const setItems = useCallback((fn: (prev: CartItem[]) => CartItem[]) => {
    const cur = readState();
    writeState({ ...cur, items: fn(cur.items) });
  }, []);

  const setOfferCode = useCallback((code: string | null) => {
    writeState({ ...readState(), offerCode: code });
  }, []);

  const qtyOf = useCallback((id: string) => items.find((i) => i.product.id === id)?.qty ?? 0, [items]);

  const add = useCallback(
    (p: CartProduct, qty = 1, fromEl?: Element | null) => {
      const current = items.find((i) => i.product.id === p.id)?.qty ?? 0;
      if (p.stock <= 0 || current + qty > p.stock) return false;
      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === p.id);
        if (existing) return prev.map((i) => (i.product.id === p.id ? { product: toCartProduct(p), qty: i.qty + qty } : i));
        return [...prev, { product: toCartProduct(p), qty }];
      });
      if (fromEl) launchFlyToCart(fromEl);
      else window.dispatchEvent(new CustomEvent("jd:cart-bump"));
      return true;
    },
    [items, setItems],
  );

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: Math.max(0, Math.min(Math.floor(qty), Math.max(1, i.product.stock))) } : i))
        .filter((i) => i.qty > 0),
    );
  }, [setItems]);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.product.id !== id)), [setItems]);
  const clear = useCallback(() => setItems(() => []), [setItems]);

  const value = useMemo<CartContext>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.product.price, 0),
      hydrated,
      add,
      setQty,
      remove,
      clear,
      qtyOf,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      offerCode,
      setOfferCode,
    }),
    [items, hydrated, add, setQty, remove, clear, qtyOf, isOpen, offerCode, setOfferCode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside <CartProvider>");
  return c;
}
