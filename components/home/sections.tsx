import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Product } from "@/lib/types";
import { DeviceArt } from "../DeviceArt";
import { Icon } from "../Icon";
import { Counter } from "../motion/Counter";
import { Marquee } from "../motion/Marquee";
import { Reveal } from "../motion/Reveal";
import { ProductImage } from "../ProductImage";

// Home page building blocks. Server components; motion comes from CSS classes and
// the small client components in components/motion.

/** Endless band of brands, each paired with one of its product photos. */
export function BrandMarquee({ items }: { items: { brand: string; product?: Product }[] }) {
  return (
    <Marquee label="Brands on JDHub" seconds={Math.max(28, items.length * 4)} className="border-y border-line bg-white py-5">
      {items.map(({ brand, product }) => (
        <Link
          key={brand}
          href={product ? `/shop/${product.category}?brand=${encodeURIComponent(brand)}` : "/shop"}
          className="group mx-3 flex shrink-0 items-center gap-3 rounded-full py-1 pl-1 pr-5 transition-colors hover:bg-stage"
          tabIndex={-1}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-stage">
            {product ? (
              <ProductImage item={product} width={120} className="h-full w-full transition-transform duration-500 group-hover:scale-110" artClassName="h-9 w-9" />
            ) : null}
          </span>
          <span className="display whitespace-nowrap text-[20px] md:text-[24px]">{brand}</span>
        </Link>
      ))}
    </Marquee>
  );
}

/** Live numbers that count up as they scroll into view. */
export function StatsBand({ stats }: { stats: { value: number; suffix?: string; prefix?: string; label: string }[] }) {
  return (
    <section aria-label="JDHub in numbers" className="wrap pt-20">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} index={i} className="flex flex-col rounded-tile bg-stage px-5 py-8 text-center md:py-10">
            <dt className="text-[13px] font-bold text-muted md:text-[14px]">{s.label}</dt>
            <dd className="display order-first mt-1 text-[36px] md:text-[52px]">
              <Counter value={s.value} suffix={s.suffix} prefix={s.prefix} />
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

/** Product photo in a soft-shadowed tile, used as editorial art. */
export function TilePhoto({ item, wide, className = "" }: { item?: Product; wide?: boolean; className?: string }) {
  if (!item) return null;
  return (
    <div
      className={`overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${
        wide ? "w-full max-w-md" : "w-48 sm:w-56 md:w-72"
      } ${className}`}
    >
      <ProductImage item={item} width={500} className={`w-full ${wide ? "aspect-[16/10]" : "aspect-square"}`} artClassName="h-40 w-40" />
    </div>
  );
}

/** Small fan of overlapping product photos (vendors tile, trade-up banner). */
export function PhotoFan({ items, size = "md" }: { items: Product[]; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-24 md:w-32" : "w-32 md:w-44";
  return (
    <div className="photo-fan flex items-end justify-center">
      {items.slice(0, 3).map((p, i) => (
        <div
          key={p.id}
          className={`photo-fan-card ${w} overflow-hidden rounded-xl bg-white shadow-[0_14px_30px_rgba(0,0,0,0.22)]`}
          style={{ "--fan": i - 1 } as CSSProperties}
        >
          <ProductImage item={p} width={330} className="aspect-square w-full" artClassName="h-20 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ExploreTile({
  href,
  eyebrow,
  title,
  cta,
  bg,
  dark,
  art,
  large,
  index = 0,
}: {
  href: string;
  eyebrow: string;
  title: string;
  cta: string;
  bg: string;
  dark?: boolean;
  art: ReactNode;
  large?: boolean;
  index?: number;
}) {
  return (
    <Reveal index={index % 2} className="h-full">
      <Link
        href={href}
        className={`explore-tile group relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-tile p-7 md:p-10 ${
          large ? "min-h-[440px] md:min-h-[500px]" : "min-h-[360px]"
        } ${dark ? "text-white" : "text-ink"}`}
        style={{ background: bg }}
      >
        <div className="relative z-[1]">
          <p className={`text-[14px] font-bold ${dark ? "text-white/70" : "text-muted"}`}>{eyebrow}</p>
          <h3 className="display mt-2 max-w-sm text-[24px] md:text-[30px]">{title}</h3>
          <span className={`btn mt-6 ${dark ? "btn-white" : "btn-primary"}`}>
            {cta} <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
        <div className="parallax flex justify-end">
          <div className="transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]">
            {art}
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

/** One tile per category with its best product photo. */
export function CategoryTile({
  href,
  name,
  tagline,
  item,
  art,
  index,
}: {
  href: string;
  name: string;
  tagline: string;
  item?: Product;
  art: Product["art"];
  index: number;
}) {
  return (
    <Reveal index={index}>
      <Link href={href} className="group block rounded-tile bg-stage p-6 text-center transition-shadow hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
        <div className="overflow-hidden rounded-xl bg-white">
          {item ? (
            <ProductImage
              item={item}
              width={500}
              className="aspect-[4/3] w-full transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.06]"
              artClassName="h-36 w-36"
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center">
              <DeviceArt kind={art} className="h-36 w-36" />
            </div>
          )}
        </div>
        <h3 className="display mt-4 text-[22px]">{name}</h3>
        <p className="mt-1 text-[14px] text-ink-2">{tagline}</p>
        <span className="link-cta mt-4">
          Shop now <Icon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </Reveal>
  );
}
