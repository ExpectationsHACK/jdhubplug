import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { OfferActivator } from "@/components/offers/OfferActivator";
import { OfferCountdown } from "@/components/offers/OfferCountdown";
import { OfferHeroStage } from "@/components/offers/OfferHeroStage";
import { OfferProductCard } from "@/components/offers/OfferProductCard";
import { OfferStyles } from "@/components/offers/OfferStyles";
import { discountSticker, formatNaira, lagosDateTime } from "@/components/offers/format";
import { getCatalog, getPublicOffer, getStoreSettings } from "@/lib/data";
import { productImageSrc } from "@/lib/photos";
import { describeDiscount, offerAppliesTo, offerState, offerUnitPrice } from "@/lib/pricing";
import type { Offer, OfferState, Product } from "@/lib/types";

// Offer landing page. Shoppers arrive here from the special link /o/{code} (which
// records the view and stores the code), or directly. The offer state depends on the
// current time, so everything below the static shell renders at request time.

const MAX_PRODUCTS = 60;

export async function generateMetadata({ params }: PageProps<"/offer/[code]">): Promise<Metadata> {
  const data = await getPublicOffer((await params).code);
  if (!data) return { title: "Offer not found", robots: { index: false } };
  const { offer } = data;
  const catalog = await getCatalog();
  const hero = pickHero(offer, catalog);
  const image = hero ? productImageSrc(hero, 1280) : undefined;
  const description = offer.description || offer.headline || `${describeDiscount(offer)} on selected items at JDHub.`;
  return {
    title: offer.title,
    description,
    alternates: { canonical: `/offer/${offer.code}` },
    openGraph: {
      title: `${offer.title}: ${describeDiscount(offer)}`,
      description,
      type: "website",
      url: `/offer/${offer.code}`,
      ...(image ? { images: [{ url: image, alt: hero!.name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: offer.title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default function OfferPage({ params }: PageProps<"/offer/[code]">) {
  return (
    <>
      <OfferStyles />
      <Suspense fallback={<LandingSkeleton />}>
        <OfferLanding params={params} />
      </Suspense>
    </>
  );
}

/** The hero product: the one picked in the admin, else the first eligible item with a photo. */
function pickHero(offer: Offer, catalog: Product[]): Product | undefined {
  const chosen = offer.heroProductId ? catalog.find((p) => p.id === offer.heroProductId) : undefined;
  if (chosen) return chosen;
  const eligible = catalog.filter((p) => offerAppliesTo(offer, p));
  return eligible.find((p) => p.stock > 0 && (p.photo || p.imageUrl)) ?? eligible[0];
}

/** Clock read lives outside the component body so render stays pure. */
async function requestTime() {
  await connection();
  return Date.now();
}

async function OfferLanding({ params }: { params: PageProps<"/offer/[code]">["params"] }) {
  const { code } = await params;
  const data = await getPublicOffer(code);
  if (!data) notFound();
  const { offer, stats } = data;
  const [catalog, settings, now] = await Promise.all([getCatalog(), getStoreSettings(), requestTime()]);
  const state = offerState(offer, now, stats);

  if (state !== "live" && state !== "scheduled") return <OfferEnded offer={offer} state={state} />;

  const scheduled = state === "scheduled";
  const hero = pickHero(offer, catalog);
  const eligible = catalog
    .filter((p) => offerAppliesTo(offer, p) && (!settings.hideSoldOut || p.stock > 0))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || Number(!!b.p.featured) - Number(!!a.p.featured) || a.i - b.i)
    .map(({ p }) => p);
  const shown = eligible.slice(0, MAX_PRODUCTS);
  const sticker = discountSticker(offer.discount);
  const bestSaving = shown.reduce((m, p) => Math.max(m, p.price - offerUnitPrice(offer, p.price)), 0);

  return (
    <>
      <OfferActivator code={offer.code} live={!scheduled} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 75% 40%, rgba(26,92,255,.55) 0%, rgba(11,42,138,.35) 40%, transparent 75%), radial-gradient(40% 50% at 10% 100%, rgba(229,0,75,.25), transparent 70%)",
          }}
        />
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="wrap relative grid items-center gap-8 py-12 md:grid-cols-[1.05fr_1fr] md:gap-12 md:py-20">
          <div className="min-w-0">
            <p className="jdo-rise inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.16em] backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${scheduled ? "bg-[#f5c06b]" : "animate-pulse bg-[#3ddc84] motion-reduce:animate-none"}`} />
              {scheduled ? "Coming soon" : "Live offer"} · {offer.title}
            </p>
            <h1 className="jdo-rise display mt-5 text-[36px] leading-[1.05] [animation-delay:120ms] sm:text-[48px] lg:text-[60px]">
              {offer.headline || offer.title}
            </h1>
            {offer.description && (
              <p className="jdo-rise mt-4 max-w-xl text-[16px] text-white/80 [animation-delay:220ms] md:text-[18px]">{offer.description}</p>
            )}
            <div className="jdo-rise mt-6 flex flex-wrap items-center gap-3 [animation-delay:300ms]">
              <span className="jdo-shine rounded-full bg-sale px-4 py-2 text-[15px] font-extrabold uppercase tracking-wide">
                {describeDiscount(offer)}
              </span>
              {bestSaving > 0 && <span className="text-[14px] text-white/80">Save up to {formatNaira(bestSaving)} per item</span>}
            </div>
            <div className="jdo-rise mt-8 [animation-delay:400ms]">
              <OfferCountdown startsAt={offer.startsAt} endsAt={offer.endsAt} scheduled={scheduled} />
            </div>
            <div className="jdo-rise mt-8 flex flex-wrap gap-3 [animation-delay:500ms]">
              <a href="#offer-products" className="btn btn-white btn-lg">
                {scheduled ? "Preview the deals" : "Shop the offer"}
              </a>
              <Link href="/shop" className="btn btn-ghost-white btn-lg">
                Shop all
              </Link>
            </div>
            <p className="mt-4 text-[12px] text-white/60">
              {scheduled ? `Starts ${lagosDateTime(offer.startsAt)}` : `Ends ${lagosDateTime(offer.endsAt)}`} (Lagos time)
              {offer.minSubtotal ? ` · On orders of ${formatNaira(offer.minSubtotal)} or more` : ""}
            </p>
          </div>
          {hero && (
            <div className="order-first mx-auto w-full max-w-[300px] md:order-none md:max-w-none">
              <OfferHeroStage product={hero} badge={sticker} />
            </div>
          )}
        </div>
      </section>

      {/* Running ticker */}
      <div aria-hidden className="overflow-hidden border-y border-line bg-white py-3">
        <div className="jdo-marquee flex w-max gap-8 whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.18em]">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-8">
              {Array.from({ length: 6 }).map((__, i) => (
                <span key={i} className="flex items-center gap-8">
                  {describeDiscount(offer)} <span className="text-sale">✦</span> Code {offer.code.toUpperCase()} <span className="text-accent">✦</span> Escrow-protected
                  <span className="text-muted">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="wrap pt-12">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "cart" as const, t: "Add eligible items", b: "Every item below qualifies. Prices already show the offer." },
            { icon: "tag" as const, t: "Discount at checkout", b: `Code ${offer.code.toUpperCase()} is saved to your cart automatically.` },
            { icon: "shield" as const, t: "Pay with escrow", b: "Your money is held until the item matches its grade." },
          ].map((s, i) => (
            <li key={s.t} className="jdo-rise flex gap-4 rounded-tile bg-stage p-5" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
                <Icon name={s.icon} size={22} />
              </span>
              <div>
                <p className="text-[15px] font-bold">{s.t}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Products */}
      <section id="offer-products" className="wrap scroll-mt-24 pb-20 pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-[26px] md:text-[36px]">{scheduled ? "Coming soon." : "In this offer."}</h2>
            <p className="mt-1 text-[15px] text-ink-2">
              {eligible.length === 0
                ? "Items for this offer are being restocked."
                : `${eligible.length} eligible ${eligible.length === 1 ? "item" : "items"}${eligible.length > shown.length ? `, showing ${shown.length}` : ""}.`}
            </p>
          </div>
          {eligible.length > shown.length && (
            <Link href="/shop" className="link-cta">
              Browse the full shop <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </div>
        {shown.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {shown.map((p, i) => (
              <OfferProductCard key={p.id} product={p} offerPrice={offerUnitPrice(offer, p.price)} comingSoon={scheduled} index={i} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-tile bg-stage px-6 py-14 text-center">
            <p className="text-[16px] font-bold">Nothing to show just yet.</p>
            <Link href="/shop" className="btn btn-primary mt-5">
              Shop all
            </Link>
          </div>
        )}
        <p className="mt-10 text-[12px] text-muted">
          Offer runs {lagosDateTime(offer.startsAt)} to {lagosDateTime(offer.endsAt)} (Lagos time) while stock lasts. One offer per order.
          {offer.minSubtotal ? ` Minimum order ${formatNaira(offer.minSubtotal)} before discount.` : ""} Final prices are confirmed at checkout.
        </p>
      </section>
    </>
  );
}

const ENDED_COPY: Record<Exclude<OfferState, "live" | "scheduled">, { title: string; body: string }> = {
  expired: { title: "This offer has ended.", body: "You just missed it. New deals land every week." },
  paused: { title: "This offer is taking a break.", body: "It's paused for now. Check back soon, or browse today's prices." },
  exhausted: { title: "This offer sold out.", body: "Every offer slot has been claimed. Graded deals are still waiting in the shop." },
};

function OfferEnded({ offer, state }: { offer: Offer; state: Exclude<OfferState, "live" | "scheduled"> }) {
  const copy = ENDED_COPY[state];
  return (
    <section className="wrap py-16 md:py-24">
      <div className="jdo-rise mx-auto max-w-2xl rounded-tile bg-stage px-6 py-14 text-center md:px-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white">
          <Icon name="gift" size={30} strokeWidth={1.25} />
        </span>
        <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.16em] text-muted">{offer.title}</p>
        <h1 className="display mt-2 text-[30px] md:text-[40px]">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-2">{copy.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-outline">
            Home
          </Link>
          <Link href="/shop" className="btn btn-primary">
            Shop all
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingSkeleton() {
  return (
    <div aria-busy className="bg-ink">
      <div className="wrap grid items-center gap-8 py-12 md:grid-cols-2 md:py-20">
        <div>
          <div className="h-6 w-40 animate-pulse rounded-full bg-white/15" />
          <div className="mt-5 h-14 w-full max-w-md animate-pulse rounded-xl bg-white/15" />
          <div className="mt-3 h-14 w-2/3 animate-pulse rounded-xl bg-white/10" />
          <div className="mt-8 h-20 w-80 max-w-full animate-pulse rounded-xl bg-white/10" />
        </div>
        <div className="mx-auto aspect-square w-full max-w-[420px] animate-pulse rounded-[28px] bg-white/10" />
      </div>
    </div>
  );
}
