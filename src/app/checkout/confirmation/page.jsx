import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import Confirmation from "@/components/checkout/Confirmation";
import FooterTwo from "@/components/FooterTwo";
import HeaderTwo from "@/components/HeaderTwo";
import ColorInit from "@/helper/ColorInit";
import Preloader from "@/helper/Preloader";
import ScrollToTopInit from "@/helper/ScrollToTopInit";

export const metadata = {
  title: "Order Confirmation",
  description:
    "Your order confirmation and receipt. Thank you for shopping with Hot Rod Rigs.",
};

/**
 * /checkout/confirmation — thin Server Component shell mirroring /checkout.
 *
 * It composes the standard HeaderTwo / Breadcrumb / Footer chrome around the
 * Confirmation client island. The island reads the PaymentIntent id from the URL
 * itself, so this route needs no searchParams handling — keeping it static
 * (per the interface note; avoids a useSearchParams Suspense boundary).
 */
const page = () => {
  return (
    <>
      {/* ColorInit */}
      <ColorInit color={true} />

      {/* ScrollToTop */}
      <ScrollToTopInit color='#FA6400' />

      {/* Preloader */}
      <Preloader />

      {/* HeaderTwo */}
      <HeaderTwo category={true} />

      {/* Breadcrumb */}
      <Breadcrumb title={"Order Confirmation"} />

      {/* Confirmation */}
      <Confirmation />

      {/* FooterTwo */}
      <FooterTwo />

      {/* BottomFooter */}
      <BottomFooter />
    </>
  );
};

export default page;
