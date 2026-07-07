import { redirect } from "next/navigation";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ShippingOne from "@/components/ShippingOne";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "@/lib/auth/set-password-actions";

export const metadata = {
  title: "Set Password",
};

const ERROR_COPY = {
  weak_password: "Password must be at least 8 characters.",
  update_failed: "We couldn't save your password. Please try again.",
};

// Session-gated landing for the guest-activation recovery link (EML-02). The
// email link routes through /auth/confirm (verifyOtp signs the buyer in) and
// lands here with a live session; anyone signed out belongs on the login page.
// Plain <form action> server action — progressive enhancement, zero client JS.
const SetPasswordPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/account");

  const errorMessage = ERROR_COPY[sp.error] ?? null;

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"Set Password"} />

      <section className='account py-80'>
        <div className='container container-lg'>
          <div className='row gy-4 justify-content-center'>
            <div className='col-xl-6'>
              <div className='border border-gray-100 hover-border-main-600 transition-1 rounded-16 px-24 py-40'>
                <h6 className='text-xl mb-16'>Set your password</h6>
                <p className='text-gray-500 mb-24'>
                  Choose a password for <strong>{user.email}</strong> to finish
                  setting up your account.
                </p>
                {errorMessage ? (
                  <p className='text-danger-600 text-sm'>{errorMessage}</p>
                ) : null}
                <form action={setPassword}>
                  <div className='mb-24'>
                    <label
                      htmlFor='set-password-input'
                      className='text-neutral-900 text-lg mb-8 fw-medium'
                    >
                      New password <span className='text-danger'>*</span>
                    </label>
                    <input
                      type='password'
                      className='common-input'
                      id='set-password-input'
                      name='password'
                      placeholder='New password (min. 8 characters)'
                      autoComplete='new-password'
                      required
                      minLength={8}
                    />
                  </div>
                  <button
                    type='submit'
                    className='btn btn-main py-18 px-40 rounded-8'
                  >
                    Save password
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShippingOne />
      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default SetPasswordPage;
