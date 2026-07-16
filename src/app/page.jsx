import BannerTwo from "@/components/BannerTwo";
import BigDealOne from "@/components/BigDealOne";
import BottomFooter from "@/components/BottomFooter";
import DaySaleOne from "@/components/DaySaleOne";
import DealOfTheWeek from "@/components/DealOfTheWeek";
import DiscountOne from "@/components/DiscountOne";
import FeaturedOne from "@/components/FeaturedOne";
import FooterTwo from "@/components/FooterTwo";
import HeaderTwo from "@/components/HeaderTwo";
import NewsletterTwo from "@/components/NewsletterTwo";
import { Suspense } from "react";
import PopularProductsOne from "@/components/PopularProductsOne";
import TruckPickerCards from "@/components/fitment/TruckPickerCards";
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
import { getCurrentDeal } from "@/lib/catalog/deals";

// No page-level metadata: the home page inherits the site-wide default from
// layout.jsx ("Hot Rod Rigs — Truck Parts & Accessories") so it never
// double-brands under the "%s | Hot Rod Rigs" title template.

const page = async () => {
  const [categoryTree, deal] = await Promise.all([
    getCategoryTree(),
    getCurrentDeal(),
  ]);
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

      {/* BannerTwo — truck-aware hero (personalized slides when a truck is set) */}
      <Suspense fallback={null}>
        <BannerTwo categoryTree={categoryTree} />
      </Suspense>

      {/* Shop by My Truck — Make/Model/Year picker cards */}
      <Suspense fallback={null}>
        <TruckPickerCards />
      </Suspense>

      {/* Deal of the Week — real product + real countdown; hides itself when
          no deal is scheduled (redesigned from DealsOne's demo banner) */}
      <DealOfTheWeek deal={deal} />

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

      {/* ShippingTwo — trust strip, true claims only */}
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
