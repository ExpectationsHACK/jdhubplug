"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NavCategory, SlimProduct } from "./home/storefront";
import { formatNaira } from "./home/format";
import { ProductImage } from "./ProductImage";
import { Icon } from "./Icon";
import { CartButton } from "./cart/CartButton";
import { WishlistHeaderButton } from "./wishlist/WishlistButton";
import { Logo } from "./Logo";

const utilityNav = [
  { href: "/sell", label: "Sell" },
  { href: "/swap", label: "Swap" },
  { href: "/trust", label: "Trust & Safety" },
];

export type PromoStrip = { text: string; link: string; enabled: boolean };

/**
 * Global nav. Gets slim, live data from the store layout: categories with their
 * featured products (mega menu), a search index and the promo strip settings.
 */
export function Header({
  categories,
  searchIndex,
  promo: promoSettings,
}: {
  categories: NavCategory[];
  searchIndex: SlimProduct[];
  promo: PromoStrip;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [promo, setPromo] = useState(promoSettings.enabled && !!promoSettings.text.trim());
  const openCat = categories.find((c) => c.slug === open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSearch(false);
        setDrawer(false);
      }
      // "/" opens search, like most stores.
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer || search ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer, search]);

  return (
    <>
      {promo && (
        <div className="relative bg-ink text-white">
          {/* One paragraph so the link flows inline: two lines at most on a phone. */}
          <p className="wrap flex min-h-10 items-center justify-center py-2 pl-12 pr-12 text-center text-[12px] leading-snug md:text-[13px]">
            <span>
              {promoSettings.text}
              {promoSettings.link && (
                <>
                  {" "}
                  <Link href={promoSettings.link} className="ml-1 whitespace-nowrap font-bold underline underline-offset-4">
                    Learn more
                  </Link>
                </>
              )}
            </span>
          </p>
          <button
            aria-label="Close banner"
            onClick={() => setPromo(false)}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <header
        className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl backdrop-saturate-150"
        style={{ viewTransitionName: "site-header" }}
        onMouseLeave={() => setOpen(null)}
      >
        <div className="wrap flex h-16 items-center gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden h-full flex-1 items-stretch gap-1 lg:flex">
            {categories.map((c) => (
              <div key={c.slug} className="flex items-stretch" onMouseEnter={() => setOpen(c.slug)}>
                <Link
                  href={`/shop/${c.slug}`}
                  aria-expanded={open === c.slug}
                  onFocus={() => setOpen(c.slug)}
                  onClick={() => setOpen(null)}
                  className={`nav-link flex items-center px-3 text-[15px] font-bold transition-colors ${
                    open === c.slug ? "is-open text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {c.name}
                </Link>
              </div>
            ))}
            <span className="mx-2 my-5 w-px bg-line" />
            {utilityNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onMouseEnter={() => setOpen(null)}
                onFocus={() => setOpen(null)}
                className="nav-link flex items-center px-3 text-[15px] font-bold text-ink-2 hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <Link href="/vendors" className="mr-3 hidden text-[13px] font-bold text-ink-2 hover:text-ink xl:block">
              Sell on JDHub
            </Link>
            <button aria-label="Search" onClick={() => setSearch(true)} className="icon-btn rounded-full p-2 hover:bg-stage">
              <Icon name="search" />
            </button>
            <WishlistHeaderButton />
            <CartButton />
            <Link href="/account" aria-label="Your account" className="icon-btn hidden rounded-full p-2 hover:bg-stage sm:block">
              <Icon name="user" />
            </Link>
            <button
              aria-label="Open menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              className="icon-btn rounded-full p-2 hover:bg-stage lg:hidden"
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>

        {/* Mega menu */}
        {openCat && <MegaMenu cat={openCat} onNavigate={() => setOpen(null)} />}
      </header>

      {search && <SearchOverlay index={searchIndex} onClose={() => setSearch(false)} />}
      {drawer && <Drawer categories={categories} onClose={() => setDrawer(false)} />}
    </>
  );
}

function MegaMenu({ cat, onNavigate }: { cat: NavCategory; onNavigate: () => void }) {
  const slug = cat.slug;
  return (
    <div className="mega-in absolute inset-x-0 top-full hidden border-b border-line bg-white shadow-[0_12px_24px_rgba(0,0,0,0.06)] lg:block">
      <div className="wrap grid grid-cols-[220px_1fr] gap-10 py-8">
        <div>
          <p className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted">Shop by brand</p>
          <ul className="space-y-3">
            {cat.brands.map((b) => (
              <li key={b}>
                <Link href={`/shop/${slug}?brand=${encodeURIComponent(b)}`} onClick={onNavigate} className="text-[15px] font-bold hover:underline">
                  {b}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2 border-t border-line pt-5 text-[14px]">
            <Link href={`/shop/${slug}`} onClick={onNavigate} className="link-cta">
              Shop all {cat.name.toLowerCase()} <Icon name="chevronRight" size={16} />
            </Link>
            <br />
            <Link href="/sell" onClick={onNavigate} className="link-cta">
              Sell your {cat.name === "Cars" ? "car" : "device"} <Icon name="chevronRight" size={16} />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {cat.featured.map((l, i) => (
            <Link
              key={l.id}
              href={`/product/${l.id}`}
              onClick={onNavigate}
              className="mega-card group text-center"
              style={{ animationDelay: `${60 + i * 50}ms` }}
            >
              <div className="relative overflow-hidden rounded-tile bg-stage">
                <ProductImage
                  item={l}
                  width={330}
                  className="aspect-square w-full transition-transform duration-500 group-hover:scale-105"
                  artClassName="h-32 w-32"
                />
                {l.stock <= 0 && (
                  <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Sold out</span>
                )}
              </div>
              <p className="mt-3 text-[14px] font-bold">{l.name}</p>
              <p className="text-[13px] text-muted">From {formatNaira(l.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Every word of the query must appear in the brand, name or spec. In-stock first. */
function searchProducts<T extends Pick<SlimProduct, "brand" | "name" | "spec" | "stock">>(items: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = items.filter((l) => {
    const hay = `${l.brand} ${l.name} ${l.spec}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return hits.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
}

function SearchOverlay({ index, onClose }: { index: SlimProduct[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchProducts(index, q).slice(0, 7), [index, q]);
  const popular = ["iPhone 15 Pro Max", "AirPods", "PS5", "Toyota Camry", "MacBook"];
  const all = `/shop?q=${encodeURIComponent(q.trim())}`;

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && results.length) {
      e.preventDefault();
      const n = results.length + 1; // results + "see all"
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter" && q.trim()) {
      e.preventDefault();
      const hit = results[active];
      onClose();
      router.push(hit ? `/product/${hit.id}` : all);
    }
  };

  return (
    <div className="overlay-in fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="sheet-down bg-white" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search">
        <div className="wrap py-6">
          <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
            <Icon name="search" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-results"
              aria-autocomplete="list"
              aria-activedescendant={results.length ? `search-opt-${active}` : undefined}
              aria-label="Search JDHub"
              placeholder="Search phones, gadgets, cars…"
              className="min-w-0 flex-1 bg-transparent text-[18px] outline-none placeholder:text-muted md:text-[20px]"
            />
            <button aria-label="Close search" onClick={onClose} className="rounded-full p-1 hover:bg-stage">
              <Icon name="close" />
            </button>
          </div>
          {results.length > 0 ? (
            <ul id="search-results" role="listbox" aria-label="Search results" className="mt-4 max-h-[70vh] divide-y divide-line overflow-y-auto">
              {results.map((l, i) => (
                <li key={l.id} id={`search-opt-${i}`} role="option" aria-selected={active === i}>
                  <Link
                    href={`/product/${l.id}`}
                    onClick={onClose}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center gap-4 rounded-xl px-2 py-3 ${active === i ? "bg-stage" : ""}`}
                  >
                    <ProductImage item={l} width={120} className="h-12 w-12 shrink-0 rounded-lg bg-stage" artClassName="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{l.name}</span>
                      <span className="block truncate text-[13px] text-muted">{l.stock > 0 ? l.spec : `Sold out · ${l.spec}`}</span>
                    </span>
                    <span className="shrink-0 text-[14px] font-bold md:text-[15px]">{formatNaira(l.price)}</span>
                  </Link>
                </li>
              ))}
              <li id={`search-opt-${results.length}`} role="option" aria-selected={active === results.length}>
                <Link href={all} onClick={onClose} className={`link-cta w-full rounded-xl px-2 py-4 ${active === results.length ? "bg-stage" : ""}`}>
                  See all results for &ldquo;{q.trim()}&rdquo; <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            </ul>
          ) : (
            <div className="mt-6">
              <p className="mb-3 text-[13px] font-bold uppercase tracking-wider text-muted">
                {q ? "No matches yet. Try one of these" : "Popular searches"}
              </p>
              <div className="flex flex-wrap gap-2">
                {popular.map((p) => (
                  <button key={p} onClick={() => setQ(p)} className="rounded-full border border-line px-4 py-2 text-[14px] hover:border-ink">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Drawer({ categories, onClose }: { categories: NavCategory[]; onClose: () => void }) {
  const [sub, setSub] = useState<string | null>(null);
  const cat = categories.find((c) => c.slug === sub);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className="overlay-in fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={onClose}>
      <div
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          {cat ? (
            <button onClick={() => setSub(null)} className="flex items-center gap-1 text-[15px] font-bold">
              <Icon name="chevronLeft" size={20} /> {cat.name}
            </button>
          ) : (
            <Logo />
          )}
          <button ref={closeRef} aria-label="Close menu" onClick={onClose} className="rounded-full p-2 hover:bg-stage">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cat ? (
            <ul key={cat.slug} className="fade-in">
              {cat.featured.length > 0 && (
                <li className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-3">
                  {cat.featured.map((l) => (
                    <Link key={l.id} href={`/product/${l.id}`} onClick={onClose} className="w-28 shrink-0">
                      <ProductImage item={l} width={250} className="aspect-square w-full rounded-xl bg-stage" artClassName="h-20 w-20" />
                      <span className="mt-1.5 block truncate text-[12px] font-bold">{l.name}</span>
                    </Link>
                  ))}
                </li>
              )}
              <li>
                <Link href={`/shop/${cat.slug}`} onClick={onClose} className="block py-4 text-[17px] font-bold">
                  Shop all {cat.name.toLowerCase()}
                </Link>
              </li>
              {cat.brands.map((b) => (
                <li key={b}>
                  <Link href={`/shop/${cat.slug}?brand=${encodeURIComponent(b)}`} onClick={onClose} className="block py-3 text-[15px]">
                    {b}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <ul className="border-b border-line">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <button onClick={() => setSub(c.slug)} className="flex w-full items-center justify-between py-4 text-[17px] font-bold">
                      {c.name} <Icon name="chevronRight" size={20} />
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="py-2">
                {[...utilityNav, { href: "/vendors", label: "Sell on JDHub" }, { href: "/wishlist", label: "Wishlist" }, { href: "/account", label: "Your account" }].map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} onClick={onClose} className="block py-3 text-[15px] font-bold text-ink-2">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
