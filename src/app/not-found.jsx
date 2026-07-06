import Link from "next/link";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import { getCategoryTreeStatic } from "@/lib/catalog/categories";

// Branded 404 (async Server Component — App Router supports async not-found).
// Full site chrome so a lost user keeps navigation, plus two exits: a home
// button and a plain GET search form (/search reads sp.q, zero client JS).
// Uses the COOKIE-LESS getCategoryTreeStatic: the cookie-aware getCategoryTree
// calls cookies() (Dynamic API), and Dynamic APIs in the root not-found force
// every static route in the app to render dynamically (○ -> ƒ regression).
export default async function NotFound() {
  const categoryTree = await getCategoryTreeStatic();

  return (
    <>
      {/* ColorInit */}
      <ColorInit color={true} />

      {/* ScrollToTop */}
      <ScrollToTopInit color='#FA6400' />

      {/* HeaderTwo */}
      <HeaderTwo category={false} categoryTree={categoryTree} />

      <section className='py-80 d-flex justify-content-center align-items-center overflow-hidden not__found'>
        <div className='container container-two'>
          <div className='row justify-content-center'>
            <div className='col-lg-6 col-md-8 col-sm-10'>
              <div className='cart-thank__content text-center'>
                <h2 className='cart-thank__title mb-48'>
                  Looks like this road&apos;s a dead end.
                </h2>
                <div className='text-file'>
                  <p>
                    The page you&apos;re after got towed, scrapped, or never
                    rolled off the line. Let&apos;s get you back on the road.
                  </p>
                </div>
                <div className='d-adjust mb-32'>
                  <Link
                    className='default-btn btn btn-main d-inline-flex align-items-center rounded-pill gap-8'
                    href='/'
                  >
                    Back to the Garage
                  </Link>
                </div>
                {/* Search exit: plain GET form — /search reads ?q= server-side */}
                <form
                  action='/search'
                  method='get'
                  className='d-flex justify-content-center gap-8 flex-wrap'
                >
                  <input
                    type='text'
                    name='q'
                    className='common-input py-13 ps-16 pe-18 rounded-pill border border-gray-100'
                    placeholder='Search parts...'
                  />
                  <button
                    type='submit'
                    className='btn btn-main py-13 px-24 rounded-pill flex-shrink-0'
                  >
                    Search
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FooterTwo */}
      <FooterTwo />

      {/* BottomFooter */}
      <BottomFooter />
    </>
  );
}
