import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Shipping-specific cart read. Pulls the product_variants SHIPPING columns that
 * the Phase-4 cart contract (src/lib/cart/server.js VARIANT_SELECT) deliberately
 * omits (weight/dims/ltl_flag/oversized). We read our OWN variant columns here
 * rather than widen the cart contract (Pitfall 1, option b) — cart/server.js is
 * NEVER touched.
 *
 * Uses ONLY the RLS-enforced cookie client (createClient) — never service-role —
 * so carts/cart_items ownership is enforced and the leak gate stays green, exactly
 * as the cart data layer does.
 */

// The shipping columns + stock (for effective_qty) keyed by variant id.
const SHIPPING_VARIANT_SELECT =
  "id, weight, length, width, height, ltl_flag, oversized, stock";

/**
 * Shape one variant row + desired quantity into a shipping line. effective_qty
 * is min(qty, live stock) so parcel weight reflects only what can actually ship.
 */
function toShippingLine(variant, quantity) {
  const qty = Number(quantity) || 0;
  const available = Number(variant.stock) || 0;
  const effective_qty = Math.max(0, Math.min(qty, available));
  return {
    variant_id: variant.id,
    quantity: qty,
    effective_qty,
    weight: Number(variant.weight) || 0,
    length: Number(variant.length) || 0,
    width: Number(variant.width) || 0,
    height: Number(variant.height) || 0,
    ltl_flag: !!variant.ltl_flag,
    oversized: !!variant.oversized,
  };
}

/**
 * Read variant shipping rows for a set of {variant_id, quantity} pairs in ONE
 * .in(ids) query and re-shape them into shipping lines. Shared by the logged-in
 * and guest paths.
 */
async function readShippingLines(pairs) {
  const qtyById = new Map();
  for (const p of pairs) {
    const id = Number(p.variant_id);
    if (!Number.isFinite(id)) continue;
    qtyById.set(id, (qtyById.get(id) || 0) + (Number(p.quantity) || 0));
  }
  const ids = [...qtyById.keys()];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(SHIPPING_VARIANT_SELECT)
    .in("id", ids);
  if (error) throw error;

  return (data || []).map((variant) =>
    toShippingLine(variant, qtyById.get(Number(variant.id)) || 0)
  );
}

/**
 * Logged-in cart shipping lines. Reads the user's cart_items (RLS owner-scoped),
 * then one product_variants .in(ids) read for the shipping columns. Returns []
 * when there is no session/cart.
 * @returns {Promise<object[]>}
 */
export async function getShippingCartLines() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Read the existing cart WITHOUT creating one (read-only path).
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!cart?.id) return [];

  const { data: items, error } = await supabase
    .from("cart_items")
    .select("variant_id, quantity")
    .eq("cart_id", cart.id);
  if (error) throw error;

  return readShippingLines(items || []);
}

/**
 * Guest cart shipping lines. Input is the guest store shape [{variant_id,
 * quantity}]; server re-reads the shipping columns so a guest at checkout can get
 * a quote. Returns [] for an empty/invalid input.
 * @param {{variant_id:number, quantity:number}[]} guestLines
 * @returns {Promise<object[]>}
 */
export async function getShippingCartLinesFromGuest(guestLines) {
  const lines = Array.isArray(guestLines) ? guestLines : [];
  if (lines.length === 0) return [];
  return readShippingLines(lines);
}
