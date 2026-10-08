"use client";

import { useEffect, useSyncExternalStore } from "react";
import { offerState } from "@/lib/pricing";
import type { Offer, OfferState } from "@/lib/types";
import { fromPublicOffer, type PublicOfferPayload } from "./format";

// Client-side offer lookup shared by every offer widget on the page. Each code is
// fetched from /api/offers/{code} at most once per page load (module-level cache), and
// all components reading the same code re-render together when it arrives.

type Entry = PublicOfferPayload | null; // null = unknown code or failed fetch
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function load(code: string) {
  if (cache.has(code) || inflight.has(code)) return;
  const p = fetch(`/api/offers/${encodeURIComponent(code)}`, { headers: { accept: "application/json" } })
    .then(async (r) => (r.ok ? ((await r.json()) as PublicOfferPayload) : null))
    .catch(() => null)
    .then((v) => {
      cache.set(code, v);
      inflight.delete(code);
      listeners.forEach((l) => l());
    });
  inflight.set(code, p);
}

/** The public offer payload for a code: undefined while loading, null if not found. */
export function useOfferPayload(code: string | null | undefined): Entry | undefined {
  const key = code?.trim().toLowerCase() || null;
  useEffect(() => {
    if (key) load(key);
  }, [key]);
  return useSyncExternalStore(
    subscribe,
    () => (key ? cache.get(key) : null),
    () => undefined,
  );
}

// A shared clock that ticks on a fixed interval, so many widgets share one timer.
type Clock = { now: number; subs: Set<() => void>; id?: ReturnType<typeof setInterval>; subscribe: (l: () => void) => () => void };
const clocks = new Map<number, Clock>();

function clockFor(stepMs: number): Clock {
  const existing = clocks.get(stepMs);
  if (existing) return existing;
  const tick = () => Math.floor(Date.now() / stepMs) * stepMs;
  const c: Clock = {
    now: tick(),
    subs: new Set(),
    subscribe: (l) => {
      c.subs.add(l);
      if (!c.id) {
        // The clock may be stale if nothing was subscribed for a while.
        if (tick() !== c.now) {
          c.now = tick();
          queueMicrotask(l);
        }
        c.id = setInterval(() => {
          const t = tick();
          if (t === c.now) return;
          c.now = t;
          c.subs.forEach((s) => s());
        }, Math.min(stepMs, 1000));
      }
      return () => {
        c.subs.delete(l);
        if (!c.subs.size && c.id) {
          clearInterval(c.id);
          c.id = undefined;
        }
      };
    },
  };
  clocks.set(stepMs, c);
  return c;
}

/** Current time rounded down to `stepMs`, updating on that interval. Null during SSR/hydration. */
export function useNow(stepMs = 1000): number | null {
  const c = clockFor(stepMs);
  return useSyncExternalStore(c.subscribe, () => c.now, () => null);
}

/**
 * The offer for a code with its state recomputed on the client clock. Usage limits
 * can't be checked client-side, so "exhausted" and "paused" come from the server.
 */
export function useLiveOffer(code: string | null | undefined, stepMs = 60_000): { offer: Offer; state: OfferState } | null {
  const payload = useOfferPayload(code);
  const now = useNow(stepMs);
  if (!payload || now === null) return null;
  const offer = fromPublicOffer(payload.offer, payload.state);
  const state = payload.state === "exhausted" || payload.state === "paused" ? payload.state : offerState(offer, now);
  return { offer, state };
}
