"use client";

import { setVariantStock } from "@/lib/admin/stock";

// Per-variant stock input (ADM-03). Progressive enhancement: the form posts the
// setVariantStock server action directly, which revalidates /admin/stock so the
// page re-renders the new stock — no useState needed. Bootstrap classes only.
const StockEditor = ({ variantId, currentStock }) => {
  return (
    <form action={setVariantStock} className='flex-align gap-8'>
      <input type='hidden' name='variant_id' value={variantId} />
      <input
        type='number'
        name='stock'
        min='0'
        step='1'
        defaultValue={currentStock ?? 0}
        aria-label='Stock quantity'
        className='form-control w-100 px-12 py-8 rounded-8'
        style={{ maxWidth: "96px" }}
      />
      <button type='submit' className='btn btn-main btn-sm py-8 px-16 rounded-8'>
        Save
      </button>
    </form>
  );
};

export default StockEditor;
