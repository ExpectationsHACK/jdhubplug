"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CategorySlug, Product } from "@/lib/types";
import { Icon } from "./Icon";
import { ProductCard } from "./ProductCard";

export type ShowcaseTab = { slug: CategorySlug; name: string; blurb: string; items: Product[] };

/** Home "Shop" module: text tabs per category, a row of graded product cards. */
export function ShowcaseTabs({ tabs }: { tabs: ShowcaseTab[] }) {
  const [tab, setTab] = useState(tabs[0]?.slug);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cat = tabs.find((c) => c.slug === tab) ?? tabs[0];
  if (!cat) return null;

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tabs.length) % tabs.length;
    setTab(tabs[n].slug);
    tabRefs.current[n]?.focus();
  };

  return (
    <section className="wrap pt-20" aria-labelledby="showcase-title">
      <h2 id="showcase-title" className="display text-center text-[28px] md:text-[40px]">
        Shop
      </h2>
      <div role="tablist" aria-label="Categories" className="no-scrollbar mt-6 flex justify-start gap-8 overflow-x-auto md:justify-center">
        {tabs.map((c, i) => (
          <button
            key={c.slug}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`showcase-tab-${c.slug}`}
            role="tab"
            aria-selected={tab === c.slug}
            aria-controls="showcase-panel"
            tabIndex={tab === c.slug ? 0 : -1}
            onClick={() => setTab(c.slug)}
            onKeyDown={(e) => onKey(e, i)}
            className="tab"
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="mt-6 text-center text-[16px] text-ink-2">{cat.blurb}</p>
      <div
        role="tabpanel"
        id="showcase-panel"
        aria-labelledby={`showcase-tab-${cat.slug}`}
        key={cat.slug}
        className="fade-in no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
      >
        {/* Phones: a swipeable row. Larger screens: a grid. */}
        {cat.items.map((l, i) => (
          <div key={l.id} className="w-[78%] shrink-0 snap-center sm:w-auto">
            <ProductCard item={l} index={i} />
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href={`/shop/${cat.slug}`} className="link-cta">
          Shop all {cat.name.toLowerCase()} <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </section>
  );
}
