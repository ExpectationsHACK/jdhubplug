import Link from "next/link";
import type { CSSProperties } from "react";
import { Logo } from "../Logo";
import { ProductImage } from "../ProductImage";
import { getStorefront, heroProducts } from "./storefront";
import { shortNaira } from "./format";

/** 404 body shared by the root and storefront not-found pages, with real products to jump to. */
export async function NotFoundContent({ withLogo = false }: { withLogo?: boolean }) {
  const { products, settings } = await getStorefront();
  const picks = heroProducts(products, { heroProductIds: settings.heroProductIds }, 4);

  return (
    <section className={`wrap grid place-items-center py-20 text-center ${withLogo ? "min-h-screen" : "min-h-[60vh]"}`}>
      <div className="w-full">
        {withLogo && <Logo />}
        <p className={`${withLogo ? "mt-10" : ""} text-[14px] font-bold text-accent`}>404</p>
        <h1 className="display mt-2 text-[32px] md:text-[44px]">This page has been traded in.</h1>
        <p className="mt-3 text-ink-2">The page you&apos;re looking for isn&apos;t here any more. These are, though.</p>
        {picks.length > 0 && (
          <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {picks.map((p, i) => (
              <li key={p.id} className="mega-card" style={{ animationDelay: `${120 + i * 70}ms` } as CSSProperties}>
                <Link href={`/product/${p.id}`} className="group block rounded-tile bg-stage p-3 text-left">
                  <span className="block overflow-hidden rounded-xl bg-white">
                    <ProductImage item={p} width={330} className="aspect-square w-full transition-transform duration-500 group-hover:scale-105" artClassName="h-3/4 w-3/4" />
                  </span>
                  <span className="mt-2 block truncate text-[13px] font-bold">{p.name}</span>
                  <span className="block text-[12px] text-muted">{shortNaira(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn btn-outline">
            Shop all
          </Link>
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
