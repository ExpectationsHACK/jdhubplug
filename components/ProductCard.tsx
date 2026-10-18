import Link from "next/link";
import { ViewTransition, type CSSProperties } from "react";
import type { Product } from "@/lib/types";
import { OfferPrice } from "./offers/OfferPrice";
import { AddToCartButton } from "./cart/AddToCartButton";
import { formatNaira, gradeLabel } from "./home/format";
import { Tilt } from "./motion/Tilt";
import { ProductImage } from "./ProductImage";
import { Icon } from "./Icon";
import { RatingInline } from "./reviews/Stars";
import { badgeOf, sellerOf } from "@/lib/seller";
import { CompareToggle } from "./compare/CompareToggle";
import { WishlistButton } from "./wishlist/WishlistButton";

export function GradePill({ grade }: { grade: Product["grade"] }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[12px] font-bold text-ink-2">
      {gradeLabel(grade)}
    </span>
  );
}

/** Shared-element name: the card photo morphs into the product page hero. */
export const productTransitionName = (id: string) => `product-${id}`;

/**
 * Product tile. Tilts toward the pointer with a moving glare (desktop), reveals on
 * scroll (`index` staggers a row), and its photo morphs into the product page.
 * `data-product-card` + <AddToCartButton> inside power the fly-to-cart animation.
 */
export function ProductCard({ item, index = 0 }: { item: Product; index?: number }) {
  const soldOut = item.stock <= 0;
  const badge = badgeOf(item);
  const seller = sellerOf(item);
  return (
    <div className="reveal h-full" style={{ "--i": index % 4 } as CSSProperties}>
      <Tilt
        data-product-card
        className="product-card group flex h-full flex-col rounded-tile bg-stage p-3 sm:p-5"
      >
        <div className="relative z-[1] flex min-h-6 items-start justify-between">
          {soldOut ? (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Sold out</span>
          ) : badge ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                badge === "Hot deal" ? "bg-sale text-white" : "bg-white text-ink"
              }`}
            >
              {badge}
            </span>
          ) : (
            <span />
          )}
          <WishlistButton product={item} className="p-1" />
        </div>
        <Link
          href={`/product/${item.id}`}
          tabIndex={-1}
          aria-hidden
          className="product-card-media relative my-2 block overflow-hidden rounded-xl bg-white sm:my-3"
        >
          <ViewTransition name={productTransitionName(item.id)} share="morph" default="none">
            <ProductImage
              item={item}
              width={500}
              className={`aspect-square w-full transition-[transform,filter] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.07] ${
                soldOut ? "opacity-60 grayscale" : ""
              }`}
              artClassName="h-3/4 w-3/4"
            />
          </ViewTransition>
          {soldOut && (
            <span className="absolute inset-0 grid place-items-center bg-white/30">
              <span className="rounded-full bg-ink/85 px-4 py-2 text-[13px] font-bold tracking-wide text-white">Sold out</span>
            </span>
          )}
        </Link>
        <div className="relative z-[1] mt-auto text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <GradePill grade={item.grade} />
            {seller.verified && (
              <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-accent">
                <Icon name="verified" size={15} /> Verified
              </span>
            )}
          </div>
          <Link href={`/product/${item.id}`} className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <h3 className="text-[14px] font-bold leading-snug sm:text-[16px]">{item.name}</h3>
            <p className="mt-1 line-clamp-1 text-[12px] text-muted sm:text-[13px]">{item.spec}</p>
          </Link>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[11px] text-muted sm:text-[12px]">
            {item.ratingSummary && (
              <>
                <RatingInline summary={item.ratingSummary} size={12} /> ·
              </>
            )}{" "}
            {item.state}
          </p>
          <p className="mt-2 text-[16px] font-bold sm:mt-3 sm:text-[18px]">
            {formatNaira(item.price)}
            {item.was && item.was > item.price && (
              <span className="ml-2 inline-block text-[12px] font-normal text-muted line-through sm:text-[13px]">{formatNaira(item.was)}</span>
            )}
          </p>
          <OfferPrice product={item} className="text-[13px]" />
          <AddToCartButton product={item} className="btn btn-primary mt-3 w-full px-3 sm:mt-4" />
          <CompareToggle product={item} className="mt-2.5" />
        </div>
      </Tilt>
    </div>
  );
}
