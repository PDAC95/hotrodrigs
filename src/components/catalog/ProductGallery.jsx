"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

// slick is browser-only — load with SSR disabled, matching ProductDetailsTwo.jsx.
const Slider = dynamic(() => import("react-slick"), { ssr: false });

const PLACEHOLDER = "/assets/images/placeholder-product.png";

// Swap any broken/missing supplier URL for the placeholder (Pitfall 6: ~39K external
// supplier image URLs, some 404). Guard so a broken placeholder can't loop forever.
function handleImgError(e) {
  if (e.currentTarget.src.endsWith(PLACEHOLDER)) return;
  e.currentTarget.src = PLACEHOLDER;
}

const ProductGallery = ({ images = [] }) => {
  // Normalize: data layer orders by sort_order already. Empty -> single placeholder.
  const gallery =
    images.length > 0
      ? images.slice(0, 10).map((img) => ({
          url: img.url || PLACEHOLDER,
          alt: img.alt || "Product image",
        }))
      : [{ url: PLACEHOLDER, alt: "Product image" }];

  const [mainImage, setMainImage] = useState(gallery[0].url);

  const settingsThumbs = {
    dots: false,
    infinite: gallery.length > 4,
    speed: 500,
    slidesToShow: Math.min(4, gallery.length),
    slidesToScroll: 1,
    focusOnSelect: true,
  };

  return (
    <div className='product-details__left'>
      <div className='product-details__thumb-slider border border-gray-100 rounded-16'>
        <div className=''>
          <div className='product-details__thumb flex-center h-100'>
            <img src={mainImage} alt='Main Product' onError={handleImgError} />
          </div>
        </div>
      </div>

      {gallery.length > 1 && (
        <div className='mt-24'>
          <div className='product-details__images-slider'>
            <Slider {...settingsThumbs}>
              {gallery.map((image, index) => (
                <div
                  className='center max-w-120 max-h-120 h-100 flex-center border border-gray-100 rounded-16 p-8'
                  key={index}
                  onClick={() => setMainImage(image.url)}
                >
                  <img
                    className='thum'
                    src={image.url}
                    alt={image.alt}
                    onError={handleImgError}
                  />
                </div>
              ))}
            </Slider>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
