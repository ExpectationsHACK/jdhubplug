import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/PageHero";
import { WishlistView } from "@/components/wishlist/WishlistView";

export const metadata: Metadata = {
  title: "Your wishlist",
  description: "Products you saved on JDHub, with live prices and stock.",
  robots: { index: false },
};

export default function WishlistPage() {
  return (
    <div className="wrap pb-24 pt-6">
      <Breadcrumbs trail={[["Home", "/"], ["Wishlist"]]} />
      <h1 className="display mt-6 text-[32px] md:text-[44px]">Your wishlist</h1>
      <p className="mt-2 text-[15px] text-ink-2">Saved items with live prices and stock. Graded units are one-offs, so don&apos;t wait too long.</p>
      <WishlistView />
    </div>
  );
}
