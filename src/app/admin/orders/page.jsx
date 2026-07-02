import Link from "next/link";
import { getAllOrders } from "@/lib/admin/orders";
import { formatPrice, formatOrderDate } from "@/lib/format";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";

export const metadata = {
  title: "Orders - Admin - Hot Rod Rigs",
};

/**
 * Admin order list (ADM-04). Section content only — the /admin layout already
 * supplies the gate + chrome. Renders EVERY order (getAllOrders, most recent
 * first via the query) with number/date/total/status; each order number deep-links
 * to the detail route (the leading "#" is percent-encoded so the link navigates).
 */
const AdminOrdersPage = async () => {
  const orders = await getAllOrders();

  return (
    <div className='border border-gray-100 rounded-16 px-24 py-24'>
      <h4 className='mb-24 text-gray-900'>Orders</h4>

      <div className='table-responsive'>
        <table className='table align-middle mb-0'>
          <thead>
            <tr>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Order number
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Date
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Total
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4} className='text-center text-gray-500 py-40'>
                  No orders yet
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const href = `/admin/orders/${encodeURIComponent(
                  o.order_number
                )}`;
                return (
                  <tr key={o.order_number}>
                    <td>
                      <Link
                        href={href}
                        className='text-main-600 fw-semibold text-decoration-none'
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className='text-gray-700'>
                      {formatOrderDate(o.created_at)}
                    </td>
                    <td className='text-gray-900 fw-semibold'>
                      {formatPrice(o.total)}
                    </td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOrdersPage;
