// Server-friendly building blocks for the order, customer and request screens (no hooks).

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import type { ArtKind, OrderLine, OrderStatus, Product } from "@/lib/types";
import { Badge, ORDER_TONE } from "../ui";
import { STATUS_LABEL } from "./format";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export type ArtInfo = { art: ArtKind; tint: string };
export type ArtMap = Record<string, ArtInfo>;

/** Fallback-illustration info for every product referenced by the given lines. */
export function artFor(products: Map<string, Product>): ArtMap {
  const out: ArtMap = {};
  for (const [id, p] of products) out[id] = { art: p.art, tint: p.tint };
  return out;
}

/** Order line photo on a grey stage, falling back to the product's illustration. */
export function LineThumb({ line, art, size = 48 }: { line: Pick<OrderLine, "productId" | "name" | "photo" | "imageUrl">; art?: ArtInfo; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-stage" style={{ width: size, height: size }}>
      <ProductImage
        item={{ name: line.name, photo: line.photo, imageUrl: line.imageUrl, art: art?.art ?? "phone", tint: art?.tint ?? "#2a2a2a" }}
        width={size <= 60 ? 120 : 250}
        className="h-full w-full"
        artClassName="h-4/5 w-4/5"
      />
    </div>
  );
}

/** Underlined text tabs (role=tablist semantics are wrong for links, so this is a nav). */
export function TabNav({ label, tabs }: { label: string; tabs: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-6 border-b border-line">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.active ? "page" : undefined}
              className={`relative flex items-center gap-2 pb-3 pt-1 text-[14px] font-bold transition-colors after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                t.active ? "text-ink after:bg-ink" : "text-muted after:bg-transparent hover:text-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${t.active ? "bg-ink text-white" : "bg-stage text-ink-2"}`}>{t.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Pagination({ page, pages, total, perPage, href }: { page: number; pages: number; total: number; perPage: number; href: (p: number) => string }) {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-[13px] font-bold transition-colors";
  const btn = `${base} border-line bg-white hover:border-ink`;
  const current = `${base} border-ink bg-ink text-white`;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col items-center justify-between gap-3 text-[13px] text-muted sm:flex-row">
      <p>
        Showing <b className="text-ink">{from.toLocaleString("en-NG")}</b>–<b className="text-ink">{to.toLocaleString("en-NG")}</b> of{" "}
        <b className="text-ink">{total.toLocaleString("en-NG")}</b>
      </p>
      {pages > 1 && (
        <ul className="flex items-center gap-1.5">
          <li>
            {page > 1 ? (
              <Link href={href(page - 1)} className={btn} aria-label="Previous page">
                ‹
              </Link>
            ) : (
              <span className={`${btn} pointer-events-none opacity-40`} aria-hidden>
                ‹
              </span>
            )}
          </li>
          {nums.map((n, i) => (
            <li key={n} className="flex items-center gap-1.5">
              {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden>…</span>}
              <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={n === page ? current : btn}>
                {n}
              </Link>
            </li>
          ))}
          <li>
            {page < pages ? (
              <Link href={href(page + 1)} className={btn} aria-label="Next page">
                ›
              </Link>
            ) : (
              <span className={`${btn} pointer-events-none opacity-40`} aria-hidden>
                ›
              </span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}

/** Small round icon link (call / WhatsApp / email). */
export function IconLink({ href, label, kind, external }: { href: string; label: string; kind: "phone" | "wa" | "mail"; external?: boolean }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        kind === "wa" ? "border-transparent bg-wa text-white hover:brightness-95" : "border-line bg-white hover:border-ink"
      }`}
    >
      {kind === "phone" && (
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
        </svg>
      )}
      {kind === "mail" && (
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      )}
      {kind === "wa" && <WaGlyph />}
    </a>
  );
}

/** Big money value for a StatCard that steps down a size on phones so ₦100m+ fits a half-width card. */
export function StatMoney({ children }: { children: React.ReactNode }) {
  return <span className="block break-words text-[19px] sm:text-[26px]">{children}</span>;
}

/** Initials in a grey circle. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-stage font-bold text-ink-2" style={{ width: size, height: size, fontSize: size * 0.33 }}>
      {initials}
    </span>
  );
}

export function WaGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.4 4.9 5-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.2 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3z" />
    </svg>
  );
}
