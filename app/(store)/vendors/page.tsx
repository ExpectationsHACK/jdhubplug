import type { Metadata } from "next";
import { featuredIn, getStorefront } from "@/components/home/storefront";
import { Icon, WhatsAppGlyph, type IconName } from "@/components/Icon";
import { LeadForm } from "@/components/LeadForm";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal, RevealText } from "@/components/motion/Reveal";
import { PageHero, PhotoCollage } from "@/components/PageHero";
import { waLink } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Sell on JDHub",
  description:
    "List your graded phones, gadgets and cars on JDHub. Verified badge, guaranteed escrow payment, logistics built in and success-only fees.",
  alternates: { canonical: "/vendors" },
};

const perks: { icon: IconName; title: string; body: string }[] = [
  { icon: "verified", title: "Verified badge", body: "Pass ID/BVN checks once and every listing carries the badge buyers look for." },
  { icon: "shield", title: "Guaranteed payment", body: "Buyers pay into escrow before you ship. No more fake transfer alerts." },
  { icon: "store", title: "Your own dashboard", body: "List, grade, price and track orders. Add staff with Vendor or Support roles." },
  { icon: "truck", title: "Logistics built in", body: "Pickup, tracking and delivery confirmation across Lagos, Abuja and Port Harcourt." },
];

const tiers = [
  { name: "Individual", fee: "5%", who: "Selling a few items", needs: "Phone number OTP" },
  { name: "Vendor", fee: "3.5%", who: "Shops and dealers", needs: "BVN or NIN + business details" },
  { name: "Auto dealer", fee: "1.5%", who: "Car dealers", needs: "CAC registration + lot inspection" },
];

export default async function VendorsPage() {
  const { products, settings } = await getStorefront();
  const collage = [...featuredIn(products, "phones", 2), ...featuredIn(products, "gadgets", 2), ...featuredIn(products, "cars", 1)];

  return (
    <PageTransition>
      <PageHero
        trail={[["Home", "/"], ["Sell on JDHub"]]}
        eyebrow="JDHub for Business"
        title="Sell to buyers who already trust the grade."
        body="List your graded inventory under JDHub's trust framework. You bring the stock. We bring the buyers, the escrow and the logistics."
      >
        <a href="#apply" className="btn btn-primary btn-lg mt-8">
          Become a vendor
        </a>
        <PhotoCollage items={collage} />
      </PageHero>

      <section id="dashboard" className="wrap scroll-mt-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p, i) => (
            <Reveal key={p.title} index={i} className="rounded-tile bg-stage p-6">
              <Icon name={p.icon} size={34} strokeWidth={1.25} />
              <h3 className="mt-4 text-[18px] font-bold">{p.title}</h3>
              <p className="mt-2 text-[14px] text-ink-2">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="verify" className="wrap scroll-mt-24 pt-20">
        <RevealText text="Simple, success-only fees" className="display text-center text-[28px] md:text-[36px]" />
        <p className="mt-2 text-center text-ink-2">You only pay when an order completes and escrow releases.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} index={i} className={`rounded-tile p-8 ${i === 1 ? "bg-ink text-white" : "border border-line"}`}>
              <p className={`text-[14px] font-bold ${i === 1 ? "text-white/70" : "text-muted"}`}>{t.who}</p>
              <h3 className="display mt-2 text-[26px]">{t.name}</h3>
              <p className="display mt-6 text-[44px]">{t.fee}</p>
              <p className={`text-[13px] ${i === 1 ? "text-white/60" : "text-muted"}`}>commission per completed sale</p>
              <p className="mt-6 flex items-center gap-2 border-t border-current/15 pt-5 text-[14px]">
                <Icon name="checkCircle" size={18} /> {t.needs}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="apply" className="wrap scroll-mt-24 pt-20">
        <div className="grid overflow-hidden rounded-tile bg-ink text-white lg:grid-cols-2">
          <div className="p-8 md:p-12">
            <p className="text-[14px] font-bold text-white/70">Apply in two minutes</p>
            <h2 className="display mt-2 text-[28px] md:text-[36px]">Tell us what you sell.</h2>
            <p className="mt-3 max-w-md text-white/75">
              Leave your details and a line about your stock. Our partnerships team calls you back, usually the same day.
            </p>
            <ul className="mt-6 space-y-2 text-[14px] text-white/80">
              {["Verification in 24–48 hours", "List your first items free", "Payouts within 48 hours of delivery"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Icon name="checkCircle" size={18} /> {x}
                </li>
              ))}
            </ul>
            <a
              href={waLink(settings.whatsapp, `Hi ${settings.storeName}, I'd like to become a vendor.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-[14px] font-bold underline underline-offset-4"
            >
              <WhatsAppGlyph size={18} /> Prefer WhatsApp? Chat with us
            </a>
          </div>
          <div className="bg-white/5 p-8 md:p-12">
            <LeadForm type="vendor" dark submitLabel="Apply to sell" messageLabel="What do you sell, and roughly how many units a month?" />
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
