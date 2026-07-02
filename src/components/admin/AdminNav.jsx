"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Admin sidebar navigation. Client Component so it can highlight the active
// section via usePathname() (startsWith match), mirroring how other nav
// components mark the current route. Bootstrap list-group styling — no Tailwind.
// 08-02/03/04 build the actual /admin/products, /admin/stock, /admin/orders
// section pages this points at.
const NAV_ITEMS = [
  { href: "/admin/products", label: "Products", icon: "ph-package" },
  { href: "/admin/stock", label: "Stock", icon: "ph-stack" },
  { href: "/admin/orders", label: "Orders", icon: "ph-receipt" },
];

const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav className='admin-nav border border-gray-100 rounded-16 p-16'>
      <h6 className='text-md mb-16'>Admin</h6>
      <ul className='list-group list-group-flush'>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <li key={href} className='list-group-item border-0 px-0 py-4'>
              <Link
                href={href}
                className={`flex-align gap-8 py-12 px-16 rounded-8 fw-medium hover-text-main-600 hover-bg-main-50 ${
                  active
                    ? "bg-main-600 text-white"
                    : "text-gray-700"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <i className={`ph ${icon}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default AdminNav;
