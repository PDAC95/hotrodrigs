"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/admin/catalog";
import VariantRows from "@/components/admin/VariantRows";

// Product + variants form wired to the create/update server actions (ADM-02).
//
// A single <form> whose action is createProduct (create) or updateProduct
// (edit). Product scalar fields + an embedded <VariantRows> (array-named
// variant inputs). In edit mode we prefill from `product` and post its id in a
// hidden field so updateProduct knows which row to touch.
//
// We wrap the submit in a client action so we can surface the action's typed
// errors ({ ok:false, error }) inline and redirect to the edit page on a
// successful create. Bootstrap classes only — no Tailwind.

const ERROR_COPY = {
  name_required: "Product name is required.",
  variant_required: "Add at least one variant with a SKU and a valid price.",
  duplicate_sku: "That SKU already exists. Pick a unique SKU.",
  invalid_id: "Could not resolve the product to update.",
};

const ProductForm = ({ mode = "create", product = null, categories = null }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const action = mode === "edit" ? updateProduct : createProduct;

  const onSubmit = (formData) => {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await action(formData);
      if (!result?.ok) {
        setError(ERROR_COPY[result?.error] ?? "Something went wrong. Try again.");
        return;
      }
      if (mode === "create") {
        router.push(`/admin/products/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <form action={onSubmit} className='product-form'>
      {mode === "edit" && (
        <input type='hidden' name='product_id' value={product?.id} />
      )}

      {error && (
        <div className='alert alert-danger py-12 px-16 rounded-8 mb-16' role='alert'>
          {error}
        </div>
      )}
      {saved && (
        <div className='alert alert-success py-12 px-16 rounded-8 mb-16' role='status'>
          Changes saved.
        </div>
      )}

      <div className='row gy-3 mb-24'>
        <div className='col-md-8'>
          <label className='form-label text-sm mb-4'>Name</label>
          <input
            type='text'
            name='name'
            required
            defaultValue={product?.name ?? ""}
            className='form-control px-16 py-12 rounded-8'
          />
        </div>

        <div className='col-md-4'>
          <label className='form-label text-sm mb-4'>Category ID</label>
          {categories && categories.length ? (
            <select
              name='category_id'
              defaultValue={product?.category_id ?? ""}
              className='form-select px-16 py-12 rounded-8'
            >
              <option value=''>None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type='number'
              name='category_id'
              min='1'
              step='1'
              defaultValue={product?.category_id ?? ""}
              placeholder='Optional'
              className='form-control px-16 py-12 rounded-8'
            />
          )}
        </div>

        <div className='col-md-6'>
          <label className='form-label text-sm mb-4'>OEM number</label>
          <input
            type='text'
            name='oem_number'
            defaultValue={product?.oem_number ?? ""}
            className='form-control px-16 py-12 rounded-8'
          />
        </div>

        <div className='col-12'>
          <label className='form-label text-sm mb-4'>Description</label>
          <textarea
            name='description'
            rows={4}
            defaultValue={product?.description ?? ""}
            className='form-control px-16 py-12 rounded-8'
          />
        </div>

        <div className='col-12'>
          <div className='form-check'>
            <input
              type='checkbox'
              name='prop65_warning'
              id='prop65_warning'
              defaultChecked={!!product?.prop65_warning}
              className='form-check-input'
            />
            <label className='form-check-label text-sm' htmlFor='prop65_warning'>
              Prop 65 warning applies
            </label>
          </div>
        </div>
      </div>

      <VariantRows initialRows={product?.product_variants ?? []} />

      <div className='mt-24'>
        <button
          type='submit'
          disabled={isPending}
          className='btn btn-main py-12 px-32 rounded-8'
        >
          {isPending
            ? "Saving…"
            : mode === "edit"
            ? "Save changes"
            : "Create product"}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
