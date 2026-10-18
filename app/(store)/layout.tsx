import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CompareTray } from "@/components/compare/CompareTray";
import { FlyToCart } from "@/components/cart/FlyToCart";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getStorefront, navCategories, slim } from "@/components/home/storefront";
import { ScrollProgress } from "@/components/motion/PageTransition";
import { AnalyticsIdentity } from "@/components/AnalyticsIdentity";
import { ActiveOfferBanner } from "@/components/offers/ActiveOfferBanner";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { WishlistSync } from "@/components/wishlist/WishlistSync";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { Suspense } from "react";

// Storefront chrome: header, footer, cart. The admin (/admin) has its own layout.
// Catalog and settings are cached reads (lib/data.ts), refreshed when the admin
// edits products or settings and when purchases move stock.
export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const { products, settings } = await getStorefront();

  return (
    <CartProvider>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollProgress />
      <Header
        categories={navCategories(products)}
        searchIndex={products.map(slim)}
        promo={{ text: settings.promoText, link: settings.promoLink, enabled: settings.promoEnabled }}
      />
      <ActiveOfferBanner />
      <Suspense>
        <Identity />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer contact={{ whatsapp: settings.whatsapp, phone: settings.phone, email: settings.email, storeName: settings.storeName }} />
      <WhatsAppFab whatsapp={settings.whatsapp} storeName={settings.storeName} />
      <Suspense fallback={null}>
        <CompareTray />
      </Suspense>
      <CartDrawer />
      <FlyToCart />
    </CartProvider>
  );
}

/** Links analytics to the signed-in customer (request-time, so it streams in). */
async function Identity() {
  const customer = await getCurrentCustomer();
  return (
    <>
      <AnalyticsIdentity customerId={customer?.id ?? null} />
      <WishlistSync customerId={customer?.id ?? null} contact={customer ? (customer.email ?? customer.contactEmail ?? customer.phone ?? customer.contactPhone) : undefined} />
    </>
  );
}
