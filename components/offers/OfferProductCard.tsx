import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ProductImage } from "@/components/ProductImage";
import type { Product } from "@/lib/types";
import { formatNaira } from "./format";

/**
 * Product tile for an offer landing page: normal price struck through, offer price in
 * sale red. `comingSoon` swaps the cart button for a note while the offer is scheduled.
 */
export function OfferProductCard({
  product: p,
  offerPrice,
  comingSoon = false,
  index = 0,
}: {
  product: Product;
  offerPrice: number;
  comingSoon?: boolean;
  index?: number;
}) {
  const saving = p.price - offerPrice;
  const soldOut = p.stock <= 0;
  const href = `/product/${encodeURIComponent(p.id)}`;

  return (
    <div
      data-product-card
      className="jdo-rise group flex h-full flex-col rounded-tile bg-stage p-4 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.1)] motion-reduce:hover:translate-y-0 sm:p-5"
      style={{ animationDelay: `${Math.min(index, 11) * 60}ms` }}
    >
      <div className="flex min-h-6 items-start justify-between gap-2">
        {saving > 0 && !soldOut ? (
          <span className="rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold text-white">Save {formatNaira(saving)}</span>
        ) : (
          <span />
        )}
        {soldOut ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-muted">Sold out</span>
        ) : p.stock <= 2 ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink">Only {p.stock} left</span>
        ) : null}
      </div>
      <Link href={href} className="my-3 block overflow-hidden rounded-xl bg-white" tabIndex={-1} aria-hidden>
        <ProductImage
          item={p}
          width={500}
          className={`aspect-square w-full transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:group-hover:scale-100 ${soldOut ? "opacity-50 grayscale" : ""}`}
          artClassName="h-40 w-40"
        />
      </Link>
      <div className="mt-auto text-center">
        <Link href={href} className="block hover:underline">
          <h3 className="text-[15px] font-bold leading-snug sm:text-[16px]">{p.name}</h3>
        </Link>
        <p className="mt-1 line-clamp-1 text-[13px] text-muted">{p.spec}</p>
        <p className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2">
          <span className={`display text-[19px] ${saving > 0 ? "text-sale" : ""}`}>{formatNaira(offerPrice)}</span>
          {saving > 0 && (
            <s className="text-[13px] text-muted">
              <span className="sr-only">Was </span>
              {formatNaira(p.price)}
            </s>
          )}
        </p>
        {comingSoon ? (
          <p className="mt-4 rounded-full border border-dashed border-line bg-white py-2.5 text-[13px] font-bold text-ink-2">Coming soon</p>
        ) : (
          <AddToCartButton
            // Only the fields the cart keeps, so the client payload stays small.
            product={{
              id: p.id,
              name: p.name,
              spec: p.spec,
              price: p.price,
              photo: p.photo,
              imageUrl: p.imageUrl,
              stock: p.stock,
              category: p.category,
              brand: p.brand,
              art: p.art,
              tint: p.tint,
            }}
            className="btn btn-primary mt-4 w-full"
          />
        )}
      </div>
    </div>
  );
}
