"use client";

/**
 * PdpPurchasePanel — the only client island on the PDP. Owns the selected-variant
 * state so VariantSelector (pills + price) and AddToCartButton (qty + add) share
 * it without making the whole PDP a client component (CLAUDE.md page pattern).
 *
 * VariantSelector lifts its `match` up via onVariantChange; the button reads it.
 */

import React, { useCallback, useState } from "react";

import VariantSelector from "@/components/catalog/VariantSelector";
import AddToCartButton from "@/components/cart/AddToCartButton";

const PdpPurchasePanel = ({ variants = [], priceMin, priceMax }) => {
  const [selected, setSelected] = useState(null);

  const handleVariantChange = useCallback((variant) => {
    setSelected(variant);
  }, []);

  return (
    <>
      <VariantSelector
        variants={variants}
        priceMin={priceMin}
        priceMax={priceMax}
        onVariantChange={handleVariantChange}
      />

      <span className='mt-32 pt-32 text-gray-700 border-top border-gray-100 d-block' />

      <AddToCartButton variant={selected} />
    </>
  );
};

export default PdpPurchasePanel;
