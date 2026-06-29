import Link from "next/link";
import { notFound } from "next/navigation";
import HeaderTwo from "@/components/HeaderTwo";
import FooterTwo from "@/components/FooterTwo";
import BottomFooter from "@/components/BottomFooter";
import ColorInit from "@/helper/ColorInit";
import ScrollToTopInit from "@/helper/ScrollToTopInit";
import {
  getCategoryTree,
  getCategoryBySlug,
  getBreadcrumb,
} from "@/lib/catalog/categories";

export const dynamic = "force-dynamic";

// L1 section landing page (async Server Component). Lists the section's L2
// subcategories, each linking to its PLP. Next 15: params is async.
const SectionPage = async ({ params }) => {
  const { l1 } = await params;

  const category = await getCategoryBySlug(l1);
  // Must exist AND be an L1 (parent_id === null); otherwise 404.
  if (!category || category.parent_id !== null) notFound();

  const tree = await getCategoryTree();
  const section = tree.find((s) => s.id === category.id);
  const children = section?.children ?? [];
  const breadcrumb = getBreadcrumb(category);

  return (
    <>
      <ColorInit color={true} />
      <ScrollToTopInit color='#FA6400' />
      <HeaderTwo category={false} categoryTree={tree} />

      <section className='py-80'>
        <div className='container container-lg'>
          {/* Breadcrumb */}
          <nav aria-label='breadcrumb' className='mb-32'>
            <ul className='flex-align gap-8 flex-wrap text-sm text-gray-500'>
              <li>
                <Link href='/' className='hover-text-main-600'>
                  Home
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

          <h2 className='mb-40'>{category.name}</h2>

          {children.length === 0 ? (
            <p className='text-gray-500'>
              No subcategories in this section.
            </p>
          ) : (
            <div className='row gy-4'>
              {children.map((child) => (
                <div key={child.id} className='col-lg-3 col-sm-6 col-12'>
                  <Link
                    href={`/c/${category.slug}/${child.slug}`}
                    className='d-block h-100 p-24 border border-gray-100 hover-border-main-600 rounded-16 text-gray-900 hover-text-main-600 transition-2'
                  >
                    <span className='text-lg fw-semibold'>{child.name}</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <FooterTwo />
      <BottomFooter />
    </>
  );
};

export default SectionPage;
