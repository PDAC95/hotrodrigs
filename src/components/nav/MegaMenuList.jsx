import Link from "next/link";

/**
 * Presentational category mega-menu list (no client logic — CSS hover reveals the
 * L2 submenu via the existing MarketPro `has-submenus-submenu` styling). Renders the
 * real L1 -> L2 tree: each L1 links to /c/{l1}, each L2 to /c/{l1}/{l2}.
 *
 * Importable from both the server `MegaMenu` wrapper and the client `HeaderTwo`
 * (it has no server-only deps), so the category tree can be fetched server-side and
 * passed down as a prop. Renders nothing if the tree is absent (graceful fallback).
 */
const MegaMenuList = ({ tree = [] }) => {
  if (!Array.isArray(tree) || tree.length === 0) return null;

  return (
    <ul className='scroll-sm p-0 py-8 w-300 max-h-400 overflow-y-auto'>
      {tree.map((section) => (
        <li key={section.id} className='has-submenus-submenu'>
          <Link
            href={`/c/${section.slug}`}
            className='text-gray-500 text-15 py-12 px-16 flex-align gap-8 rounded-0'
          >
            <span className='text-xl d-flex'>
              <i className='ph ph-wrench' />
            </span>
            <span>{section.name}</span>
            {section.children?.length > 0 && (
              <span className='icon text-md d-flex ms-auto'>
                <i className='ph ph-caret-right' />
              </span>
            )}
          </Link>
          {section.children?.length > 0 && (
            <div className='submenus-submenu py-16'>
              <h6 className='text-lg px-16 submenus-submenu__title'>
                {section.name}
              </h6>
              <ul className='submenus-submenu__list max-h-300 overflow-y-auto scroll-sm'>
                {section.children.map((child) => (
                  <li key={child.id}>
                    <Link href={`/c/${section.slug}/${child.slug}`}>
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

export default MegaMenuList;
