import Link from "next/link";
import { notFound } from "next/navigation";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import ProductGrid from "@/components/catalog/ProductGrid";
import Pagination from "@/components/catalog/Pagination";
import {
  getCategoryTree,
  getCategoryBySlug,
  getBreadcrumb,
} from "@/lib/catalog/categories";
import { listProductsByCategory } from "@/lib/catalog/products";

export const dynamic = "force-dynamic";

// L2 subcategory PLP (async Server Component) — the main listing.
// One paginated query per page via listProductsByCategory (BRWS-06): no full-catalog fetch.
// Next 15: params and searchParams are async (await them, Pitfall 5).
const PlpPage = async ({ params, searchParams }) => {
  const { l1, l2 } = await params;
  const sp = (await searchParams) ?? {};

  const category = await getCategoryBySlug(l2);
  if (!category) notFound();

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sort = sp.sort ?? "featured";

  const [{ items, total, pageSize }, tree] = await Promise.all([
    listProductsByCategory(category.id, { page, sort }),
    getCategoryTree(),
  ]);

  const breadcrumb = getBreadcrumb(category);
  const basePath = `/c/${l1}/${l2}`;

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
            {/*
              Sidebar slot — FilterSidebar (price / fitment / stock) arrives in 03-05.
              Reuses ShopSection's left-column structure so 03-05 only drops the
              control set into this column. Intentionally empty for now.
            */}
            <div className='col-lg-3'>
              <div className='shop-sidebar'>
                <div className='shop-sidebar__box border border-gray-100 rounded-8 p-32 mb-32'>
                  <h6 className='text-xl mb-0'>Filtros</h6>
                  <p className='text-sm text-gray-500 mt-8 mb-0'>
                    Próximamente.
                  </p>
                </div>
              </div>
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
                {/*
                  Sort control slot — the interactive SortSelect island arrives in 03-05.
                  Kept as a plain (non-functional) select reflecting the current sort so
                  03-05 only swaps the control in; the data layer already supports `sort`.
                */}
                <div className='position-relative text-gray-500 flex-align gap-8 text-14'>
                  <label htmlFor='sorting' className='text-inherit flex-shrink-0'>
                    Ordenar por:
                  </label>
                  <select
                    defaultValue={sort}
                    disabled
                    className='form-control common-input px-14 py-14 text-inherit rounded-6 w-auto'
                    id='sorting'
                  >
                    <option value='featured'>Destacados</option>
                    <option value='price_asc'>Precio: menor a mayor</option>
                    <option value='price_desc'>Precio: mayor a menor</option>
                    <option value='name'>Nombre</option>
                  </select>
                </div>
              </div>

              <ProductGrid products={items} />

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
