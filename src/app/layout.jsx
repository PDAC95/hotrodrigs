import BootstrapInit from "@/helper/BootstrapInit";
import RouteScrollToTop from "@/helper/RouteScrollToTop";
import "./font.css";
import "./globals.scss";
import PhosphorIconInit from "@/helper/PhosphorIconInit";
import CartProvider from "@/components/cart/CartProvider";
import MiniCartDrawer from "@/components/cart/MiniCartDrawer";

export const metadata = {
  title: "Digital Market Place NEXT Js Template",
  description:
    "DpMarket – Digital Products Marketplace NEXT JS Template – A versatile and meticulously designed set of templates crafted to elevate your Digital Products Marketplace content and experiences.",
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
