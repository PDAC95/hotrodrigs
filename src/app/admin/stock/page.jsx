import { findVariants } from "@/lib/admin/stock";
import StockEditor from "@/components/admin/StockEditor";

export const metadata = {
  title: "Stock",
};

// Admin stock management page (ADM-03). Renders inside the gated 08-01 /admin
// layout — section content only. Reads the ?q= search param and lists the
// matching variants (URL-driven, mirroring the storefront search/filter pattern
// — Phase 3 decision: never client-side list filtering). The search box scopes
// the result set so we never render the whole ~10.8k-variant catalog.
const AdminStockPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};
  const q = sp.q ?? "";

  const variants = await findVariants({ q });

  return (
    <div>
      <h4 className='mb-8'>Stock</h4>
      <p className='text-gray-500 mb-24'>
        Search a variant by SKU, then set its stock quantity.
      </p>

      <form method='get' className='flex-align gap-12 mb-32' role='search'>
        <input
          type='text'
          name='q'
          defaultValue={q}
          placeholder='Search by SKU'
          aria-label='Search by SKU'
          className='form-control px-16 py-12 rounded-8'
          style={{ maxWidth: "320px" }}
        />
        <button type='submit' className='btn btn-main py-12 px-24 rounded-8'>
          Search
        </button>
      </form>

      {variants.length === 0 ? (
        <div className='border border-gray-100 rounded-16 px-24 py-40 text-center'>
          <span className='w-56 h-56 flex-center rounded-circle bg-main-50 text-main-600 text-2xl mb-16 mx-auto'>
            <i className='ph ph-stack' />
          </span>
          <h6 className='text-lg mb-8'>
            {q ? "No variants match that SKU" : "Search for a variant"}
          </h6>
          <p className='text-gray-500 mb-0 text-sm'>
            Enter a SKU above to find a variant and adjust its stock.
          </p>
        </div>
      ) : (
        <div className='table-responsive'>
          <table className='table align-middle'>
            <thead>
              <tr>
                <th scope='col'>SKU</th>
                <th scope='col'>Product</th>
                <th scope='col'>Size · Pack</th>
                <th scope='col'>Stock</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td className='fw-medium'>{v.sku}</td>
                  <td>{v.products?.name ?? "—"}</td>
                  <td className='text-gray-500 text-sm'>
                    {[v.size, v.pack].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>
                    <StockEditor variantId={v.id} currentStock={v.stock} />
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

export default AdminStockPage;
