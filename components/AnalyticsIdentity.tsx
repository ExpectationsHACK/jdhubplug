"use client";

import { useEffect } from "react";
import { identify, resetIdentity, track } from "@/lib/analytics";

/** Ties analytics to the signed-in customer id; resets it after sign-out. */
export function AnalyticsIdentity({ customerId }: { customerId: string | null }) {
  useEffect(() => {
    const key = "jd_identified";
    try {
      const prev = sessionStorage.getItem(key);
      if (customerId && prev !== customerId) {
        identify(customerId);
        if (!prev) track("signin_completed");
        sessionStorage.setItem(key, customerId);
      } else if (!customerId && prev) {
        resetIdentity();
        sessionStorage.removeItem(key);
      }
    } catch {
      if (customerId) identify(customerId);
    }
  }, [customerId]);
  return null;
}
