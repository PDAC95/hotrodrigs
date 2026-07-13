import Link from "next/link";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import ProductGrid from "@/components/catalog/ProductGrid";
import Pagination from "@/components/catalog/Pagination";
import FilterSidebar from "@/components/catalog/FilterSidebar";
import SortSelect from "@/components/catalog/SortSelect";
import { searchProducts } from "@/lib/catalog/search";
import { areaName } from "@/lib/catalog/areas";
import { getCategoryTree } from "@/lib/catalog/categories";
import { getMakes } from "@/lib/catalog/fitment";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
  description:
    "Search Hot Rod Rigs for truck parts by name, OEM number, or category.",
};

// Search results page (async Server Component, SRCH-01/02/04).
// Composes text (FTS + pg_trgm) + category + price + fitment + sort + page in ONE
// search_products round-trip; sidebar/sort drive everything through the URL.
// Next 15: searchParams is async (await it, Pitfall 5).
const SearchPage = async ({ searchParams }) => {
  const sp = (await searchParams) ?? {};

  const q = sp.q ?? "";
  const category = sp.category ?? null;
  const truckModel = sp.truck_model ?? null;
  const priceMin = sp.price_min ?? null;
  const priceMax = sp.price_max ?? null;
  const sort = sp.sort ?? "relevance";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const area = sp.area ?? null;

  const [{ items, total, pageSize }, tree, makes] = await Promise.all([
    searchProducts({
      query: q || null,
      categoryId: category,
      truckModelId: truckModel,
      priceMin,
      priceMax,
      sort,
      page,
      area,
    }),
    getCategoryTree(),
    getMakes(),
  ]);

  const truckActive = !!truckModel;

  // Empty-fitment state (CONTEXT): a truck + (category/text) yielding nothing gets
  // a friendly message + a clear-truck affordance. Generic empty state otherwise.
  const clearTruckHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "truck_model" || key === "truck_make" || key === "page") continue;
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  })();

  const emptyState =
    truckActive ? (
      <div className='text-center py-80'>
        <p className='text-gray-700 text-lg mb-16'>
          No parts for your truck in this search.
        </p>
        <Link
          href={clearTruckHref}
          className='btn bg-main-600 text-white hover-bg-main-700 py-12 px-24 rounded-8'
        >
          View all parts
        </Link>
      </div>
    ) : (
      <div className='text-center py-80 text-gray-500'>
        {q
          ? `No results found for "${q}".`
          : "No results for this search."}
      </div>
    );

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={false} categoryTree={tree} />

      <section className='shop py-80'>
        <div className='container container-lg'>
          <nav aria-label='breadcrumb' className='mb-32'>
            <ul className='flex-align gap-8 flex-wrap text-sm text-gray-500'>
              <li>
                <Link href='/' className='hover-text-main-600'>
                  Home
                </Link>
              </li>
              <li className='flex-align gap-8'>
                <i className='ph ph-caret-right' />
                <span className='text-gray-900'>Search</span>
              </li>
            </ul>
          </nav>

          <div className='row'>
            <div className='col-lg-3'>
              <FilterSidebar
                categories={tree}
                makes={makes}
                activeFilters={sp}
              />
            </div>

            <div className='col-lg-9'>
              <div className='flex-between gap-16 flex-wrap mb-40'>
                <div>
                  <h4 className='mb-4'>
                    {q
                      ? `Results for "${q}"`
                      : areaName(area)
                      ? `${areaName(area)} Parts`
                      : "Results"}
                  </h4>
                  <span className='text-gray-900 text-sm'>
                    {total} result{total === 1 ? "" : "s"}
                  </span>
                </div>
                <SortSelect defaultSort='relevance' />
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
                basePath='/search'
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

export default SearchPage;
