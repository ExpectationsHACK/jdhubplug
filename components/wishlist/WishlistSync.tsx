"use client";

import { useEffect } from "react";
import { bindAccount } from "./store";

/** Binds the client wishlist to the signed-in customer (merging the guest list in). */
export function WishlistSync({ customerId, contact }: { customerId: string | null; contact?: string }) {
  useEffect(() => {
    bindAccount(customerId ? { id: customerId, contact } : null);
  }, [customerId, contact]);
  return null;
}
