import type { Metadata } from "next";
import { getLegalContent } from "@/lib/legal-store";
import { getStorefront, modelReps } from "@/components/home/storefront";
import { Icon, WhatsAppGlyph, type IconName } from "@/components/Icon";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal, RevealText } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import { ProductImage } from "@/components/ProductImage";
import { TrustLookup } from "@/components/TrustLookup";
import { grades } from "@/lib/reference";
import { waLink } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Trust & Safety",
  description:
    "Escrow on every order, one grading standard and IMEI/VIN checks on everything we sell. How JDHub keeps trade safe in Nigeria.",
  alternates: { canonical: "/trust" },
};

const escrowSteps = (days: number): { icon: IconName; title: string; body: string }[] => [
  { icon: "wallet", title: "You pay into escrow", body: "Your money is held in a protected account until you confirm the item." },
  { icon: "truck", title: "We ship", body: "JDHub inspects and sends the item, or you collect it at a JDHub hub." },
  { icon: "checkCircle", title: "You confirm", body: `Check it matches its grade. You have ${days} day${days === 1 ? "" : "s"} to confirm or raise an issue.` },
  { icon: "shield", title: "Funds release", body: "Only then is the payment released. Not as described? You get refunded." },
];

export default async function TrustPage() {
  const [{ products, settings }, legal] = await Promise.all([getStorefront(), getLegalContent()]);
  const escrow = escrowSteps(legal.returnDays);
  const wa = (text: string) => waLink(settings.whatsapp, text);
  const tel = settings.phone.replace(/[^\d+]/g, "");
  // One photo per grade, so the grading table shows real units.
  const reps = modelReps(products).filter((p) => p.photo || p.imageUrl);
  const gradePhoto = (id: string) => reps.find((p) => p.grade === id && p.category === "phones") ?? reps.find((p) => p.grade === id);
  const verifyPhoto = reps.find((p) => p.category === "phones");
  const carPhoto = reps.find((p) => p.category === "cars");

  return (
    <PageTransition>
      <PageHero
        trail={[["Home", "/"], ["Trust & Safety"]]}
        eyebrow="Trust & Safety"
        title="Nobody has to go first."
        body="Escrow on every order, one grading standard, and IMEI and VIN checks on every phone and car we sell."
      />

      <section id="escrow" className="wrap scroll-mt-24">
        <RevealText text="Escrow, on every order" className="display text-[28px] md:text-[36px]" />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {escrow.map((s, i) => (
            <Reveal as="li" key={s.title} index={i} className="relative rounded-tile border border-line p-6">
              <span className="text-[13px] font-bold text-accent">Step {i + 1}</span>
              <Icon name={s.icon} size={34} strokeWidth={1.25} className="mt-4" />
              <h3 className="mt-4 text-[18px] font-bold">{s.title}</h3>
              <p className="mt-2 text-[14px] text-ink-2">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section id="verify" className="wrap scroll-mt-24 pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <RevealText text="Check before you pay" className="display text-[28px] md:text-[36px]" />
            <p className="mt-2 max-w-2xl text-ink-2">
              JDHub checks every phone&apos;s IMEI and every car&apos;s VIN before it&apos;s listed. Buying elsewhere? Make sure the number
              you&apos;re given is at least a valid IMEI or VIN. Free, no account needed.
            </p>
          </div>
          {(verifyPhoto || carPhoto) && (
            <div aria-hidden className="hidden gap-3 lg:flex">
              {[verifyPhoto, carPhoto].map(
                (p, i) =>
                  p && (
                    <div key={p.id} className={`relative w-40 overflow-hidden rounded-tile bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] ${i ? "float-b" : "float-a"}`}>
                      <ProductImage item={p} width={330} className="aspect-square w-full" artClassName="h-24 w-24" />
                      <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-ok">
                        <Icon name="checkCircle" size={14} /> {p.category === "cars" ? "VIN clean" : "IMEI clean"}
                      </span>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>
        <div id="lookup" className="mt-8 scroll-mt-24">
          <TrustLookup />
        </div>
      </section>

      <section id="grading" className="wrap scroll-mt-24 pt-20">
        <RevealText text="One grade, every category" className="display text-[28px] md:text-[36px]" />
        <p className="mt-2 max-w-2xl text-ink-2">
          A Great phone, a Great laptop and a Great car all mean the same thing: light signs of use, fully working, nothing hidden.
        </p>
        <div className="mt-8 overflow-hidden rounded-tile border border-line">
          {grades.map((g) => {
            const photo = gradePhoto(g.id);
            return (
              <div key={g.id} className="grid gap-4 border-b border-line p-6 last:border-0 md:grid-cols-[80px_200px_1fr_96px] md:items-center">
                <span className="display grid h-12 w-12 place-items-center rounded-full bg-ink text-[20px] text-white">{g.letter}</span>
                <div>
                  <p className="text-[18px] font-bold">{g.name}</p>
                  <p className="text-[14px] text-muted">{g.summary}</p>
                </div>
                <p className="text-[15px] text-ink-2">{g.detail}</p>
                {photo && (
                  <ProductImage item={photo} width={250} className="hidden aspect-square w-24 rounded-xl bg-stage md:block" artClassName="h-16 w-16" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section id="disputes" className="wrap scroll-mt-24 pt-20">
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="rounded-tile bg-stage p-8 md:p-10">
            <Icon name="chat" size={36} strokeWidth={1.25} />
            <h2 className="display mt-4 text-[26px]">Resolve a dispute</h2>
            <p className="mt-3 text-ink-2">
              Item not as described? Open a case within {legal.returnDays} day{legal.returnDays === 1 ? "" : "s"} of delivery. JDHub reviews photos from both sides and decides
              within 3 working days. Escrow releases or refunds accordingly.
            </p>
            <a href={wa(`Hi ${settings.storeName}, I want to open a dispute for order #`)} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6">
              Open a case
            </a>
          </Reveal>
          <Reveal index={1} id="hubs" className="scroll-mt-24 rounded-tile bg-ink p-8 text-white md:p-10">
            <Icon name="pin" size={36} strokeWidth={1.25} />
            <h2 className="display mt-4 text-[26px]">{settings.storeName} hubs</h2>
            <p className="mt-3 text-white/75">Inspect, swap, sell or collect in person.</p>
            <ul className="mt-6 divide-y divide-white/15">
              {settings.hubs.map((h) => (
                <li key={`${h.city}-${h.address}`} className="flex flex-wrap justify-between gap-2 py-3 text-[14px]">
                  <span className="font-bold">{h.city}</span>
                  <span className="text-white/75">
                    {h.address} · {h.hours}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="contact" className="wrap scroll-mt-24 pt-20">
        <RevealText text="We're here to help" className="display text-center text-[28px] md:text-[36px]" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <a href={wa(`Hi ${settings.storeName}, `)} target="_blank" rel="noopener noreferrer" className="contact-tile rounded-tile border border-line p-6 text-center hover:border-ink">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-wa text-white">
              <WhatsAppGlyph size={26} />
            </span>
            <p className="mt-4 font-bold">Chat on WhatsApp</p>
            <p className="text-[14px] text-muted">Fastest. Replies in minutes.</p>
          </a>
          {tel && (
            <a href={`tel:${tel}`} className="contact-tile rounded-tile border border-line p-6 text-center hover:border-ink">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stage">
                <Icon name="phone" />
              </span>
              <p className="mt-4 font-bold">Call us</p>
              <p className="text-[14px] text-muted">{settings.phone} · Mon–Sat, 8am–8pm</p>
            </a>
          )}
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="contact-tile rounded-tile border border-line p-6 text-center hover:border-ink">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stage">
                <Icon name="mail" />
              </span>
              <p className="mt-4 font-bold">Email</p>
              <p className="break-all text-[14px] text-muted">{settings.email}</p>
            </a>
          )}
        </div>
      </section>
    </PageTransition>
  );
}
