import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { FlyToCart } from "@/components/cart/FlyToCart";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WhatsAppFab } from "@/components/WhatsAppFab";

// Storefront chrome: header, footer, cart. The admin (/admin) has its own layout.
export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <CartProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFab />
      <CartDrawer />
      <FlyToCart />
    </CartProvider>
  );
}
