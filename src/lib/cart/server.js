import "server-only";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server-authoritative cart data layer (CART-01..04).
 *
 * EVERY function here uses the RLS-enforced cookie client (createClient), NEVER
 * the service-role client — service-role bypasses RLS and would break
 * per-user cart ownership. carts/cart_items RLS is owner-scoped to auth.uid(),
 * so a logged-out caller transparently sees nothing (reads return []/null;
 * mutations require a session and throw).
 *
 * The structural guarantee (CART-04): price, stock, sku, size, pack, name and
 * image are ALWAYS re-derived from product_variants/products on read. The client
 * stores only {variant_id, quantity}; it never supplies a price.
 *
 * Stock cap: quantity is clamped to live stock on every write, and effective_qty
 * is re-min'd against live stock on every read (stock can drop between the two).
 */

// Nested-select shape used by every read path (logged-in + guest).
const VARIANT_SELECT =
  "id, sku, size, pack, price, stock, " +
  "product:products ( id, name, slug, cover_image_url, oem_number )";

/**
 * Map a product_variant row (+ joined product) and a desired quantity into the
 * CartLine shape consumed by Plan 03's UI. Price/availability are taken LIVE
 * from the variant row — never from any client-supplied value.
 */
function toCartLine(variant, quantity) {
  const price = Number(variant.price) || 0;
  const available = Number(variant.stock) || 0;
  const qty = Number(quantity) || 0;
  const effective_qty = Math.max(0, Math.min(qty, available));
  const out_of_stock = available <= 0;
  // products may come back as an array or object depending on the join cardinality.
  const product = Array.isArray(variant.product)
    ? variant.product[0] || null
    : variant.product || null;
  return {
    variant_id: variant.id,
    quantity: qty,
    effective_qty,
    price,
    available,
    out_of_stock,
    capped: effective_qty < qty,
    sku: variant.sku,
    size: variant.size,
    pack: variant.pack,
    product: product
      ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          cover_image_url: product.cover_image_url,
          oem_number: product.oem_number,
        }
      : null,
    line_subtotal: out_of_stock ? 0 : price * effective_qty,
  };
}

/** Read live stock for one variant (0 if missing). */
async function liveStock(supabase, variantId) {
  const { data } = await supabase
    .from("product_variants")
    .select("stock")
    .eq("id", variantId)
    .maybeSingle();
  return Number(data?.stock) || 0;
}

/**
 * Get the current user's cart id, creating it if absent. Returns null when there
 * is no session. Safe under concurrency because carts.user_id is UNIQUE — the
 * upsert with onConflict 'user_id' is idempotent.
 * @returns {Promise<number|null>}
 */
export async function getOrCreateCart() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("carts")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Add (merge) a variant to the logged-in cart. nextQty = existing + qty, capped
 * at live stock. Out-of-stock variants are still allowed onto the cart (CONTEXT:
 * mark, don't block) — the read derives out_of_stock and zeroes the subtotal.
 * @throws if there is no session.
 */
export async function addToCart(variantId, qty = 1) {
  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) throw new Error("Not authenticated");

  const available = await liveStock(supabase, variantId);
  const { data: existing } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId)
    .maybeSingle();

  const desired = (Number(existing?.quantity) || 0) + (Number(qty) || 1);
  // Cap at stock when there IS stock; keep a single unit when out of stock so the
  // line exists and the read can flag it (mark-not-block).
  const nextQty = available > 0 ? Math.min(desired, available) : 1;

  const { error } = await supabase
    .from("cart_items")
    .upsert(
      { cart_id: cartId, variant_id: variantId, quantity: Math.max(nextQty, 1) },
      { onConflict: "cart_id,variant_id" }
    );
  if (error) throw error;
  revalidatePath("/cart");
}

/**
 * Set the absolute quantity for a variant. qty <= 0 removes the row (CONTEXT:
 * qty 0 = remove). Otherwise quantity = min(qty, live stock).
 * @throws if there is no session.
 */
