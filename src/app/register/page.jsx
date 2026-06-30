import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import Breadcrumb from "@/components/Breadcrumb";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import RegisterForm from "@/components/account/RegisterForm";

export const metadata = {
  title: "Register - Hot Rod Rigs",
};

// Server Component. Next 15: searchParams is async — await it before reading.
const RegisterPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={true} />
      <Breadcrumb title={"Register"} />

      <section className='account py-80'>
        <div className='container container-lg'>
          <div className='row gy-4 justify-content-center'>
            <div className='col-xl-6 col-lg-8'>
              <RegisterForm
                error={sp.error}
                checkEmail={sp.check_email === "1"}
              />
            </div>
          </div>
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default RegisterPage;
