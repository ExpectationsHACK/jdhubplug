import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { featuredIn, getStorefront } from "@/components/home/storefront";
import { PageTransition } from "@/components/motion/PageTransition";
import { PageHero, PhotoCollage } from "@/components/PageHero";
import { ShopGrid, ShopGridFromParams } from "@/components/ShopGrid";
import { productImageSrc } from "@/lib/photos";
import { categories, getCategory } from "@/lib/reference";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return { title: "Shop" };
  const { products } = await getStorefront();
  const lead = featuredIn(products, cat.slug, 1)[0];
  const image = lead && productImageSrc(lead, 1280);
  return {
    title: `${cat.name}: ${cat.tagline}`,
    description: cat.blurb,
    alternates: { canonical: `/shop/${cat.slug}` },
    openGraph: { title: `${cat.name} on JDHub`, description: cat.blurb, ...(image ? { images: [{ url: image, alt: lead.name }] } : {}) },
  };
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const cat = getCategory((await params).category);
  if (!cat) notFound();
  const { products } = await getStorefront();
  const items = products.filter((p) => p.category === cat.slug);

  return (
    <PageTransition>
      <PageHero trail={[["Home", "/"], ["Shop", "/shop"], [cat.name]]} eyebrow={cat.name} title={cat.tagline} body={cat.blurb}>
        <PhotoCollage items={featuredIn(products, cat.slug, 5)} />
      </PageHero>
      <div className="wrap">
        <Suspense fallback={<ShopGrid items={items} />}>
          <ShopGridFromParams items={items} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
