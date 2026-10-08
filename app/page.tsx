import Link from "next/link";
import { DeviceArt } from "@/components/DeviceArt";
import { HeroCarousel } from "@/components/HeroCarousel";
import { Icon, type IconName } from "@/components/Icon";
import { ShowcaseTabs } from "@/components/ShowcaseTabs";
import { categories, grades } from "@/lib/catalog";

const quickLinks: { label: string; href: string; icon: IconName }[] = [
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

export default function Home() {
  return (
    <>
      <HeroCarousel />

      {/* Quick category navigation */}
      <nav aria-label="Quick links" className="wrap">
        <ul className="no-scrollbar flex gap-4 overflow-x-auto py-10 md:justify-center md:gap-8">
          {quickLinks.map((q) => (
            <li key={q.label} className="shrink-0">
              <Link href={q.href} className="group flex w-20 flex-col items-center gap-3 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-stage transition-colors group-hover:bg-ink group-hover:text-white">
                  <Icon name={q.icon} size={28} />
                </span>
                <span className="text-[13px] font-bold">{q.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ShowcaseTabs />

      {/* Explore: large editorial tiles */}
      <section className="wrap pt-24">
        <h2 className="display text-center text-[28px] md:text-[40px]">Explore JDHub</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <ExploreTile
            href="/sell"
            eyebrow="Sell"
            title="Your old phone is worth more than you think."
            cta="Get an instant offer"
            bg="linear-gradient(135deg,#0b2a8a,#1a5cff)"
            dark
            art={<DeviceArt kind="phone" tint="#2e4a6b" className="h-56 w-56 md:h-72 md:w-72" />}
            large
          />
          <ExploreTile
            href="/shop/cars"
            eyebrow="Cars"
            title="VIN-checked. Inspected. Ready to drive."
            cta="Shop cars"
            bg="#111"
            dark
            art={<DeviceArt kind="car" tint="#7a1f24" className="h-48 w-full max-w-md md:h-64" />}
            large
          />
          <ExploreTile
            href="/shop/gadgets"
            eyebrow="Gadgets"
            title="Laptops, consoles and drones, graded like phones."
            cta="Shop gadgets"
            bg="#f4f4f4"
            art={<DeviceArt kind="laptop" tint="#b9bcc1" className="h-44 w-44 md:h-56 md:w-56" />}
          />
          <ExploreTile
            href="/vendors"
            eyebrow="Business"
            title="Sell on JDHub. Reach buyers who trust the grade."
            cta="Become a vendor"
            bg="#e9ecf5"
            art={<Icon name="store" size={120} strokeWidth={1} className="text-accent-deep" />}
          />
        </div>
      </section>

      {/* Brand promises */}
      <section className="wrap pt-24">
        <h2 className="display text-center text-[28px] md:text-[40px]">Trade with certainty</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[16px] text-ink-2">
          Online trade in Nigeria runs on trust. We built the trust in, so nobody has to go first.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((p) => (
            <div key={p.title} className="rounded-tile border border-line p-6">
              <Icon name={p.icon} size={36} strokeWidth={1.25} />
              <h3 className="mt-5 text-[18px] font-bold">{p.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Grading strip */}
      <section className="pt-24">
        <div className="bg-stage py-16">
          <div className="wrap">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-[14px] font-bold text-accent">The JDHub Grade</p>
                <h2 className="display mt-2 text-[28px] md:text-[40px]">Four grades. Zero guesswork.</h2>
              </div>
              <Link href="/trust#grading" className="link-cta">
                How we grade <Icon name="chevronRight" size={16} />
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {grades.map((g) => (
                <div key={g.id} className="rounded-tile bg-white p-6">
                  <span className="display grid h-12 w-12 place-items-center rounded-full bg-ink text-[20px] text-white">{g.letter}</span>
                  <h3 className="mt-5 text-[20px] font-bold">{g.name}</h3>
                  <p className="text-[14px] font-bold text-muted">{g.summary}</p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{g.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Category banner row */}
      <section className="wrap pt-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.slug} href={`/shop/${c.slug}`} className="group rounded-tile bg-stage p-6 text-center">
              <DeviceArt kind={c.art} className="mx-auto h-36 w-36 transition-transform duration-300 group-hover:scale-105" />
              <h3 className="display mt-4 text-[22px]">{c.name}</h3>
              <p className="mt-1 text-[14px] text-ink-2">{c.tagline}</p>
              <span className="link-cta mt-4">
                Shop now <Icon name="chevronRight" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trade-up banner */}
      <section className="wrap pt-24">
        <div className="relative overflow-hidden rounded-tile bg-ink px-6 py-14 text-center text-white md:px-16 md:py-20">
          <p className="text-[14px] font-bold text-white/70">JDHub Trade-Up</p>
          <h2 className="display mx-auto mt-3 max-w-3xl text-[28px] md:text-[44px]">Upgrade every year. Pay less every time.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-white/75">
            Frequent upgraders get priority offers and reduced fees on every repeat swap.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/swap" className="btn btn-ghost-white">
              Learn more
            </Link>
            <Link href="/account" className="btn btn-white">
              Join free
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ExploreTile({
  href,
  eyebrow,
  title,
  cta,
  bg,
  dark,
  art,
  large,
}: {
  href: string;
  eyebrow: string;
  title: string;
  cta: string;
  bg: string;
  dark?: boolean;
  art: React.ReactNode;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-tile p-8 md:p-10 ${
        large ? "min-h-[480px]" : "min-h-[360px]"
      } ${dark ? "text-white" : "text-ink"}`}
      style={{ background: bg }}
    >
      <div>
        <p className={`text-[14px] font-bold ${dark ? "text-white/70" : "text-muted"}`}>{eyebrow}</p>
        <h3 className="display mt-2 max-w-sm text-[24px] md:text-[30px]">{title}</h3>
        <span className={`btn mt-6 ${dark ? "btn-white" : "btn-primary"}`}>{cta}</span>
      </div>
      <div className="flex justify-end transition-transform duration-500 group-hover:scale-[1.03]">{art}</div>
    </Link>
  );
}
