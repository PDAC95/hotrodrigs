"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Slider from "react-slick";
import { useTruckSelection } from "@/components/fitment/MyTruckSelector";
import { getStoredTruck } from "@/lib/fitment/truck-storage";
import { slugify } from "@/lib/slugify";

/**
 * Full-bleed hero photo for a personalized slide, with a left scrim so the
 * copy stays readable over the photo. Hides itself (falling back to the
 * slider's navy background) when the asset doesn't exist.
 */
const HeroBg = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) return null;
  return (
    <>
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className='position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100 object-fit-cover'
        style={{ objectPosition: "right center" }}
      />
      <span
        aria-hidden='true'
        className='position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100'
        style={{
          background:
            "linear-gradient(90deg, rgba(8, 8, 10, 0.78) 0%, rgba(8, 8, 10, 0.45) 42%, rgba(8, 8, 10, 0) 70%)",
        }}
      />
    </>
  );
};

const BannerTwo = ({ categoryTree = [] }) => {
  const settings = {
    dots: true,

    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    initialSlide: 0,
  };

  // Personalized hero: when a truck is active (same persistent fitment
  // context as the header menu and picker cards), the two slides speak to
  // THAT rig — everything-that-fits + deals-that-fit.
  const { makeId, modelId, makeName, modelName, hasTruck } =
    useTruckSelection();

  const [year, setYear] = useState("");
  useEffect(() => {
    const stored = getStoredTruck();
    setYear(stored?.year ? String(stored.year) : "");
  }, [modelId, makeId]);

  const truckLabel = hasTruck
    ? `${makeName} ${modelName}${year ? ` ’${year.slice(-2)}` : ""}`
    : "";
  const fitmentHref = hasTruck
    ? `/search?truck_model=${modelId}&truck_make=${makeId}`
    : "/search";
  const dealsHref = `${fitmentHref}&sort=price_asc`;
  // Full-bleed hero photos per model: {make}-{model}-hero.png (slide 1) and
  // {make}-{model}-hero2.png (deals slide). Missing files fall back to the
  // slider's navy background.
  const heroBase = hasTruck
    ? `/assets/images/fitment/models/${slugify(makeName)}-${slugify(
        modelName
      )}`
    : null;

  return (
    <div className='banner-two'>
      <div className='container container-lg'>
        <div className='banner-two-wrapper d-flex align-items-stretch'>
          <div className='w-265 d-lg-block d-none flex-shrink-0'>
            <div className='responsive-dropdown style-two common-dropdown nav-submenu p-0 submenus-submenu-wrapper shadow-none border border-gray-100 position-relative border-top-0'>
              <button
                type='button'
                className='close-responsive-dropdown rounded-circle text-xl position-absolute inset-inline-end-0 inset-block-start-0 mt-4 me-8 d-lg-none d-flex'
              >
                <i className='ph ph-x' />{" "}
              </button>
              <div className='logo px-16 d-lg-none d-block'>
                <Link href='/' className='link'>
                  <img src='/assets/images/logo/logo.png' alt='Logo' />
                </Link>
              </div>
              <ul className='responsive-dropdown__list scroll-sm p-0 py-8 overflow-y-auto '>
                {categoryTree.map((section) => (
                  <li key={section.id} className='has-submenus-submenu'>
                    <Link
                      href={`/c/${section.slug}`}
                      className='text-gray-500 text-15 py-12 px-16 flex-align gap-8 rounded-0'
                    >
                      <span className='text-xl d-flex'>
                        <i className='ph ph-wrench' />
                      </span>
                      <span>{section.name}</span>
                      {section.children?.length > 0 && (
                        <span className='icon text-md d-flex ms-auto'>
                          <i className='ph ph-caret-right' />
                        </span>
                      )}
                    </Link>
                    {section.children?.length > 0 && (
                      <div className='submenus-submenu py-16'>
                        <h6 className='text-lg px-16 submenus-submenu__title'>
                          {section.name}
                        </h6>
                        <ul className='submenus-submenu__list max-h-300 overflow-y-auto scroll-sm'>
                          {section.children.map((child) => (
                            <li key={child.id}>
                              <Link href={`/c/${section.slug}/${child.slug}`}>
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className='banner-item-two-wrapper rounded-24 overflow-hidden position-relative arrow-center flex-grow-1 mb-0'>
            <img
              src='/assets/images/bg/banner-two-bg.png'
              alt=''
              className='banner-img position-absolute inset-block-start-0 inset-inline-start-0 w-100 h-100 z-n1 object-fit-cover rounded-24'
            />
            <div className='banner-item-two__slider'>
              <Slider key={hasTruck ? "truck" : "generic"} {...settings}>
                {hasTruck ? (
                  <div className='banner-item-two position-relative'>
                    <HeroBg
                      src={`${heroBase}-hero.png`}
                      alt={`${makeName} ${modelName}`}
                    />
                    <div className='banner-item-two__content position-relative z-1'>
                      <span className='text-white mb-8 h6'>
                        Your truck: {truckLabel}
                      </span>
                      <h2 className='banner-item-two__title bounce text-white'>
                        Everything for your {modelName}
                      </h2>
                      <Link
                        href={fitmentHref}
                        className='btn bg-main-two-600 hover-bg-main-two-700 text-white py-14 px-32 rounded-pill mt-32 d-inline-flex align-items-center gap-8'
                      >
                        Shop parts that fit
                        <i className='ph ph-arrow-right' />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className='banner-item-two'>
                    <div className='banner-item-two__content'>
                      <span className='text-white mb-8 h6'>
                        Starting at only $250
                      </span>
                      <h2 className='banner-item-two__title bounce text-white'>
                        Get The Sound You Love For Less
                      </h2>
                    </div>
                    <div className='banner-item-two__thumb position-absolute bottom-0'>
                      <img
                        src='/assets/images/thumbs/banner-two-img.png'
                        alt=''
                      />
                    </div>
                  </div>
                )}
                {hasTruck ? (
                  <div className='banner-item-two position-relative'>
                    <HeroBg
                      src={`${heroBase}-hero2.png`}
                      alt={`${makeName} ${modelName} deals`}
                    />
                    <div className='banner-item-two__content position-relative z-1'>
                      <span className='text-white mb-8 h6'>
                        Save on parts that fit
                      </span>
                      <h2 className='banner-item-two__title bounce text-white'>
                        {modelName} deals, lowest price first
                      </h2>
                      <Link
                        href={dealsHref}
                        className='btn bg-main-two-600 hover-bg-main-two-700 text-white py-14 px-32 rounded-pill mt-32 d-inline-flex align-items-center gap-8'
                      >
                        Shop {modelName} deals
                        <i className='ph ph-arrow-right' />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className='banner-item-two'>
                    <div className='banner-item-two__content'>
                      <span className='text-white mb-8 h6'>
                        Starting at only $250
                      </span>
                      <h2 className='banner-item-two__title bounce text-white'>
                        Get The Sound You Love For Less
                      </h2>
                    </div>
                    <div className='banner-item-two__thumb position-absolute bottom-0'>
                      <img
                        src='/assets/images/thumbs/banner-two-img2.png'
                        alt=''
                      />
                    </div>
                  </div>
                )}
              </Slider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerTwo;
