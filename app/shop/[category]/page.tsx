import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeviceArt } from "@/components/DeviceArt";
import { PageHero } from "@/components/PageHero";
import { ShopGrid, ShopGridFromParams } from "@/components/ShopGrid";
import { categories, getCategory, listingsIn } from "@/lib/catalog";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const cat = getCategory((await params).category);
  return { title: cat ? `${cat.name}: ${cat.tagline}` : "Shop" };
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const cat = getCategory((await params).category);
  if (!cat) notFound();
  const items = listingsIn(cat.slug);

  return (
    <>
      <PageHero trail={[["Home", "/"], ["Shop", "/shop"], [cat.name]]} eyebrow={cat.name} title={cat.tagline} body={cat.blurb}>
        <DeviceArt kind={cat.art} className="mx-auto mt-6 h-40 w-40" />
      </PageHero>
      <div className="wrap">
        <Suspense fallback={<ShopGrid items={items} />}>
          <ShopGridFromParams items={items} />
        </Suspense>
      </div>
    </>
  );
}
