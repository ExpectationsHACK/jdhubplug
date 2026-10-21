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
    "Apply to sell graded phones, gadgets and cars on JDHub, with escrow-protected payment and success-only fees.",
  alternates: { canonical: "/vendors" },
};

// The vendor programme is in early access: today every listing on JDHub is the store's
// own inspected stock. Keep this page to what partners actually get; fees are agreed
// per partner rather than advertised.
const perks: { icon: IconName; title: string; body: string }[] = [
  { icon: "verified", title: "Vetted partners only", body: "We check ID (and CAC for businesses) before any partner stock goes on sale." },
  { icon: "shield", title: "Escrow-protected payment", body: "Buyers pay into escrow before anything ships. No more fake transfer alerts." },
  { icon: "scan", title: "One grading standard", body: "Your stock is graded the same way as ours, so buyers know exactly what they get." },
  { icon: "truck", title: "Hub logistics", body: "Pickup and delivery through JDHub hubs, with delivery confirmation." },
];

const tiers = [
  { name: "Individual", who: "Selling a few items", needs: "Verified phone number" },
  { name: "Vendor", who: "Shops and dealers", needs: "BVN or NIN + business details" },
  { name: "Auto dealer", who: "Car dealers", needs: "CAC registration + lot inspection" },
];

export default async function VendorsPage() {
  const { products, settings } = await getStorefront();
  const collage = [...featuredIn(products, "phones", 2), ...featuredIn(products, "gadgets", 2), ...featuredIn(products, "cars", 1)];

  return (
    <PageTransition>
      <PageHero
        trail={[["Home", "/"], ["Sell on JDHub"]]}
        eyebrow="JDHub for Business · Early access"
        title="Sell to buyers who already trust the grade."
        body="We're opening JDHub to a small number of vetted partners. Today everything on JDHub is our own inspected stock; apply and our team will talk you through how partner listings will work."
      >
        <a href="#apply" className="btn btn-primary btn-lg mt-8">
          Apply for early access
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
        <p className="mt-2 text-center text-ink-2">
          Commission is agreed with each partner when you&apos;re approved, and only charged when an order completes and escrow releases.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} index={i} className={`rounded-tile p-8 ${i === 1 ? "bg-ink text-white" : "border border-line"}`}>
              <p className={`text-[14px] font-bold ${i === 1 ? "text-white/70" : "text-muted"}`}>{t.who}</p>
              <h3 className="display mt-2 text-[26px]">{t.name}</h3>
              <p className={`mt-6 text-[13px] ${i === 1 ? "text-white/60" : "text-muted"}`}>Success-only commission, agreed on approval</p>
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
              Leave your details and a line about your stock. Our team will get back to you about early access.
            </p>
            <ul className="mt-6 space-y-2 text-[14px] text-white/80">
              {["No fee to apply", "Payment held in escrow until the buyer confirms", "One grading standard for every listing"].map((x) => (
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
