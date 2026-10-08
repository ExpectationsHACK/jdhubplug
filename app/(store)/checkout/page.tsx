import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutForm, CheckoutSkeleton } from "@/components/checkout/CheckoutForm";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/PageHero";
import { getStoreSettings } from "@/lib/data";
import { paystackEnabled } from "@/lib/paystack";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <section className="wrap pb-24 pt-6">
      <Breadcrumbs trail={[["Home", "/"], ["Shop", "/shop"], ["Checkout"]]} />
      <div className="mb-8 mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-[30px] md:text-[40px]">Checkout</h1>
        <p className="flex items-center gap-2 text-[13px] font-bold text-ink-2">
          <Icon name="shield" size={18} /> Escrow-protected checkout
        </p>
      </div>
      <Suspense fallback={<CheckoutSkeleton />}>
        <Checkout />
      </Suspense>
    </section>
  );
}

async function Checkout() {
  // Payment availability comes from runtime env, so don't bake it into the static shell.
  await connection();
  const s = await getStoreSettings();
  return (
    <CheckoutForm
      paystack={paystackEnabled()}
      settings={{
        hubs: s.hubs,
        deliveryFeeLagos: s.deliveryFeeLagos,
        deliveryFeeOther: s.deliveryFeeOther,
        freeDeliveryOver: s.freeDeliveryOver,
        reservationMinutes: s.reservationMinutes,
        whatsapp: s.whatsapp,
      }}
    />
  );
}
