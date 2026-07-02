import Link from "next/link";
import ProductForm from "@/components/admin/ProductForm";

export const metadata = {
  title: "New product - Admin - Hot Rod Rigs",
};

// Create-product page (ADM-02). Renders inside the gated 08-01 /admin layout.
// Uses the plain number-input category path (no category fetch needed) — keep
// it simple; ProductForm falls back to the number input when no categories are
// passed. On a successful create the form redirects to /admin/products/[id].
const NewProductPage = () => {
  return (
    <div>
      <div className='mb-24'>
        <Link
          href='/admin/products'
          className='text-gray-500 hover-text-main-600 text-sm flex-align gap-4 d-inline-flex'
        >
          <i className='ph ph-arrow-left' />
          Back to products
        </Link>
      </div>

      <h4 className='mb-24'>New product</h4>

      <ProductForm mode='create' />
    </div>
  );
};

export default NewProductPage;
