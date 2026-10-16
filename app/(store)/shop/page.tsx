import type { Metadata } from "next";
import { Suspense } from "react";
import { featuredIn, getStorefront } from "@/components/home/storefront";
import { PageTransition } from "@/components/motion/PageTransition";
import { PageHero, PhotoCollage } from "@/components/PageHero";
import { ShopGrid, ShopGridFromParams } from "@/components/ShopGrid";
import { categories } from "@/lib/reference";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Graded phones, accessories, gadgets and cars from verified Nigerian sellers. Every order escrow-protected.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const { products } = await getStorefront();
  const navCats = categories.map((c) => ({ slug: c.slug, name: c.name }));
  // One headline product per category for the header collage.
  const collage = [featuredIn(products, "accessories", 1), featuredIn(products, "phones", 2), featuredIn(products, "gadgets", 1), featuredIn(products, "cars", 1)]
    .flat()
    .slice(0, 5);

  return (
    <PageTransition>
      <PageHero
        trail={[["Home", "/"], ["Shop"]]}
        title="Shop all"
        body="Phones, accessories, gadgets and cars. Every listing graded, every order escrow-protected."
      >
        <PhotoCollage items={collage} />
      </PageHero>
      <div className="wrap">
        <Suspense fallback={<ShopGrid items={products} categories={navCats} />}>
          <ShopGridFromParams items={products} categories={navCats} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
