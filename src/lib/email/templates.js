import "server-only";

import { formatPrice } from "@/lib/format";

/**
 * Transactional email templates — plain-JS HTML string builders (no React
 * Email, no external deps). Email-safe markup only: tables + inline styles,
 * no external CSS/JS/images.
 *
 * Every interpolated free-text value (product names, SKUs, address fields,
 * customer name, buyer email — DB/admin-entered text going into HTML) MUST go
 * through escapeHtml(). Money goes through formatPrice (already plain "$X.XX",
 * safe). Display math only on server-authoritative numbers — never recompute
 * totals here.
 */

/**
 * Escape a value for safe interpolation into HTML.
 * @param {*} value coerced to String
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ACCENT = "#FA6400";

/**
 * Shared email shell: 600px centered table, "Hot Rod Rigs" text-logo header
 * bar on the storefront accent, gray transactional footer.
 * @param {{ title: string, bodyHtml: string }} param0
 * @returns {string} full HTML document
 */
function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-collapse:collapse;">
<tr>
<td style="background-color:${ACCENT};padding:20px 32px;">
<span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Hot Rod Rigs</span>
</td>
</tr>
<tr>
<td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
${bodyHtml}
</td>
</tr>
<tr>
<td style="background-color:#f0f0f0;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#777777;">
Hot Rod Rigs &mdash; Truck Parts &amp; Accessories<br />
This is a transactional message about your order.
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

/**
 * Shipping address block shared by the confirmation and fulfilled templates.
 * @param {{ name?: string, street1?: string, street2?: string, city?: string, state?: string, zip?: string, country?: string }} shipTo
 * @returns {string}
 */
function addressBlockHtml(shipTo) {
  const s = shipTo || {};
  const lines = [
    s.name ? escapeHtml(s.name) : null,
    s.street1 ? escapeHtml(s.street1) : null,
    s.street2 ? escapeHtml(s.street2) : null,
    [s.city, s.state, s.zip].filter(Boolean).map(escapeHtml).join(", ") || null,
    s.country ? escapeHtml(s.country) : null,
  ].filter(Boolean);
  return `<p style="margin:0 0 4px 0;font-weight:bold;">Shipping address</p>
<p style="margin:0;color:#555555;">${lines.join("<br />")}</p>`;
}

/**
 * Order confirmation — full receipt from a pending_orders row.
 * All money values are server-authoritative dollars straight off the row
 * (tax is REAL post-Phase 11); the only display math is quantity * unit_price
 * per line.
 * @param {{ order_number: string, lines: Array<{ name: string, sku: string, quantity: number, unit_price: number }>, subtotal: number, shipping: number, tax: number, total: number, ship_to_snapshot: object }} pending
 * @returns {{ subject: string, html: string }}
 */
export function orderConfirmationEmail(pending) {
  const subject = `Your Hot Rod Rigs order ${pending.order_number}`;

  const itemRows = (pending.lines || [])
    .map(
      (line) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #eeeeee;">
${escapeHtml(line.name)}<br />
<span style="font-size:12px;color:#888888;">SKU: ${escapeHtml(line.sku)}</span>
</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #eeeeee;white-space:nowrap;">${line.quantity} &times; ${formatPrice(line.unit_price)}</td>
<td align="right" style="padding:8px 0 8px 16px;border-bottom:1px solid #eeeeee;white-space:nowrap;">${formatPrice(line.quantity * line.unit_price)}</td>
</tr>`
    )
    .join("\n");

  const totalsRow = (label, value, bold) =>
    `<tr>
<td colspan="2" align="right" style="padding:4px 0;${bold ? "font-weight:bold;" : ""}">${label}</td>
<td align="right" style="padding:4px 0 4px 16px;white-space:nowrap;${bold ? "font-weight:bold;" : ""}">${formatPrice(value)}</td>
</tr>`;

  const bodyHtml = `<h1 style="margin:0 0 16px 0;font-size:20px;color:#222222;">Thanks for your order!</h1>
<p style="margin:0 0 24px 0;">Your order <strong>${escapeHtml(pending.order_number)}</strong> is confirmed. Here is your receipt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;">
${itemRows}
${totalsRow("Subtotal", pending.subtotal)}
${totalsRow("Shipping", pending.shipping)}
${totalsRow("Tax", pending.tax)}
${totalsRow("Total", pending.total, true)}
</table>
<div style="margin-top:24px;">
${addressBlockHtml(pending.ship_to_snapshot)}
</div>`;

  return { subject, html: layout({ title: subject, bodyHtml }) };
}

/**
 * Guest activation — account created at checkout, secure link to set a
 * password. NEVER includes the PaymentIntent client secret or any Stripe
 * identifier (EML-02). The activationUrl is server-constructed and goes in
 * href verbatim.
 * @param {{ email: string, orderNumber: string, activationUrl: string }} param0
 * @returns {{ subject: string, html: string }}
 */
export function guestActivationEmail({ email, orderNumber, activationUrl }) {
  const subject = "Activate your Hot Rod Rigs account";

  const bodyHtml = `<h1 style="margin:0 0 16px 0;font-size:20px;color:#222222;">Your account is ready</h1>
<p style="margin:0 0 24px 0;">We created an account for <strong>${escapeHtml(email)}</strong> so you can track order <strong>${escapeHtml(orderNumber)}</strong>.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr>
<td style="background-color:${ACCENT};border-radius:4px;">
<a href="${activationUrl}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Set your password</a>
</td>
</tr>
</table>
<p style="margin:0 0 24px 0;font-size:12px;color:#888888;">If the button does not work, copy and paste this link into your browser:<br />${escapeHtml(activationUrl)}</p>
<p style="margin:0;color:#555555;">This link expires in 1 hour. If you didn't make this purchase, ignore this email.</p>`;

  return { subject, html: layout({ title: subject, bodyHtml }) };
}

/**
 * Order fulfilled — intentionally LIGHT: no receipt table, no tracking number
 * (EML-06 explicitly deferred).
 * @param {{ orderNumber: string, shipTo: object }} param0
 * @returns {{ subject: string, html: string }}
 */
export function orderFulfilledEmail({ orderNumber, shipTo }) {
  const subject = `Your order ${orderNumber} has shipped`;

  const bodyHtml = `<h1 style="margin:0 0 16px 0;font-size:20px;color:#222222;">Good news &mdash; your order is on its way</h1>
<p style="margin:0 0 24px 0;">Order <strong>${escapeHtml(orderNumber)}</strong> has shipped to:</p>
${addressBlockHtml(shipTo)}`;

  return { subject, html: layout({ title: subject, bodyHtml }) };
}
