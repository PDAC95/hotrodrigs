import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductBySlug } from "@/lib/catalog/products";

import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ShippingOne from "@/components/ShippingOne";
import NewsletterOne from "@/components/NewsletterOne";

import ProductGallery from "@/components/catalog/ProductGallery";
import Prop65Warning from "@/components/catalog/Prop65Warning";
import PdpPurchasePanel from "@/components/cart/PdpPurchasePanel";

import ColorInit from "@/helper/ColorInit";
import Preloader from "@/helper/Preloader";
import ScrollToTopInit from "@/helper/ScrollToTopInit";

export const metadata = {
  title: "Hot Rod Rigs - Product",
  description: "Heavy-duty truck part detail.",
};

// Async Server Component — fetches the full product aggregate (parent + all variants +
// images + category) in ONE query (Variant Matrix, RESEARCH.md Pattern 3). No N+1.
const page = async ({ params }) => {
  const { slug } = await params; // Next 15: params is async.
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = product.categories;
  const variants = product.product_variants ?? [];

  return (
    <>
      {/* ColorInit — design-2 orange palette */}
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <Preloader />

      <HeaderTwo category={true} />

      {/* Breadcrumb from the owning category */}
      <div className='breadcrumb mb-0 py-26 bg-main-two-50'>
        <div className='container container-lg'>
          <div className='breadcrumb-wrapper flex-between flex-wrap gap-16'>
            <ul className='flex-align gap-8 flex-wrap'>
              <li className='text-sm'>
                <Link
                  href='/'
                  className='text-gray-900 flex-align gap-8 hover-text-main-600'
                >
                  <i className='ph ph-house' />
                  Home
                </Link>
              </li>
              {category && (
                <li className='flex-align gap-8 text-sm text-main-two-600'>
                  <i className='ph ph-caret-right' />
                  <span className='text-main-two-600 fw-normal text-15'>
                    {category.name}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <section className='product-details py-80'>
        <div className='container container-lg'>
          <div className='row gy-4'>
            <div className='col-xl-9'>
              <div className='row gy-4'>
                <div className='col-xl-6'>
                  <ProductGallery images={product.product_images} />
                </div>
                <div className='col-xl-6'>
                  <div className='product-details__content'>
                    <h5 className='mb-12'>{product.name}</h5>

                    {/* OEM# / SKU line */}
                    <div className='flex-align flex-wrap gap-12'>
                      {product.oem_number && (
                        <span className='text-gray-900'>
                          <span className='text-gray-400'>OEM#: </span>
                          {product.oem_number}
                        </span>
                      )}
                    </div>

                    <span className='mt-32 pt-32 text-gray-700 border-top border-gray-100 d-block' />

                    {/* Description */}
                    {product.description && (
                      <p className='text-gray-700'>{product.description}</p>
                    )}

                    {/* Prop 65 warning — visible block near the price/add area */}
                    <Prop65Warning show={product.prop65_warning} />

                    {/* Variant selector + wired Add-To-Cart (client island).
                        The selected variant drives price/availability AND the
                        add button + qty cap. */}
                    <PdpPurchasePanel
                      variants={variants}
                      priceMin={product.price_min}
                      priceMax={product.price_max}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className='col-xl-3'>
              <div className='product-details__sidebar py-40 px-32 border border-gray-100 rounded-16'>
                <div className='mb-32'>
                  <h6 className='text-lg mb-8 text-heading fw-semibold d-block'>
                    Specifications
                  </h6>
                  <ul className='mt-16'>
                    {product.oem_number && (
                      <li className='text-gray-400 mb-14 flex-align gap-14'>
                        <span className='w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle'>
                          <i className='ph ph-check' />
                        </span>
                        <span className='text-heading fw-medium'>
                          OEM#:
                          <span className='text-gray-500'>
                            {" "}
                            {product.oem_number}
                          </span>
                        </span>
                      </li>
                    )}
                    {category && (
                      <li className='text-gray-400 mb-14 flex-align gap-14'>
                        <span className='w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle'>
                          <i className='ph ph-check' />
                        </span>
                        <span className='text-heading fw-medium'>
                          Category:
                          <span className='text-gray-500'> {category.name}</span>
                        </span>
                      </li>
                    )}
                    {product.fits_all && (
                      <li className='text-gray-400 mb-14 flex-align gap-14'>
                        <span className='w-20 h-20 bg-main-50 text-main-600 text-xs flex-center rounded-circle'>
                          <i className='ph ph-check' />
                        </span>
                        <span className='text-heading fw-medium'>
                          Fitment:
                          <span className='text-gray-500'> Universal</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShippingOne />
      <NewsletterOne />
      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default page;
