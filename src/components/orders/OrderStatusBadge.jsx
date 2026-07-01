import React from "react";
import { orderStatusMeta } from "@/lib/orders/status";

/**
 * OrderStatusBadge — a colored pill showing the friendly order status label.
 *
 * Presentational (no "use client" needed): pure props render. Reads the
 * { label, tone } from orderStatusMeta so the raw DB enum is never shown, and
 * picks scannable Bootstrap utility colors by tone.
 *
 * @param {{ status?: string }} props
 */

const TONE_CLASSES = {
  processing: "bg-warning-50 text-warning-600",
  fulfilled: "bg-success-50 text-success-600",
  refunded: "bg-danger-50 text-danger-600",
};

const OrderStatusBadge = ({ status }) => {
  const { label, tone } = orderStatusMeta(status);
  const toneClass = TONE_CLASSES[tone] ?? TONE_CLASSES.processing;

  return (
    <span
      className={`px-16 py-4 rounded-pill fw-medium text-sm d-inline-block ${toneClass}`}
    >
      {label}
    </span>
  );
};

export default OrderStatusBadge;
