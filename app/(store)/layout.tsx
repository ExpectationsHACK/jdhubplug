import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { FlyToCart } from "@/components/cart/FlyToCart";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getStorefront, navCategories, slim } from "@/components/home/storefront";
import { ScrollProgress } from "@/components/motion/PageTransition";
import { WhatsAppFab } from "@/components/WhatsAppFab";

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
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer contact={{ whatsapp: settings.whatsapp, phone: settings.phone, email: settings.email, storeName: settings.storeName }} />
      <WhatsAppFab whatsapp={settings.whatsapp} storeName={settings.storeName} />
      <CartDrawer />
      <FlyToCart />
    </CartProvider>
  );
}
