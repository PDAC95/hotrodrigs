import BootstrapInit from "@/helper/BootstrapInit";
import RouteScrollToTop from "@/helper/RouteScrollToTop";
import "./font.css";
import "./globals.scss";
import PhosphorIconInit from "@/helper/PhosphorIconInit";
import CartProvider from "@/components/cart/CartProvider";
import MiniCartDrawer from "@/components/cart/MiniCartDrawer";

export const metadata = {
  title: {
    default: "Hot Rod Rigs — Truck Parts & Accessories",
    template: "%s | Hot Rod Rigs",
  },
  description:
    "Shop aftermarket truck parts and accessories — bumpers, mirrors, lighting, grilles and more for all major truck makes. Find the right part for your rig and check out fast.",
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body suppressHydrationWarning={true}>
        <BootstrapInit />
        <PhosphorIconInit />
        <RouteScrollToTop />
        {/* CartProvider wraps the app so HeaderTwo (badge), the PDP add button,
            and the /cart page share count/lines/drawer state. The mini-cart
            drawer is mounted once, globally. */}
        <CartProvider>
          {children}
          <MiniCartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
