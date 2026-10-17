"use client";

import { useSyncExternalStore } from "react";

// Media-query hooks shared by the motion components. Server renders assume "no
// preference"; components must render the same markup either way and only change
// behaviour after hydration.

function subscribeTo(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

function useMedia(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** True when the visitor asked the OS to reduce motion. */
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)", false);

/** Non-hook check for event handlers and effects. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
