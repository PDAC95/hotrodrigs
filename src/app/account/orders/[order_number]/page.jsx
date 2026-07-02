import { redirect } from "next/navigation";
import Link from "next/link";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import OrderDetail from "@/components/orders/OrderDetail";
import { createClient } from "@/lib/supabase/server";
import { getOrderByNumber } from "@/lib/orders/read";

// The route segment carries a percent-encoded order_number (its leading "#" is a URL
// fragment, so OrderList/Confirmation encode it). Decode defensively before use — a
// no-op when Next already decoded, but required when it hands back the raw "%23…".
function decodeOrderNumber(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }) {
  const { order_number } = await params;
  return { title: `Order ${decodeOrderNumber(order_number)} - Hot Rod Rigs` };
}

// Order-detail route (ACCT-06). async Server Component: getUser-gated, then an
// RLS-scoped fetch of ONE order by its readable order_number. Next 15 -> params is
// async. Signed-out access redirects to /account. When getOrderByNumber returns
// null (missing OR another customer's order, which RLS hides via maybeSingle) we
// render a friendly in-page "Order not found" message inside the same chrome —
// never notFound()/a leak that reveals whether the order exists (CONTEXT).
const OrderDetailPage = async ({ params }) => {
  const { order_number } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/account");

  const order = await getOrderByNumber(decodeOrderNumber(order_number));

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"Order details"} />

      <section className='account py-80'>
        <div className='container container-lg'>
          <div className='row justify-content-center'>
            <div className='col-xl-8 col-lg-10'>
              {order ? (
                <OrderDetail order={order} />
              ) : (
                <div className='border border-gray-100 rounded-16 px-24 py-80 text-center'>
                  <span className='text-gray-400 text-40 mb-16 d-inline-block'>
                    <i className='ph ph-magnifying-glass' />
                  </span>
                  <h6 className='text-xl mb-8 text-gray-900'>Order not found</h6>
                  <p className='text-gray-500 mb-32'>
                    We couldn&apos;t find that order on your account.
                  </p>
                  <Link
                    href='/account/orders'
                    className='btn btn-main py-18 px-40 rounded-8'
                  >
                    Back to orders
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default OrderDetailPage;
