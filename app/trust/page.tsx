import type { Metadata } from "next";
import { Icon, WhatsAppGlyph, type IconName } from "@/components/Icon";
import { PageHero } from "@/components/PageHero";
import { TrustLookup } from "@/components/TrustLookup";
import { grades, whatsappLink } from "@/lib/catalog";

export const metadata: Metadata = { title: "Trust & Safety" };

const escrow: { icon: IconName; title: string; body: string }[] = [
  { icon: "wallet", title: "You pay into escrow", body: "Your money goes to a protected holding account, not the seller." },
  { icon: "truck", title: "Seller ships", body: "The seller sends the item, or you collect it at a JDHub hub." },
  { icon: "checkCircle", title: "You confirm", body: "Check it matches its grade. You have 48 hours to confirm or raise an issue." },
  { icon: "shield", title: "Funds release", body: "Only then does the seller get paid. Not as described? You get refunded." },
];

const hubs = [
  { city: "Lagos", address: "Computer Village, Ikeja", hours: "Mon–Sat, 9am–7pm" },
  { city: "Abuja", address: "Banex Plaza, Wuse 2", hours: "Mon–Sat, 9am–6pm" },
  { city: "Port Harcourt", address: "GRA Phase 2", hours: "Mon–Sat, 9am–6pm" },
];

export default function TrustPage() {
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Trust & Safety"]]}
        eyebrow="Trust & Safety"
        title="Nobody has to go first."
        body="Escrow on every order, one grading standard, and public checks that keep stolen devices and scammers off JDHub."
      />

      <section id="escrow" className="wrap scroll-mt-24">
        <h2 className="display text-[28px] md:text-[36px]">Escrow, on every order</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {escrow.map((s, i) => (
            <li key={s.title} className="relative rounded-tile border border-line p-6">
              <span className="text-[13px] font-bold text-accent">Step {i + 1}</span>
              <Icon name={s.icon} size={34} strokeWidth={1.25} className="mt-4" />
              <h3 className="mt-4 text-[18px] font-bold">{s.title}</h3>
              <p className="mt-2 text-[14px] text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="verify" className="wrap scroll-mt-24 pt-20">
        <h2 className="display text-[28px] md:text-[36px]">Check before you pay</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Check any phone&apos;s IMEI or car&apos;s VIN, or look up a seller&apos;s number in community scam reports. Free, no account needed.
        </p>
        <div id="lookup" className="mt-8 scroll-mt-24">
          <TrustLookup />
        </div>
      </section>

      <section id="grading" className="wrap scroll-mt-24 pt-20">
        <h2 className="display text-[28px] md:text-[36px]">One grade, every category</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          A Great phone, a Great laptop and a Great car all mean the same thing: light signs of use, fully working, nothing hidden.
        </p>
        <div className="mt-8 overflow-hidden rounded-tile border border-line">
          {grades.map((g) => (
            <div key={g.id} className="grid gap-2 border-b border-line p-6 last:border-0 md:grid-cols-[80px_200px_1fr] md:items-center">
              <span className="display grid h-12 w-12 place-items-center rounded-full bg-ink text-[20px] text-white">{g.letter}</span>
              <div>
                <p className="text-[18px] font-bold">{g.name}</p>
                <p className="text-[14px] text-muted">{g.summary}</p>
              </div>
              <p className="text-[15px] text-ink-2">{g.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="disputes" className="wrap scroll-mt-24 pt-20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-tile bg-stage p-8 md:p-10">
            <Icon name="chat" size={36} strokeWidth={1.25} />
            <h2 className="display mt-4 text-[26px]">Resolve a dispute</h2>
            <p className="mt-3 text-ink-2">
              Item not as described? Open a case within 48 hours of delivery. JDHub reviews photos from both sides and decides
              within 3 working days. Escrow releases or refunds accordingly.
            </p>
            <a href={whatsappLink("Hi JDHub, I want to open a dispute for order #")} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6">
              Open a case
            </a>
          </div>
          <div id="hubs" className="scroll-mt-24 rounded-tile bg-ink p-8 text-white md:p-10">
            <Icon name="pin" size={36} strokeWidth={1.25} />
            <h2 className="display mt-4 text-[26px]">JDHub hubs</h2>
            <p className="mt-3 text-white/75">Inspect, swap, sell or collect in person.</p>
            <ul className="mt-6 divide-y divide-white/15">
              {hubs.map((h) => (
                <li key={h.city} className="flex flex-wrap justify-between gap-2 py-3 text-[14px]">
                  <span className="font-bold">{h.city}</span>
                  <span className="text-white/75">
                    {h.address} · {h.hours}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="wrap scroll-mt-24 pt-20">
        <h2 className="display text-center text-[28px] md:text-[36px]">We&apos;re here to help</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <a href={whatsappLink("Hi JDHub, ")} target="_blank" rel="noopener noreferrer" className="rounded-tile border border-line p-6 text-center hover:border-ink">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-wa text-white">
              <WhatsAppGlyph size={26} />
            </span>
            <p className="mt-4 font-bold">Chat on WhatsApp</p>
            <p className="text-[14px] text-muted">Fastest. Replies in minutes.</p>
          </a>
          <a href="tel:+2348000000000" className="rounded-tile border border-line p-6 text-center hover:border-ink">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stage">
              <Icon name="phone" />
            </span>
            <p className="mt-4 font-bold">Call us</p>
            <p className="text-[14px] text-muted">Mon–Sat, 8am–8pm</p>
          </a>
          <a href="mailto:hello@jdhub.ng" className="rounded-tile border border-line p-6 text-center hover:border-ink">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stage">
              <Icon name="mail" />
            </span>
            <p className="mt-4 font-bold">Email</p>
            <p className="text-[14px] text-muted">hello@jdhub.ng</p>
          </a>
        </div>
      </section>
    </>
  );
}
