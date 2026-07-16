import React from "react";

/**
 * Trust strip for inner pages (cart/checkout/account) — only TRUE claims,
 * mirroring ShippingTwo on the home: live carrier rates, US & Canada
 * delivery, Stripe payments, and a real support inbox.
 */
const ShippingOne = () => {
  return (
    <section className='shipping mb-24' id='shipping'>
      <div className='container container-lg'>
        <div className='row gy-4'>
          <div className='col-xxl-3 col-sm-6'>
            <div className='shipping-item flex-align gap-16 rounded-16 bg-main-two-50 hover-bg-main-100 transition-2'>
              <span className='w-56 h-56 flex-center rounded-circle bg-main-two-600 text-white text-32 flex-shrink-0'>
                <i className='ph-fill ph-truck' />
              </span>
              <div className=''>
                <h6 className='mb-0'>Live Shipping Rates</h6>
                <span className='text-sm text-heading'>
                  Real carrier quotes at checkout
                </span>
              </div>
            </div>
          </div>
          <div className='col-xxl-3 col-sm-6'>
            <div className='shipping-item flex-align gap-16 rounded-16 bg-main-two-50 hover-bg-main-100 transition-2'>
              <span className='w-56 h-56 flex-center rounded-circle bg-main-two-600 text-white text-32 flex-shrink-0'>
                <i className='ph-fill ph-globe-hemisphere-west' />
              </span>
              <div className=''>
                <h6 className='mb-0'>Ships US &amp; Canada</h6>
                <span className='text-sm text-heading'>
                  Parts delivered to both sides of the border
                </span>
              </div>
            </div>
          </div>
          <div className='col-xxl-3 col-sm-6'>
            <div className='shipping-item flex-align gap-16 rounded-16 bg-main-two-50 hover-bg-main-100 transition-2'>
              <span className='w-56 h-56 flex-center rounded-circle bg-main-two-600 text-white text-32 flex-shrink-0'>
                <i className='ph-fill ph-credit-card' />
              </span>
              <div className=''>
                <h6 className='mb-0'>Secure Payments</h6>
                <span className='text-sm text-heading'>
                  Card payments powered by Stripe
                </span>
              </div>
            </div>
          </div>
          <div className='col-xxl-3 col-sm-6'>
            <div className='shipping-item flex-align gap-16 rounded-16 bg-main-two-50 hover-bg-main-100 transition-2'>
              <span className='w-56 h-56 flex-center rounded-circle bg-main-two-600 text-white text-32 flex-shrink-0'>
                <i className='ph-fill ph-chats' />
              </span>
              <div className=''>
                <h6 className='mb-0'>Real Support</h6>
                <span className='text-sm text-heading'>
                  Talk to people who know trucks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShippingOne;
