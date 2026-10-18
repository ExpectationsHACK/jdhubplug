import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareTable } from "@/components/compare/CompareTable";
import { COMPARE_MAX } from "@/components/compare/limits";
import { Breadcrumbs } from "@/components/PageHero";
import { getCatalogProduct } from "@/lib/data";
import { cleanIds } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Compare",
  description: "Compare graded products side by side: price, grade, specs and stock.",
  robots: { index: false, follow: true },
};

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <div className="wrap pb-24 pt-6">
      <Breadcrumbs trail={[["Home", "/"], ["Compare"]]} />
      <h1 className="display mt-6 text-[32px] md:text-[44px]">Compare</h1>
      <Suspense fallback={<div className="mt-8 h-[480px] animate-pulse rounded-tile bg-stage" aria-busy="true" />}>
        <CompareBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CompareBody({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const raw = (await searchParams).ids;
  const ids = cleanIds(String(Array.isArray(raw) ? raw[0] : (raw ?? "")).split(","), COMPARE_MAX);
  const products = (await Promise.all(ids.map((id) => getCatalogProduct(id)))).filter((p) => !!p);

  if (products.length < 2) {
    return (
      <div className="mt-8 rounded-tile bg-stage px-6 py-16 text-center">
        <p className="text-[18px] font-bold">{products.length ? "Add one more product to compare" : "Nothing to compare yet"}</p>
        <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-2">
          Tick &ldquo;Compare&rdquo; on up to {COMPARE_MAX} products from the same category, then choose Compare now.
        </p>
        <Link href={products[0] ? `/shop/${products[0].category}` : "/shop"} className="btn btn-primary mt-6">
          Browse products
        </Link>
      </div>
    );
  }
  return <CompareTable products={products} />;
}
