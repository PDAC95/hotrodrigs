"use client";

import { useState } from "react";

// Dynamic list of variant input rows for the product form (ADM-02).
//
// Presentational only — renders inputs INSIDE the parent <form>, never its own
// <form>. Every field is named as an ARRAY (variant_sku, variant_price, ...) so
// the createProduct/updateProduct server actions can formData.getAll() them and
// zip the rows back together. Existing variants carry their id in the hidden
// variant_id input (the server updates those in place); a blank variant_id marks
// a new row to insert. Bootstrap grid + form-control — no Tailwind.

let ROW_KEY = 0;
function nextKey() {
  ROW_KEY += 1;
  return `vr-${ROW_KEY}`;
}

function toRow(v) {
  return {
    key: nextKey(),
    id: v?.id != null ? String(v.id) : "",
    sku: v?.sku ?? "",
    size: v?.size ?? "",
    pack: v?.pack ?? "",
    price: v?.price != null ? String(v.price) : "",
    stock: v?.stock != null ? String(v.stock) : "", // empty = untracked/orderable
  };
}

const VariantRows = ({ initialRows = [] }) => {
  const [rows, setRows] = useState(() => {
    const seed = (initialRows ?? []).map(toRow);
    return seed.length ? seed : [toRow(null)];
  });

  const addRow = () => setRows((prev) => [...prev, toRow(null)]);

  const removeRow = (key) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  return (
    <div className='variant-rows'>
      <div className='d-flex align-items-center justify-content-between mb-16'>
        <h6 className='text-md mb-0'>Variants</h6>
        <button
          type='button'
          onClick={addRow}
          className='btn btn-outline-main btn-sm py-8 px-16 rounded-8'
        >
          <i className='ph ph-plus me-4' />
          Add variant
        </button>
      </div>

      {rows.map((row) => {
        const existing = row.id !== "";
        return (
          <div
            key={row.key}
            className='row gy-2 gx-2 align-items-end border border-gray-100 rounded-12 p-12 mb-12'
          >
            {/* Hidden id keeps existing rows identifiable to the server action. */}
            <input type='hidden' name='variant_id' defaultValue={row.id} />

            <div className='col-md-3'>
              <label className='form-label text-sm mb-4'>SKU</label>
              <input
                type='text'
                name='variant_sku'
                defaultValue={row.sku}
                readOnly={existing}
                placeholder='Unique SKU'
                className='form-control px-12 py-8 rounded-8'
              />
            </div>

            <div className='col-md-2'>
              <label className='form-label text-sm mb-4'>Size</label>
              <input
                type='text'
                name='variant_size'
                defaultValue={row.size}
                className='form-control px-12 py-8 rounded-8'
              />
            </div>

            <div className='col-md-2'>
              <label className='form-label text-sm mb-4'>Pack</label>
              <input
                type='text'
                name='variant_pack'
                defaultValue={row.pack}
                className='form-control px-12 py-8 rounded-8'
              />
            </div>

            <div className='col-md-2'>
              <label className='form-label text-sm mb-4'>Price</label>
              <input
                type='number'
                name='variant_price'
                min='0'
                step='0.01'
                defaultValue={row.price}
                placeholder='0.00'
                className='form-control px-12 py-8 rounded-8'
              />
            </div>

            <div className='col-md-2'>
              <label className='form-label text-sm mb-4'>
                Stock (blank = orderable)
              </label>
              <input
                type='number'
                name='variant_stock'
                min='0'
                step='1'
                defaultValue={row.stock}
                placeholder='Orderable'
                className='form-control px-12 py-8 rounded-8'
              />
            </div>

            <div className='col-md-1 text-md-center'>
              <button
                type='button'
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
                aria-label='Remove variant'
                className='btn btn-outline-danger btn-sm py-8 px-12 rounded-8'
              >
                <i className='ph ph-trash' />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VariantRows;
