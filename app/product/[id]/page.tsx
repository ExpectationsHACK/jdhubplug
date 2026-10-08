import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/BuyBox";
import { DeviceArt } from "@/components/DeviceArt";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/PageHero";
import { ProductCard } from "@/components/ProductCard";
import { getCategory, getListing, listings } from "@/lib/catalog";

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/product/[id]">): Promise<Metadata> {
  const item = getListing((await params).id);
  return { title: item ? `${item.name} (${item.spec})` : "Product" };
}

export default async function ProductPage({ params }: PageProps<"/product/[id]">) {
  const item = getListing((await params).id);
  if (!item) notFound();
  const cat = getCategory(item.category)!;
  const related = listings.filter((l) => l.category === item.category && l.id !== item.id).slice(0, 4);

  return (
    <>
      <div className="wrap pt-6">
        <Breadcrumbs trail={[["Home", "/"], [cat.name, `/shop/${cat.slug}`], [item.name]]} />
      </div>

      <section className="wrap grid gap-10 pt-8 md:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="grid aspect-square place-items-center rounded-tile bg-stage">
            <DeviceArt kind={item.art} tint={item.tint} className="h-4/5 w-4/5" />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {["Front", "Back", "Side", "Box"].map((v, k) => (
              <div
                key={v}
                className={`grid aspect-square place-items-center rounded-xl bg-stage ${k === 0 ? "ring-2 ring-accent" : ""}`}
                aria-label={`${v} view`}
              >
                <DeviceArt kind={item.art} tint={item.tint} className="h-3/4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
        <BuyBox item={item} />
      </section>

      <section className="wrap pt-20">
        <h2 className="display text-[24px] md:text-[32px]">Specs & checks</h2>
        <dl className="mt-6 grid border-t border-line sm:grid-cols-2">
          {Object.entries({ Brand: item.brand, Location: item.state, ...item.attrs }).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line py-4 text-[15px] sm:pr-8 sm:odd:border-r sm:even:pl-8">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: "shield" as const, t: "Escrow by default", b: "Funds release only after you confirm the item matches its grade." },
            { icon: "swap" as const, t: "7-day returns", b: "Not as described? Open a dispute and JDHub mediates a refund." },
            { icon: "pin" as const, t: "Inspect at a hub", b: "Lagos, Abuja and Port Harcourt hubs for pickup and in-person checks." },
          ].map((x) => (
            <div key={x.t} className="rounded-tile bg-stage p-6">
              <Icon name={x.icon} size={32} strokeWidth={1.25} />
              <h3 className="mt-4 text-[17px] font-bold">{x.t}</h3>
              <p className="mt-1 text-[14px] text-ink-2">{x.b}</p>
            </div>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="wrap pt-20">
          <div className="flex items-end justify-between">
            <h2 className="display text-[24px] md:text-[32px]">You may also like</h2>
            <Link href={`/shop/${cat.slug}`} className="link-cta">
              View all <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((l) => (
              <ProductCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
