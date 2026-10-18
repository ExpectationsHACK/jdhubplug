import type { Metadata } from "next";
import { TrackProductView } from "@/components/TrackProductView";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { BuyBox } from "@/components/BuyBox";
import { absoluteUrl } from "@/components/home/site";
import { visible } from "@/components/home/storefront";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumbs } from "@/components/PageHero";
import { ProductCard, productTransitionName } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { getCategory, gradeName } from "@/lib/reference";
import { getCatalog, getCatalogProduct, getModelReviews, getStoreSettings } from "@/lib/data";
import { sellerOf } from "@/lib/seller";
import { photoPage, productImageSrc } from "@/lib/photos";


export async function generateStaticParams() {
  const all = await getCatalog();
  // Cache Components needs at least one param; unknown ids render on demand.
  return all.length ? all.map((p) => ({ id: p.id })) : [{ id: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/product/[id]">): Promise<Metadata> {
  const item = await getCatalogProduct((await params).id);
  if (!item) return { title: "Product not found" };
  const image = productImageSrc(item, 1280);
  const description = `${item.name}, ${item.spec}. Graded ${gradeName(item.grade)}, ${sellerOf(item).verified ? "verified seller, " : ""}escrow-protected. Ships from ${item.state}.`;
  return {
    title: `${item.name} (${item.spec})`,
    description,
    alternates: { canonical: `/product/${item.id}` },
    openGraph: {
      type: "website",
      title: item.name,
      description,
      url: `/product/${item.id}`,
      ...(image ? { images: [{ url: image, alt: item.name }] } : {}),
    },
    twitter: { card: "summary_large_image", title: item.name, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[id]">) {
  const [item, all, settings] = await Promise.all([getCatalogProduct((await params).id), getCatalog(), getStoreSettings()]);
  if (!item) notFound();
  const cat = getCategory(item.category)!;
  const seller = sellerOf(item);
  // Real published reviews only; with none, no rating appears anywhere (including JSON-LD).
  const reviews = await getModelReviews(item.model);
  const rated = reviews.summary && reviews.reviews.length ? reviews.summary : undefined;
  const shown = visible(all, settings);
  const sameModel = shown.filter((l) => l.model === item.model && l.id !== item.id).slice(0, 8);
  const related = shown
    .filter((l) => l.category === item.category && l.model !== item.model)
    .filter((l, i, list) => list.findIndex((x) => x.model === l.model) === i)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || Math.abs(a.price - item.price) - Math.abs(b.price - item.price))
    .slice(0, 4);

  const image = productImageSrc(item, 1280);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: item.spec,
    sku: item.id,
    ...(image ? { image: [image] } : {}),
    brand: { "@type": "Brand", name: item.brand },
    category: cat.name,
    itemCondition: "https://schema.org/UsedCondition",
    ...(rated
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: rated.average, reviewCount: rated.count, bestRating: 5, worstRating: 1 },
          review: reviews.reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            datePublished: r.createdAt.slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.title ? { name: r.title } : {}),
            reviewBody: r.body,
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${item.id}`),
      priceCurrency: "NGN",
      price: item.price,
      availability: item.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: { "@type": "Organization", name: seller.name },
    },
  };

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="wrap pt-6">
        <Breadcrumbs trail={[["Home", "/"], [cat.name, `/shop/${cat.slug}`], [item.name]]} />
      </div>

      <section className="wrap grid gap-10 pt-8 md:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative overflow-hidden rounded-tile bg-stage">
            <ViewTransition name={productTransitionName(item.id)} share="morph" default="none">
              <ProductImage
                item={item}
                width={1280}
                priority
                className={`aspect-square w-full ${item.stock <= 0 ? "opacity-70 grayscale" : ""}`}
                artClassName="h-4/5 w-4/5"
              />
            </ViewTransition>
            {item.stock <= 0 && (
              <span className="absolute left-5 top-5 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">Sold out</span>
            )}
          </div>
          {item.photo && !item.imageUrl && (
            <p className="mt-3 text-[12px] text-muted">
              Representative photo of this model.{" "}
              <a href={photoPage(item.photo)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                Photo credit & licence (Wikimedia Commons)
              </a>
              . Seller photos of this exact unit are shared on request before you pay.
            </p>
          )}
        </div>
        <BuyBox item={item} whatsapp={settings.whatsapp} />
        <TrackProductView product={item} />
      </section>

      <section className="wrap pt-20" aria-labelledby="specs-title">
        <h2 id="specs-title" className="display text-[24px] md:text-[32px]">
          Specs & checks
        </h2>
        <dl className="mt-6 grid border-t border-line sm:grid-cols-2">
          {Object.entries({ Brand: item.brand, Grade: gradeName(item.grade), Location: item.state, Seller: seller.name, ...item.attrs })
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-4 text-[15px] sm:pr-8 sm:odd:border-r sm:even:pl-8">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-bold">{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="wrap pt-16" aria-label="Buyer protection">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: "shield" as const, t: "Escrow by default", b: "Funds release only after you confirm the item matches its grade." },
            { icon: "swap" as const, t: "7-day returns", b: "Not as described? Open a dispute and JDHub mediates a refund." },
            {
              icon: "pin" as const,
              t: "Inspect at a hub",
              b: `${settings.hubs.map((h) => h.city).join(", ").replace(/, ([^,]*)$/, " and $1")} hubs for pickup and in-person checks.`,
            },
          ].map((x, i) => (
            <Reveal key={x.t} index={i} className="rounded-tile bg-stage p-6">
              <Icon name={x.icon} size={32} strokeWidth={1.25} />
              <h3 className="mt-4 text-[17px] font-bold">{x.t}</h3>
              <p className="mt-1 text-[14px] text-ink-2">{x.b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <ProductReviews reviews={reviews.reviews} dist={reviews.dist} summary={rated} modelName={item.name} />

      {sameModel.length > 0 && (
        <section className="wrap pt-20" aria-labelledby="units-title">
          <h2 id="units-title" className="display text-[24px] md:text-[32px]">
            More {item.name} units
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">Same model, different grade, storage or colour.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {sameModel.map((l, i) => (
              <ProductCard key={l.id} item={l} index={i} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="wrap pt-20" aria-labelledby="related-title">
          <div className="flex items-end justify-between gap-4">
            <h2 id="related-title" className="display text-[24px] md:text-[32px]">
              You may also like
            </h2>
            <Link href={`/shop/${cat.slug}`} className="link-cta shrink-0">
              View all <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((l, i) => (
              <ProductCard key={l.id} item={l} index={i} />
            ))}
          </div>
        </section>
      )}
    </PageTransition>
  );
}
