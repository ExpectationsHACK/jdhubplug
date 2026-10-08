import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/data";
import { WhatsAppCheckout } from "./WhatsAppCheckout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

// Interim checkout: sends the cart to JDHub on WhatsApp. Replaced by the full
// escrow checkout (stock reservation, Paystack, order tracking).
export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <section className="wrap max-w-3xl py-12">
      <h1 className="display text-[32px] md:text-[40px]">Checkout</h1>
      <p className="mt-2 text-ink-2">Send your order to JDHub on WhatsApp. We confirm availability, then you pay into escrow.</p>
      <WhatsAppCheckout whatsapp={settings.whatsapp} states={["Lagos", "Abuja (FCT)", "Rivers", "Oyo", "Kano", "Enugu", "Other"]} />
    </section>
  );
}
