import Link from "next/link";
import { listAdminProducts } from "@/lib/admin/catalog";
import { formatPrice } from "@/lib/format";

export const metadata = {
  title: "Products",
};

// Admin product list + search page (ADM-02). Renders inside the gated 08-01
// /admin layout — section content only. Reads the ?q= search param and lists
// matching products (URL-driven, mirroring the storefront/stock search pattern
// — never client-side list filtering). The search scopes the result set so we
// never render the whole ~10k-parent catalog.
const AdminProductsPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};
  const q = sp.q ?? "";

  const products = await listAdminProducts({ q });

  const priceRange = (p) => {
    if (p.price_min == null && p.price_max == null) return "—";
    if (p.price_min === p.price_max) return formatPrice(p.price_min);
    return `${formatPrice(p.price_min)} – ${formatPrice(p.price_max)}`;
  };

  return (
    <div>
      <div className='d-flex align-items-center justify-content-between mb-8'>
        <h4 className='mb-0'>Products</h4>
        <Link
          href='/admin/products/new'
          className='btn btn-main py-12 px-24 rounded-8'
        >
          <i className='ph ph-plus me-4' />
          New product
        </Link>
      </div>
      <p className='text-gray-500 mb-24'>
        Search a product by name or slug, then open it to edit its fields and variants.
      </p>

      <form method='get' className='flex-align gap-12 mb-32' role='search'>
        <input
          type='text'
          name='q'
          defaultValue={q}
          placeholder='Search by name or slug'
          aria-label='Search products'
          className='form-control px-16 py-12 rounded-8'
          style={{ maxWidth: "320px" }}
        />
        <button type='submit' className='btn btn-main py-12 px-24 rounded-8'>
          Search
        </button>
      </form>

      {products.length === 0 ? (
        <div className='border border-gray-100 rounded-16 px-24 py-40 text-center'>
          <span className='w-56 h-56 flex-center rounded-circle bg-main-50 text-main-600 text-2xl mb-16 mx-auto'>
            <i className='ph ph-package' />
          </span>
          <h6 className='text-lg mb-8'>
            {q ? "No products match your search" : "Search for a product"}
          </h6>
          <p className='text-gray-500 mb-0 text-sm'>
            Enter a name or slug above, or create a new product.
          </p>
        </div>
      ) : (
        <div className='table-responsive'>
          <table className='table align-middle'>
            <thead>
              <tr>
                <th scope='col'>Name</th>
                <th scope='col'>Slug</th>
                <th scope='col'>Price range</th>
                <th scope='col'>Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className='fw-medium'>
                    <Link
                      href={`/admin/products/${p.id}`}
                      className='text-main-600 hover-text-decoration-underline'
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className='text-gray-500 text-sm'>{p.slug}</td>
                  <td>{priceRange(p)}</td>
                  <td>
                    {p.in_stock ? (
                      <span className='badge bg-success-600 text-white px-12 py-6 rounded-8'>
                        In stock
                      </span>
                    ) : (
                      <span className='badge bg-gray-100 text-gray-700 px-12 py-6 rounded-8'>
                        Out of stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
