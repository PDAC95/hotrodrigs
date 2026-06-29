import Link from "next/link";
import { notFound } from "next/navigation";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import ProductGrid from "@/components/catalog/ProductGrid";
import Pagination from "@/components/catalog/Pagination";
import FilterSidebar from "@/components/catalog/FilterSidebar";
import SortSelect from "@/components/catalog/SortSelect";
import {
  getCategoryTree,
  getCategoryBySlug,
  getBreadcrumb,
} from "@/lib/catalog/categories";
import { listProductsByCategory } from "@/lib/catalog/products";
import { searchProducts } from "@/lib/catalog/search";
import { getMakes } from "@/lib/catalog/fitment";

export const dynamic = "force-dynamic";

// L2 subcategory PLP (async Server Component) — the main listing.
// Plain category browse uses listProductsByCategory (one indexed paginated query,
// BRWS-06). When a fitment/text/price facet is present (SRCH-04), it routes through
// search_products so category + truck + text + price COMBINE in one RPC call.
// Next 15: params and searchParams are async (await them, Pitfall 5).
const PlpPage = async ({ params, searchParams }) => {
  const { l1, l2 } = await params;
  const sp = (await searchParams) ?? {};

  const category = await getCategoryBySlug(l2);
  if (!category) notFound();

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const truckModel = sp.truck_model ?? null;
  const truckActive = !!truckModel;

  // Any facet beyond plain category browse forces the composite search path.
  const useSearch =
    !!truckModel || !!sp.q || !!sp.price_min || !!sp.price_max;

  // Default sort differs by path: search ranks by relevance, browse by featured.
  const sort = sp.sort ?? (useSearch ? "relevance" : "featured");

  const listing = useSearch
    ? await searchProducts({
        query: sp.q || null,
        categoryId: category.id,
        truckModelId: truckModel,
        priceMin: sp.price_min ?? null,
        priceMax: sp.price_max ?? null,
        sort,
        page,
      })
    : await listProductsByCategory(category.id, { page, sort });

  const { items, total, pageSize } = listing;
  const [tree, makes] = await Promise.all([getCategoryTree(), getMakes()]);

  const breadcrumb = getBreadcrumb(category);
  const basePath = `/c/${l1}/${l2}`;

  // Friendly empty-fitment state (CONTEXT): a truck + this category with no parts.
  const clearTruckHref = (() => {
    const qp = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "truck_model" || key === "truck_make" || key === "page") continue;
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => qp.append(key, v));
      else qp.set(key, String(value));
    }
    const qs = qp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  })();

  const emptyState = truckActive ? (
    <div className='text-center py-80'>
      <p className='text-gray-700 text-lg mb-16'>
        No hay partes para tu camión en esta categoría.
      </p>
      <Link
        href={clearTruckHref}
        className='btn bg-main-600 text-white hover-bg-main-700 py-12 px-24 rounded-8'
      >
        Ver todas las partes
      </Link>
    </div>
  ) : null;

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={false} categoryTree={tree} />

      <section className='shop py-80'>
        <div className='container container-lg'>
          {/* Breadcrumb */}
          <nav aria-label='breadcrumb' className='mb-32'>
            <ul className='flex-align gap-8 flex-wrap text-sm text-gray-500'>
              <li>
                <Link href='/' className='hover-text-main-600'>
                  Inicio
                </Link>
              </li>
              {breadcrumb.map((crumb, i) => (
                <li key={crumb.slug} className='flex-align gap-8'>
                  <i className='ph ph-caret-right' />
                  {i === breadcrumb.length - 1 ? (
                    <span className='text-gray-900'>{crumb.name}</span>
                  ) : (
                    <Link
                      href={`/c/${crumb.slug}`}
                      className='hover-text-main-600'
                    >
                      {crumb.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className='row'>
            {/* Sidebar — facet filter island (03-05). */}
            <div className='col-lg-3'>
              <FilterSidebar
                categories={tree}
                makes={makes}
                activeFilters={sp}
              />
            </div>

            {/* Content */}
            <div className='col-lg-9'>
              <div className='flex-between gap-16 flex-wrap mb-40'>
                <div>
                  <h4 className='mb-4'>{category.name}</h4>
                  <span className='text-gray-900 text-sm'>
                    {total} resultado{total === 1 ? "" : "s"}
                  </span>
                </div>
                <SortSelect defaultSort={useSearch ? "relevance" : "featured"} />
              </div>

              <ProductGrid
                products={items}
                truckActive={truckActive}
                emptyState={emptyState}
              />

              <Pagination
                page={page}
                total={total}
                pageSize={pageSize}
                basePath={basePath}
                searchParams={sp}
              />
            </div>
          </div>
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default PlpPage;
