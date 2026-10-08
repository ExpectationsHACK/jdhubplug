import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { PageHero } from "@/components/PageHero";
import { SellEstimator } from "@/components/SellEstimator";
import { whatsappLink } from "@/lib/catalog";

export const metadata: Metadata = { title: "Sell your phone, gadget or car" };

const how: { icon: IconName; title: string; body: string }[] = [
  { icon: "tag", title: "Describe it", body: "Pick your model, storage and condition. Takes under a minute." },
  { icon: "checkCircle", title: "Get a locked offer", body: "Your offer is held for 7 days while you decide." },
  { icon: "truck", title: "Ship free or drop off", body: "Free pickup in Lagos, Abuja and Port Harcourt, or visit a hub." },
  { icon: "wallet", title: "Get paid in 48 hours", body: "Bank transfer as soon as your device passes inspection." },
];

export default function SellPage() {
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Sell"]]}
        eyebrow="Sell to JDHub"
        title="Sell in minutes. Get paid in 48 hours."
        body="A fair, graded cash offer for your iPhone today. Gadgets and cars quoted on WhatsApp."
      />

      <section className="wrap">
        <SellEstimator />
      </section>

      <section id="how" className="wrap scroll-mt-24 pt-24">
        <h2 className="display text-center text-[28px] md:text-[40px]">How selling works</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {how.map((h, i) => (
            <li key={h.title} className="rounded-tile bg-stage p-6">
              <div className="flex items-center justify-between">
                <Icon name={h.icon} size={32} strokeWidth={1.25} />
                <span className="display text-[32px] text-line">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-[18px] font-bold">{h.title}</h3>
              <p className="mt-2 text-[14px] text-ink-2">{h.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap pt-24">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-tile bg-ink p-10 text-white">
            <p className="text-[14px] font-bold text-white/70">Gadgets & accessories</p>
            <h3 className="display mt-2 text-[28px]">Laptops, consoles, drones and more.</h3>
            <p className="mt-3 text-white/75">Send photos and the serial number. We reply with a graded quote, usually within the hour.</p>
            <a href={whatsappLink("Hi JDHub, I'd like a quote to sell my gadget: ")} target="_blank" rel="noopener noreferrer" className="btn btn-white mt-6">
              Get a quote on WhatsApp
            </a>
          </div>
          <div className="rounded-tile bg-stage p-10">
            <p className="text-[14px] font-bold text-muted">Cars</p>
            <h3 className="display mt-2 text-[28px]">Sell your car without the haggling.</h3>
            <p className="mt-3 text-ink-2">Book a free 152-point inspection at a JDHub Auto hub. Get an offer the same day.</p>
            <Link href="/trust#hubs" className="btn btn-primary mt-6">
              Book an inspection
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
