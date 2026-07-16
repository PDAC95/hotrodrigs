import React from "react";

const BottomFooter = () => {
  return (
    <div
      className='bottom-footer py-8'
      style={{
        background: "#151515",
        borderTop: "1px solid rgba(255, 255, 255, 0.07)",
      }}
    >
      <div className='container container-lg'>
        <div className='bottom-footer__inner flex-between flex-wrap gap-16 py-16'>
          <p className='bottom-footer__text '>
            Hot Rod Rigs © 2026. All rights reserved.
          </p>
          <div className='flex-align gap-8 flex-wrap'>
            <span className='text-heading text-sm flex-align gap-6'>
              <i className='ph-fill ph-lock-key text-main-two-600' />
              Secure payments by Stripe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomFooter;