export async function updateCartItem(variantId, qty) {
  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) throw new Error("Not authenticated");

  const next = Math.trunc(Number(qty) || 0);
  if (next <= 0) {
    await removeCartItem(variantId);
    return;
  }

  const available = await liveStock(supabase, variantId);
  const capped = available > 0 ? Math.min(next, available) : 1;
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: capped })
    .eq("cart_id", cartId)
    .eq("variant_id", variantId);
  if (error) throw error;
  revalidatePath("/cart");
}

/**
 * Remove a variant from the logged-in cart.
 * @throws if there is no session.
 */
export async function removeCartItem(variantId) {
  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId)
    .eq("variant_id", variantId);
  if (error) throw error;
  revalidatePath("/cart");
}

/**
 * Read the logged-in cart as fully-derived CartLines. Returns [] when there is
 * no session/cart. Price + availability are LIVE from product_variants.
 * @returns {Promise<object[]>}
 */
export async function getCartLines() {
  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) return [];

  const { data, error } = await supabase
    .from("cart_items")
    .select(`quantity, variant:product_variants ( ${VARIANT_SELECT} )`)
    .eq("cart_id", cartId);
  if (error) throw error;

  return (data || [])
    .map((row) => {
      const variant = Array.isArray(row.variant) ? row.variant[0] : row.variant;
      if (!variant) return null;
      return toCartLine(variant, row.quantity);
    })
    .filter(Boolean);
}

/**
 * Re-derive CartLines for a GUEST cart. Input is the client's
 * [{variant_id, quantity}] (the ONLY thing a guest stores). A single .in(ids)
 * query re-derives price/stock server-side so guests never see a client price.
 * @param {{variant_id:number, quantity:number}[]} guestLines
 * @returns {Promise<object[]>}
 */
export async function getGuestCartLines(guestLines) {
  const lines = Array.isArray(guestLines) ? guestLines : [];
  if (lines.length === 0) return [];

  const qtyById = new Map();
  for (const l of lines) {
    const id = Number(l.variant_id);
    if (!Number.isFinite(id)) continue;
    qtyById.set(id, (qtyById.get(id) || 0) + (Number(l.quantity) || 0));
  }
  const ids = [...qtyById.keys()];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .in("id", ids);
  if (error) throw error;

  return (data || []).map((variant) =>
    toCartLine(variant, qtyById.get(Number(variant.id)) || 0)
  );
}

/**
 * Sum of quantities in the logged-in cart (header badge). 0 when no session/cart.
 * Counts raw quantity (not effective) so the badge reflects what the user added.
 * @returns {Promise<number>}
 */
export async function getCartCount() {
  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) return 0;

  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cartId);
  if (error) throw error;
  return (data || []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
}

/**
 * Fold a guest cart into the logged-in DB cart on login. Additive merge: same
 * variant in both → sum, capped at live stock (CONTEXT). The caller clears
 * localStorage afterward.
 * @param {{variant_id:number, quantity:number}[]} guestLines
 */
export async function mergeGuestCart(guestLines) {
  const lines = Array.isArray(guestLines) ? guestLines : [];
  if (lines.length === 0) return;

  const supabase = await createClient();
  const cartId = await getOrCreateCart();
  if (cartId == null) throw new Error("Not authenticated");

  for (const l of lines) {
    const variantId = Number(l.variant_id);
    const addQty = Number(l.quantity) || 0;
    if (!Number.isFinite(variantId) || addQty <= 0) continue;

    const available = await liveStock(supabase, variantId);
    const { data: existing } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", variantId)
      .maybeSingle();

    const desired = (Number(existing?.quantity) || 0) + addQty;
    const nextQty = available > 0 ? Math.min(desired, available) : 1;

    const { error } = await supabase
      .from("cart_items")
      .upsert(
        { cart_id: cartId, variant_id: variantId, quantity: Math.max(nextQty, 1) },
        { onConflict: "cart_id,variant_id" }
      );
    if (error) throw error;
  }
  revalidatePath("/cart");
}
