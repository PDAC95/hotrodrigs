import { redirect } from "next/navigation";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import OrderList from "@/components/orders/OrderList";
import { createClient } from "@/lib/supabase/server";
import { getOrdersForUser } from "@/lib/orders/read";

export const metadata = {
  title: "My Orders - Hot Rod Rigs",
};

// Order-list route (ACCT-04). async Server Component mirroring account/page.jsx:
// getUser-gated (verified against the auth server, not a stale cookie), then an
// RLS-scoped fetch of the customer's own orders via getOrdersForUser. Signed-out
// access redirects to /account (the login surface). The table (number/date/total/
// status, most recent first, whole-row clickable) + empty state live in OrderList.
const OrdersPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/account");

  const orders = await getOrdersForUser();

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"My Orders"} />

      <section className='account py-80'>
        <div className='container container-lg'>
          <div className='row justify-content-center'>
            <div className='col-xl-9'>
              <OrderList orders={orders} />
            </div>
          </div>
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default OrdersPage;
