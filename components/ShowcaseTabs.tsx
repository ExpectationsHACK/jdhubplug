"use client";

import Link from "next/link";
import { useState } from "react";
import { categories, featuredIn } from "@/lib/catalog";
import { Icon } from "./Icon";
import { ProductCard } from "./ProductCard";

/** Home "Shop" module: text tabs per category, a row of graded product cards. */
export function ShowcaseTabs() {
  const [tab, setTab] = useState(categories[0].slug);
  const items = featuredIn(tab, 8);
  const cat = categories.find((c) => c.slug === tab)!;

  return (
    <section className="wrap pt-20">
      <h2 className="display text-center text-[28px] md:text-[40px]">Shop</h2>
      <div role="tablist" aria-label="Categories" className="no-scrollbar mt-6 flex justify-start gap-8 overflow-x-auto md:justify-center">
        {categories.map((c) => (
          <button key={c.slug} role="tab" aria-selected={tab === c.slug} onClick={() => setTab(c.slug)} className="tab">
            {c.name}
          </button>
        ))}
      </div>
      <p className="mt-6 text-center text-[16px] text-ink-2">{cat.blurb}</p>
      <div role="tabpanel" key={tab} className="fade-in mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((l) => (
          <ProductCard key={l.id} item={l} />
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href={`/shop/${tab}`} className="link-cta">
          Shop all {cat.name.toLowerCase()} <Icon name="chevronRight" size={16} />
        </Link>
      </div>
    </section>
  );
}
