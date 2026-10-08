import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BrandMarquee, CategoryTile, ExploreTile, PhotoFan, StatsBand, TilePhoto } from "@/components/home/sections";
import { featuredIn, getStorefront, heroProducts, modelReps } from "@/components/home/storefront";
import { Icon, type IconName } from "@/components/Icon";
import { Magnetic } from "@/components/motion/Magnetic";
import { PageTransition } from "@/components/motion/PageTransition";
import { ProductOrbit } from "@/components/motion/ProductOrbit";
import { Reveal, RevealText } from "@/components/motion/Reveal";
import { ScrollSpotlight } from "@/components/motion/ScrollSpotlight";
import { ShowcaseTabs } from "@/components/ShowcaseTabs";
import { categories, grades } from "@/lib/catalog";
import type { CategorySlug, Product } from "@/lib/types";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const quickLinks:{ label: string; href: string; icon: IconName }[] = [
  { label: "Phones", href: "/shop/phones", icon: "smartphone" },
  { label: "Accessories", href: "/shop/accessories", icon: "headphones" },
  { label: "Gadgets", href: "/shop/gadgets", icon: "laptop" },
  { label: "Cars", href: "/shop/cars", icon: "car" },
  { label: "Sell", href: "/sell", icon: "wallet" },
  { label: "Swap", href: "/swap", icon: "swap" },
  { label: "IMEI check", href: "/trust#verify", icon: "scan" },
  { label: "Offers", href: "/shop", icon: "tag" },
];

const promises: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Escrow on every order", body: "Your money is held until you confirm the item arrived as described." },
  { icon: "checkCircle", title: "One grading standard", body: "Like New, Great, Good or Fair. The same four grades across every category." },
  { icon: "scan", title: "IMEI & VIN verified", body: "Every phone and car is checked against blacklists before it can list." },
  { icon: "wallet", title: "Paid within 48 hours", body: "Sell to JDHub and get your money within two days of inspection." },
];

/** The most impressive in-stock phone with a photo, for the scroll spotlight. */
function spotlightProduct(products: Product[]): Product | undefined {
  const phones = modelReps(products, "phones").filter((p) => p.stock > 0 && (p.photo || p.imageUrl));
  const pool = phones.length ? phones : modelReps(products).filter((p) => p.stock > 0);
  return [...pool].sort((a, b) => Number(!!b.attrs["Battery health"]) - Number(!!a.attrs["Battery health"]) || b.price - a.price)[0];
}

