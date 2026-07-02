import Link from "next/link";
import { getAdminOrderByNumber } from "@/lib/admin/orders";
import { formatOrderDate } from "@/lib/format";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderReceipt from "@/components/orders/OrderReceipt";
import AdminOrderStatus from "@/components/admin/AdminOrderStatus";

export const metadata = {
  title: "Order detail - Admin - Hot Rod Rigs",
};

/**
 * Admin order detail (ADM-04). Section content only — the /admin layout supplies
 * the gate + chrome. Reads the order NOT owner-scoped (admin RLS), reuses the
 * shared OrderReceipt body (same receipt the customer sees), and adds the editable
 * status control wired to updateOrderStatus.
 *
 * Next 15: params is async; order_number carries a percent-encoded "#" that must
 * be decoded before the lookup.
 */
const AdminOrderDetailPage = async ({ params }) => {
  const { order_number } = await params;
  const orderNumber = decodeURIComponent(order_number);
  const order = await getAdminOrderByNumber(orderNumber);

  if (!order) {
    return (
      <div className='border border-gray-100 rounded-16 px-24 py-80 text-center'>
        <h6 className='text-xl mb-8 text-gray-900'>Order not found</h6>
        <p className='text-gray-500 mb-32'>
          We couldn&apos;t find an order with that number.
        </p>
        <Link href='/admin/orders' className='btn btn-main py-18 px-40 rounded-8'>
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className='flex-between flex-wrap gap-16 mb-32'>
        <div>
          <h4 className='mb-8 text-gray-900'>{order.order_number}</h4>
          <p className='text-gray-500 mb-0'>
            {formatOrderDate(order.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <OrderReceipt order={order} />

      <AdminOrderStatus
        orderNumber={order.order_number}
        currentStatus={order.status}
      />

      <Link
        href='/admin/orders'
        className='text-main-600 fw-semibold text-decoration-none'
      >
        <i className='ph ph-arrow-left me-8' />
        Back to orders
      </Link>
    </div>
  );
};

export default AdminOrderDetailPage;
