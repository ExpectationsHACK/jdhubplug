"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

// Storefront error boundary: a friendly message and a retry, header and footer stay.
export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="fade-in max-w-lg">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stage">
          <Icon name="alert" size={30} strokeWidth={1.25} />
        </span>
        <h1 className="display mt-6 text-[30px] md:text-[40px]">Something slipped. Not your order.</h1>
        <p className="mt-3 text-ink-2">
          This page didn&apos;t load properly. Your cart is safe on this device. Try again, or head back to the shop.
        </p>
        {error.digest && <p className="mt-2 text-[12px] text-muted">Reference: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn btn-outline">
            Go to shop
          </Link>
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
