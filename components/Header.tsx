"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categories, featuredIn, listings, formatNaira } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

const utilityNav = [
  { href: "/sell", label: "Sell" },
  { href: "/swap", label: "Swap" },
  { href: "/trust", label: "Trust & Safety" },
];

export function Header() {
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [promo, setPromo] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSearch(false);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer || search ? "hidden" : "";
  }, [drawer, search]);

  return (
    <>
      {promo && (
        <div className="relative bg-ink text-white">
          <div className="wrap flex min-h-10 flex-wrap items-center justify-center gap-x-3 py-2 pr-12 text-center text-[12px] md:text-[13px]">
            <span>Every order escrow-protected. Get paid within 48 hours when you sell.</span>
            <Link href="/trust" className="font-bold underline underline-offset-4">
              Learn more
            </Link>
          </div>
          <button
            aria-label="Close banner"
            onClick={() => setPromo(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-80 hover:opacity-100"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-white" onMouseLeave={() => setOpen(null)}>
        <div className="wrap flex h-16 items-center gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden h-full flex-1 items-stretch gap-1 lg:flex">
            {categories.map((c) => (
              <div key={c.slug} className="flex items-stretch" onMouseEnter={() => setOpen(c.slug)}>
                <Link
                  href={`/shop/${c.slug}`}
                  aria-expanded={open === c.slug}
                  onFocus={() => setOpen(c.slug)}
                  className={`flex items-center px-3 text-[15px] font-bold transition-colors ${
                    open === c.slug ? "text-ink underline underline-offset-[22px] decoration-2" : "text-ink-2"
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
                className="flex items-center px-3 text-[15px] font-bold text-ink-2 hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <Link href="/vendors" className="mr-3 hidden text-[13px] font-bold text-ink-2 hover:text-ink xl:block">
              Sell on JDHub
            </Link>
            <button aria-label="Search" onClick={() => setSearch(true)} className="rounded-full p-2 hover:bg-stage">
              <Icon name="search" />
            </button>
            <Link href="/shop" aria-label="Cart" className="relative rounded-full p-2 hover:bg-stage">
              <Icon name="cart" />
              <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                0
              </span>
            </Link>
            <Link href="/account" aria-label="Account" className="hidden rounded-full p-2 hover:bg-stage sm:block">
              <Icon name="user" />
            </Link>
            <button aria-label="Open menu" onClick={() => setDrawer(true)} className="rounded-full p-2 hover:bg-stage lg:hidden">
              <Icon name="menu" />
            </button>
          </div>
        </div>

        {/* Mega menu */}
        {open && <MegaMenu slug={open} onNavigate={() => setOpen(null)} />}
      </header>

      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      {drawer && <Drawer onClose={() => setDrawer(false)} />}
    </>
  );
}

function MegaMenu({ slug, onNavigate }: { slug: string; onNavigate: () => void }) {
  const cat = categories.find((c) => c.slug === slug)!;
  const featured = featuredIn(cat.slug, 4);
  return (
    <div className="absolute inset-x-0 top-full hidden border-b border-line bg-white shadow-[0_12px_24px_rgba(0,0,0,0.06)] lg:block">
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
          {featured.map((l) => (
            <Link key={l.id} href={`/product/${l.id}`} onClick={onNavigate} className="group text-center">
              <div className="overflow-hidden rounded-tile bg-stage">
                <ProductImage item={l} width={320} className="aspect-square w-full transition-transform duration-300 group-hover:scale-105" artClassName="h-32 w-32" />
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

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const results = q.trim()
    ? listings.filter((l) => `${l.brand} ${l.name} ${l.spec}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];
  const popular = ["iPhone 15 Pro Max", "AirPods", "PS5", "Toyota Camry", "MacBook"];
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="bg-white" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="wrap py-6">
          <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
            <Icon name="search" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phones, gadgets, cars…"
              className="flex-1 bg-transparent text-[20px] outline-none placeholder:text-muted"
            />
            <button aria-label="Close search" onClick={onClose} className="p-1">
              <Icon name="close" />
            </button>
          </div>
          {results.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {results.map((l) => (
                <li key={l.id}>
                  <Link href={`/product/${l.id}`} onClick={onClose} className="flex items-center gap-4 py-3 hover:bg-stage">
                    <ProductImage item={l} width={120} className="h-12 w-12 shrink-0 rounded-lg" artClassName="h-12 w-12" />
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold">{l.name}</span>
                      <span className="text-[13px] text-muted">{l.spec}</span>
                    </span>
                    <span className="text-[15px] font-bold">{formatNaira(l.price)}</span>
                  </Link>
                </li>
              ))}
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

function Drawer({ onClose }: { onClose: () => void }) {
  const [sub, setSub] = useState<string | null>(null);
  const cat = categories.find((c) => c.slug === sub);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
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
          <button aria-label="Close menu" onClick={onClose} className="p-2">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cat ? (
            <ul>
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
                {[...utilityNav, { href: "/vendors", label: "Sell on JDHub" }, { href: "/account", label: "Account" }].map((n) => (
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
