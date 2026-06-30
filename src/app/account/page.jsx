import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ShippingOne from "@/components/ShippingOne";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import LoginForm from "@/components/account/LoginForm";
import RegisterForm from "@/components/account/RegisterForm";
import AccountDashboard from "@/components/account/AccountDashboard";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Account - Hot Rod Rigs",
};

// Session-gated account page (async Server Component). Uses getUser (NOT
// getSession) so the user is verified against the auth server, not just a
// possibly-stale cookie. Signed out -> login + register cards; signed in ->
// AccountDashboard (with logout).
const AccountPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"Account"} />

      <section className='account py-80'>
        <div className='container container-lg'>
          {user ? (
            <div className='row gy-4 justify-content-center'>
              <div className='col-xl-6 col-lg-8'>
                <AccountDashboard email={user.email} />
              </div>
            </div>
          ) : (
            <div className='row gy-4'>
              <div className='col-xl-6 pe-xl-5'>
                <LoginForm error={sp.error} />
              </div>
              <div className='col-xl-6'>
                <RegisterForm
                  error={sp.register_error}
                  checkEmail={sp.check_email === "1"}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <ShippingOne />
      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default AccountPage;
