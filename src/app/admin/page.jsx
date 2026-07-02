import Link from "next/link";

// /admin dashboard landing. No gate needed here — the parent admin layout
// already awaited requireAdmin() and gates the whole subtree. This is a simple
// Server Component giving the operator an obvious entry point into each admin
// section. These are placeholder links; 08-02/03/04 build the real pages.
const SECTIONS = [
  {
    href: "/admin/products",
    title: "Products",
    icon: "ph-package",
    description: "Browse and edit the catalog.",
  },
  {
    href: "/admin/stock",
    title: "Stock",
    icon: "ph-stack",
    description: "Adjust inventory levels.",
  },
  {
    href: "/admin/orders",
    title: "Orders",
    icon: "ph-receipt",
    description: "Review and fulfill orders.",
  },
];

const AdminDashboardPage = () => {
  return (
    <div>
      <h4 className='mb-8'>Admin dashboard</h4>
      <p className='text-gray-500 mb-32'>
        Manage the catalog, inventory, and orders for Hot Rod Rigs.
      </p>

      <div className='row gy-4'>
        {SECTIONS.map(({ href, title, icon, description }) => (
          <div key={href} className='col-md-4'>
            <Link
              href={href}
              className='d-block h-100 border border-gray-100 rounded-16 px-24 py-32 hover-border-main-600 text-gray-900'
            >
              <span className='w-56 h-56 flex-center rounded-circle bg-main-50 text-main-600 text-2xl mb-16'>
                <i className={`ph ${icon}`} />
              </span>
              <h6 className='text-lg mb-8'>{title}</h6>
              <p className='text-gray-500 mb-0 text-sm'>{description}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
