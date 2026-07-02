import Link from "next/link";
import { getAdminProduct } from "@/lib/admin/catalog";
import ProductForm from "@/components/admin/ProductForm";

export const metadata = {
  title: "Edit product - Admin - Hot Rod Rigs",
};

// Edit-product page (ADM-02). Renders inside the gated 08-01 /admin layout.
// Next 15 async params. Fetches the product + its variants for the prefilled
// edit form; a null product renders a friendly "not found" (never notFound(),
// consistent with the storefront/order pattern).
const EditProductPage = async ({ params }) => {
  const { id } = await params;
  const product = await getAdminProduct(Number(id));

  if (!product) {
    return (
      <div>
        <div className='border border-gray-100 rounded-16 px-24 py-40 text-center'>
          <span className='w-56 h-56 flex-center rounded-circle bg-main-50 text-main-600 text-2xl mb-16 mx-auto'>
            <i className='ph ph-package' />
          </span>
          <h6 className='text-lg mb-8'>Product not found</h6>
          <p className='text-gray-500 mb-24 text-sm'>
            The product you are looking for does not exist.
          </p>
          <Link href='/admin/products' className='btn btn-main py-12 px-24 rounded-8'>
            Back to products
          </Link>
        </div>
      </div>
    );
  }

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

      <h4 className='mb-24'>{product.name}</h4>

      <ProductForm mode='edit' product={product} />
    </div>
  );
};

export default EditProductPage;
