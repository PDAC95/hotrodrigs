import BannerTwo from "@/components/BannerTwo";
import BigDealOne from "@/components/BigDealOne";
import BottomFooter from "@/components/BottomFooter";
import DaySaleOne from "@/components/DaySaleOne";
import DealsOne from "@/components/DealsOne";
import DiscountOne from "@/components/DiscountOne";
import FeaturedOne from "@/components/FeaturedOne";
import FooterTwo from "@/components/FooterTwo";
import HeaderTwo from "@/components/HeaderTwo";
import NewsletterTwo from "@/components/NewsletterTwo";
import PopularProductsOne from "@/components/PopularProductsOne";
import PromotionalTwo from "@/components/PromotionalTwo";
import RecentlyViewedOne from "@/components/RecentlyViewedOne";
import ShippingTwo from "@/components/ShippingTwo";
import TopSellingOne from "@/components/TopSellingOne";
import TopSellingTwo from "@/components/TopSellingTwo";
import TopVendorsTwo from "@/components/TopVendorsTwo";
import TrendingOne from "@/components/TrendingOne";
import ColorInit from "@/helper/ColorInit";
import Preloader from "@/helper/Preloader";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import { getCategoryTree } from "@/lib/catalog/categories";

export const metadata = {
  title: "Hot Rod Rigs — Truck Parts & Accessories",
  description:
    "Shop aftermarket truck parts and accessories — bumpers, mirrors, lighting, grilles and more for all major truck makes. Find parts matched to your truck and check out fast.",
};

const page = async () => {
  const categoryTree = await getCategoryTree();
  return (
    <>
      {/* ColorInit */}
      <ColorInit color={true} />

      {/* ScrollToTop */}
      <ScrollToTopInit color='#FA6400' />

      {/* Preloader */}
      <Preloader />

      {/* HeaderTwo */}
      <HeaderTwo category={false} categoryTree={categoryTree} />

      {/* BannerTwo */}
      <BannerTwo categoryTree={categoryTree} />

      {/* PromotionalTwo */}
      <PromotionalTwo />

      {/* DealsOne */}
      <DealsOne />

      {/* TopSellingOne */}
      <TopSellingOne />

      {/* TrendingOne */}
      <TrendingOne />

      {/* DiscountOne */}
      <DiscountOne />

      {/* FeaturedOne */}
      <FeaturedOne />

      {/* BigDealOne */}
      <BigDealOne />

      {/* TopSellingTwo */}
      <TopSellingTwo />

      {/* PopularProductsOne */}
      <PopularProductsOne />

      {/* TopVendorsTwo */}
      <TopVendorsTwo />

      {/* DaySaleOne */}
      <DaySaleOne />

      {/* RecentlyViewedOne */}
      <RecentlyViewedOne />

      {/* ShippingTwo */}
      <ShippingTwo />

      {/* NewsletterTwo */}
      <NewsletterTwo />

      {/* FooterTwo */}
      <FooterTwo />

      {/* BottomFooter */}
      <BottomFooter />
    </>
  );
};

export default page;