export default async function Home() {
  const { products, settings } = await getStorefront();
  const hero = heroProducts(products, settings, 10);
  const top = (slug: CategorySlug, n: number) => featuredIn(products, slug, n);
  const spotlight = spotlightProduct(products);

  const tabs = categories.map((c) => ({ slug: c.slug, name: c.name, blurb: c.blurb, items: top(c.slug, 8) }));

  // One product photo per brand for the marquee, in-stock where possible.
  const brandItems = [...new Map(modelReps(products).map((p) => [p.brand, p] as const)).entries()]
    .slice(0, 16)
    .map(([brand, product]) => ({ brand, product }));

  const inStock = products.filter((p) => p.stock > 0);
  const stats = [
    { value: inStock.length, label: "Graded listings live now" },
    { value: categories.length, label: "Categories, one grading standard" },
    { value: new Set(products.map((p) => p.state)).size, label: "States we ship from" },
    { value: 48, suffix: "h", label: "From inspection to payout" },
  ];

  const phonesTop = top("phones", 6);
  const sellPhoto = phonesTop.find((p) => /iphone/i.test(p.name)) ?? phonesTop[0];
  const carPhoto = top("cars", 1)[0];
  const gadgetPhoto = top("gadgets", 1)[0];
  const accessoryFan = top("accessories", 3);
  const tradeFan = phonesTop.slice(0, 3);

  return (
    <PageTransition>
      {hero.length >= 3 ? (
        <ProductOrbit products={hero} />
      ) : (
        <section className="bg-ink px-4 py-24 text-center text-white">
          <h1 className="display text-[34px] md:text-[56px]">Trade with certainty.</h1>
          <Link href="/shop" className="btn btn-white btn-lg mt-8">
            Shop now
          </Link>
        </section>
      )}

      {brandItems.length > 3 && <BrandMarquee items={brandItems} />}

      {/* Quick category navigation */}
      <nav aria-label="Quick links" className="wrap">
        <ul className="no-scrollbar flex gap-4 overflow-x-auto py-10 md:justify-center md:gap-8">
          {quickLinks.map((q, i) => (
            <li key={q.label} className="quick-link shrink-0" style={{ "--i": i } as CSSProperties}>
              <Link href={q.href} className="group flex w-20 flex-col items-center gap-3 rounded-xl text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-stage transition-[background-color,color,transform] duration-300 group-hover:-translate-y-1 group-hover:bg-ink group-hover:text-white">
                  <Icon name={q.icon} size={28} />
                </span>
                <span className="text-[13px] font-bold">{q.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ShowcaseTabs tabs={tabs} />

      {spotlight && <ScrollSpotlight product={spotlight} />}

      <StatsBand stats={stats} />

      {/* Explore: large editorial tiles */}
      <section className="wrap pt-24" aria-labelledby="explore-title">
        <RevealText id="explore-title" text="Explore JDHub" className="display text-center text-[28px] md:text-[40px]" />
        <p className="mt-3 text-center text-[16px] text-ink-2">
          {inStock.length} graded listings across phones, accessories, gadgets and cars.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <ExploreTile
            index={0}
            href="/sell"
            eyebrow="Sell"
            title="Your old phone is worth more than you think."
            cta="Get an instant offer"
            bg="linear-gradient(135deg,#0b2a8a,#1a5cff)"
            dark
            art={<TilePhoto item={sellPhoto} />}
            large
          />
          <ExploreTile
            index={1}
            href="/shop/cars"
            eyebrow="Cars"
            title="VIN-checked. Inspected. Ready to drive."
            cta="Shop cars"
            bg="#111"
            dark
            art={<TilePhoto item={carPhoto} wide />}
            large
          />
          <ExploreTile
            index={2}
            href="/shop/gadgets"
            eyebrow="Gadgets"
            title="Laptops, consoles and drones, graded like phones."
            cta="Shop gadgets"
            bg="#f4f4f4"
            art={<TilePhoto item={gadgetPhoto} />}
          />
          <ExploreTile
            index={3}
            href="/vendors"
            eyebrow="Business"
            title="Sell on JDHub. Reach buyers who trust the grade."
            cta="Become a vendor"
            bg="#e9ecf5"
            art={accessoryFan.length ? <PhotoFan items={accessoryFan} /> : <Icon name="store" size={120} strokeWidth={1} className="text-accent-deep" />}
          />
        </div>
      </section>

      {/* Brand promises */}
      <section className="wrap pt-24" aria-labelledby="promises-title">
        <RevealText id="promises-title" text="Trade with certainty" className="display text-center text-[28px] md:text-[40px]" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-[16px] text-ink-2">
          Online trade in Nigeria runs on trust. We built the trust in, so nobody has to go first.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((p, i) => (
            <Reveal key={p.title} index={i} className="promise rounded-tile border border-line p-6">
              <Icon name={p.icon} size={36} strokeWidth={1.25} />
              <h3 className="mt-5 text-[18px] font-bold">{p.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Grading strip */}
      <section className="pt-24" aria-labelledby="grades-title">
        <div className="bg-stage py-16">
          <div className="wrap">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-[14px] font-bold text-accent">The JDHub Grade</p>
                <RevealText id="grades-title" text="Four grades. Zero guesswork." className="display mt-2 text-[28px] md:text-[40px]" />
              </div>
              <Link href="/trust#grading" className="link-cta">
                How we grade <Icon name="chevronRight" size={16} />
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {grades.map((g, i) => (
                <Reveal key={g.id} index={i} className="rounded-tile bg-white p-6">
                  <span className="display grid h-12 w-12 place-items-center rounded-full bg-ink text-[20px] text-white">{g.letter}</span>
                  <h3 className="mt-5 text-[20px] font-bold">{g.name}</h3>
                  <p className="text-[14px] font-bold text-muted">{g.summary}</p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{g.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Category banner row */}
      <section className="wrap pt-24" aria-label="Shop by category">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c, i) => (
            <CategoryTile key={c.slug} index={i} href={`/shop/${c.slug}`} name={c.name} tagline={c.tagline} item={top(c.slug, 1)[0]} art={c.art} />
          ))}
        </div>
      </section>

      {/* Trade-up banner */}
      <section className="wrap pt-24">
        <div className="tradeup relative overflow-hidden rounded-tile bg-ink px-6 py-14 text-center text-white md:px-16 md:py-20">
          <div aria-hidden className="tradeup-glow" />
          {tradeFan.length === 3 && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-8 lg:flex">
              <div className="float-a opacity-90">
                <TilePhoto item={tradeFan[0]} className="!w-36" />
              </div>
              <div className="float-b opacity-90">
                <TilePhoto item={tradeFan[1]} className="!w-36" />
              </div>
            </div>
          )}
          <div className="relative">
            <p className="text-[14px] font-bold text-white/70">JDHub Trade-Up</p>
            <h2 className="display mx-auto mt-3 max-w-3xl text-[28px] md:text-[44px]">Upgrade every year. Pay less every time.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-white/75">
              Frequent upgraders get priority offers and reduced fees on every repeat swap.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Magnetic>
                <Link href="/swap" className="btn btn-ghost-white">
                  Learn more
                </Link>
              </Magnetic>
              <Magnetic>
                <Link href="/account" className="btn btn-white">
                  Join free
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
