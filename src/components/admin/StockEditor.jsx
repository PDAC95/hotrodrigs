"use client";

import { useState } from "react";
import { setVariantStock } from "@/lib/admin/stock";

// Per-variant stock editor (ADM-03 + STOCK-03). Shopify-style tracked/untracked
// model: the "Track inventory" toggle decides whether a numeric count is posted.
// Toggle ON from untracked -> the numeric field starts EMPTY and required (an
// accidental 0 = dead product is the exact failure mode to prevent); toggle OFF
// -> no numeric field posted at all, the server saves stock NULL (orderable).
// Submits through setVariantStock but intercepts the result for an inline error.
// Bootstrap classes only.
const StockEditor = ({ variantId, currentStock }) => {
  const [tracked, setTracked] = useState(
    currentStock !== null && currentStock !== undefined
  );
  const [error, setError] = useState(null);

  async function clientAction(formData) {
    setError(null);
    const res = await setVariantStock(formData);
    if (res && !res.ok) {
      setError(
        res.error === "invalid_input"
          ? "Enter a stock count to track inventory"
          : "Save failed — try again"
      );
    }
  }

  return (
    <form action={clientAction} className='flex-align flex-wrap gap-8'>
      <input type='hidden' name='variant_id' value={variantId} />
      <div className='form-check form-check-inline mb-0'>
        <input
          type='checkbox'
          name='track_inventory'
          checked={tracked}
          onChange={(e) => {
            setTracked(e.target.checked);
            setError(null);
          }}
          className='form-check-input'
          id={`track-inventory-${variantId}`}
        />
        <label
          className='form-check-label text-sm'
          htmlFor={`track-inventory-${variantId}`}
        >
          Track inventory
        </label>
      </div>
      {tracked && (
        <input
          type='number'
          name='stock'
          min='0'
          step='1'
          required
          defaultValue={currentStock ?? ""}
          aria-label='Stock quantity'
          className='form-control w-100 px-12 py-8 rounded-8'
          style={{ maxWidth: "96px" }}
        />
      )}
      <button type='submit' className='btn btn-main btn-sm py-8 px-16 rounded-8'>
        Save
      </button>
      {error && <span className='text-sm text-danger-600'>{error}</span>}
    </form>
  );
};

export default StockEditor;
