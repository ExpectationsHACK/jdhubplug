import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/PageHero";
import { ShopGrid, ShopGridFromParams } from "@/components/ShopGrid";
import { listings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop all" };

export default function ShopPage() {
  return (
    <>
      <PageHero
        trail={[["Home", "/"], ["Shop"]]}
        title="Shop all"
        body="Phones, accessories, gadgets and cars. Every listing graded, every order escrow-protected."
      />
      <div className="wrap">
        <Suspense fallback={<ShopGrid items={listings} showCategory />}>
          <ShopGridFromParams items={listings} showCategory />
        </Suspense>
      </div>
    </>
  );
}
