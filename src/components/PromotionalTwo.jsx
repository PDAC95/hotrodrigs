import React from "react";

const PromotionalTwo = () => {
  return (
    <section className='promotional-banner mt-32'>
      <div className='container container-lg'>
        <div className='row gy-4'>
          <div className='col-lg-4 col-sm-6'>
            <div className='position-relative rounded-16 overflow-hidden z-1 p-32'>
              <img
                src='/assets/images/bg/promo-bg-img1.png'
                alt=''
                className='position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100 object-fit-cover z-n1'
              />
              <div className='flex-between flex-wrap gap-16'>
                <div className=''>
                  <span className='text-heading text-sm mb-8'>Latest Deal</span>
                  <h6 className='mb-0'>iPhone 15 Pro Max</h6>
                </div>
                <div className='pe-xxl-4'>
                  <img src='/assets/images/thumbs/promo-img1.png' alt='' />
                </div>
              </div>
            </div>
          </div>
          <div className='col-lg-4 col-sm-6'>
            <div className='position-relative rounded-16 overflow-hidden z-1 p-32'>
              <img
                src='/assets/images/bg/promo-bg-img2.png'
                alt=''
                className='position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100 object-fit-cover z-n1'
              />
              <div className='flex-between flex-wrap gap-16'>
                <div className=''>
                  <span className='text-heading text-sm mb-8'>Get 60% Off</span>
                  <h6 className='mb-0'>Instax Mini 11 Camera</h6>
                </div>
                <div className='pe-xxl-4'>
                  <img src='/assets/images/thumbs/promo-img2.png' alt='' />
                </div>
              </div>
            </div>
          </div>
          <div className='col-lg-4 col-sm-6'>
            <div className='position-relative rounded-16 overflow-hidden z-1 p-32'>
              <img
                src='/assets/images/bg/promo-bg-img3.png'
                alt=''
                className='position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100 object-fit-cover z-n1'
              />
              <div className='flex-between flex-wrap gap-16'>
                <div className=''>
                  <span className='text-heading text-sm mb-8'>
                    Start From $250
                  </span>
                  <h6 className='mb-0'>Airpod Headphone</h6>
                </div>
                <div className='pe-xxl-4'>
                  <img src='/assets/images/thumbs/promo-img3.png' alt='' />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromotionalTwo;
