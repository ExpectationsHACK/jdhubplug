"use client";

import { useCallback, useEffect, useState } from "react";
import { previewCheckout } from "@/app/(store)/checkout/actions";
import type { CheckoutPreview, PreviewInput } from "./shared";

/**
 * Server-priced cart summary that follows the inputs (debounced). `input = null`
 * pauses fetching (e.g. while the drawer is closed). The last good preview stays
 * on screen while a new one loads, so totals never flash.
 */
export function useCheckoutPreview(input: PreviewInput | null, delay = 250) {
  const key = input && input.items.length ? JSON.stringify(input) : null;
  const [resolved, setResolved] = useState<{ key: string; preview: CheckoutPreview } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const preview = await previewCheckout(JSON.parse(key) as PreviewInput);
        if (!cancelled) {
          setResolved({ key, preview });
          setFailed(null);
        }
      } catch {
        if (!cancelled) setFailed(key);
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, delay, nonce]);

  /** Seed a preview the server already computed (e.g. returned by a failed submit). */
  const seed = useCallback((preview: CheckoutPreview) => key && setResolved({ key, preview }), [key]);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    preview: key ? (resolved?.preview ?? null) : null,
    /** True when the shown preview doesn't match the current inputs yet. */
    loading: !!key && resolved?.key !== key && failed !== key,
    error: !!key && failed === key,
    seed,
    refresh,
  };
}
