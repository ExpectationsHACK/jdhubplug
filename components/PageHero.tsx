import Link from "next/link";
import type { CSSProperties } from "react";
import type { Product } from "@/lib/types";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductImage";
import { TONE_ICON, type Tone } from "@/lib/tones";

export function Breadcrumbs({ trail }: { trail: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map(([label, href], i) => (
          <li key={label} className="flex min-w-0 items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={14} />}
            {href ? (
              <Link href={href} className="hover:text-ink hover:underline">
                {label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-ink">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHero({
  eyebrow,
  title,
  body,
  trail,
  tone,
  children,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  trail: [string, string?][];
  /** Colour tone: draws the banner on a drifting tinted backdrop with the tone's icon. */
  tone?: Tone;
  children?: React.ReactNode;
}) {
  const icon = tone ? TONE_ICON[tone] : undefined;
  return (
    <section className="wrap pb-10 pt-6" data-tone={tone}>
      <Breadcrumbs trail={trail} />
      <div className={tone ? "aurora mt-6 rounded-tile px-5 py-12 text-center md:py-16" : "pt-10 text-center"}>
        {icon && (
          <>
            <span className="tone-badge fade-in mx-auto mb-4 h-14 w-14 bg-white shadow-sm">
              <Icon name={icon} size={28} />
            </span>
            <span aria-hidden className="hidden md:block">
              <Icon name={icon} size={72} strokeWidth={1} className="float-icon left-[6%] top-[18%]" />
              <Icon name={icon} size={44} strokeWidth={1.25} className="float-icon bottom-[14%] left-[16%] [--o:1]" />
              <Icon name={icon} size={64} strokeWidth={1} className="float-icon right-[7%] top-[24%] [--o:2]" />
              <Icon name="star" size={36} strokeWidth={1.25} className="float-icon bottom-[18%] right-[18%] [--o:3]" />
            </span>
          </>
        )}
        {eyebrow && <p className={`fade-in mb-2 text-[14px] font-bold ${tone ? "tone-text" : "text-accent"}`}>{eyebrow}</p>}
        <h1 className="fade-in display text-[32px] md:text-[48px]">{title}</h1>
        {body && <p className="fade-in mx-auto mt-4 max-w-2xl text-[16px] text-ink-2 md:text-[18px]">{body}</p>}
        {children}
      </div>
    </section>
  );
}

/**
 * Fanned row of product photos for page headers (category pages, shop, vendors).
 * Cards deal in from the centre on load and float gently; links open each product.
 */
export function PhotoCollage({ items, className = "" }: { items: Product[]; className?: string }) {
  const shown = items.slice(0, 5);
  if (!shown.length) return null;
  const mid = (shown.length - 1) / 2;
  return (
    <ul aria-label="Featured products" className={`collage mx-auto mt-10 flex max-w-3xl items-end justify-center ${className}`}>
      {shown.map((p, i) => {
        const o = i - mid;
        return (
          <li
            key={p.id}
            className={`collage-card ${Math.abs(o) > 1 ? "hidden sm:block" : ""}`}
            style={{ "--o": o, "--a": Math.abs(o), "--d": `${Math.abs(o) * 90 + 100}ms`, zIndex: 10 - Math.round(Math.abs(o)) } as CSSProperties}
          >
            <Link href={`/product/${p.id}`} className="group block" aria-label={p.name}>
              <span className="collage-float block overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_-16px_rgba(0,0,0,0.35)]">
                <ProductImage placeholder="shimmer"
                  item={p}
                  width={330}
                  priority
                  className="aspect-square w-full transition-transform duration-500 group-hover:scale-105"
                  artClassName="h-3/4 w-3/4"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
