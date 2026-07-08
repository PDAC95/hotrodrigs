"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOrderable } from "@/lib/catalog/availability";

// Admin stock data layer (ADM-03).
//
// Writes go through the RLS admin-cookie client (createClient) — the admin JWT
// carries the user_role claim, so the Phase 1 `product_variants_admin_write`
// and `products_admin_write` policies (both `for all to authenticated using
// ((select public.is_admin()))`) permit these writes. We NEVER use the
// service-role client here; RLS is the real enforcement.
//
// STOREFRONT-REFRESH RULE: the storefront lists PARENTS using the denormalized
// `products.in_stock` aggregate (Phase 3), NOT live variant stock. So every
// stock mutation MUST recompute the owning product's in_stock as
// `exists(published variant that is orderable: stock IS NULL or > 0)` and write
// it back — otherwise /c/**, /search, and cards keep the stale availability.
// Uses the shared isOrderable predicate (Phase 13 stock semantics: NULL =
// untracked/orderable), done for a single parent in JS.

// Find variants for the management list, scoped by an admin search box.
//
// A large catalog (~10.8k variants) means we NEVER list them all — the search
// box scopes the result set. `q` filters by SKU (the natural admin key) via
// ilike. We join the parent product name/slug so the admin can identify each
// variant. Ordered by id, capped at `limit`.
export async function findVariants({ q = "", limit = 50 } = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("product_variants")
    .select("id, sku, size, pack, stock, published, product_id, products(name, slug)")
    .order("id", { ascending: true })
    .limit(limit);

  const term = (q ?? "").trim();
  if (term) {
    // SKU is the natural admin key — filter by it as the primary search.
    query = query.ilike("sku", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin/stock] findVariants failed:", error.message);
    return [];
  }
  return data ?? [];
}

// Set a variant's stock mode + quantity and refresh the storefront aggregate.
//
// Called as a form action from StockEditor. STOCK-03 semantics: the
// track_inventory checkbox decides tracked vs untracked — untracked writes
// stock NULL (orderable, the stock field is never read); tracked REQUIRES a
// real numeric count (empty field is rejected server-side too, never silently
// saved as 0). Updates product_variants.stock via the RLS cookie client, then
// recomputes and writes products.in_stock for the owning parent so the
// storefront reflects the change.
export async function setVariantStock(formData) {
  const variantId = Number(formData.get("variant_id"));

  // Validate: variantId a positive integer.
  if (!Number.isInteger(variantId) || variantId <= 0) {
    return { ok: false, error: "invalid_input" };
  }

  // Checkbox present in the payload = tracking ON.
  const tracked = formData.get("track_inventory") != null;

  let stock = null; // untracked default — orderable, no count.
  if (tracked) {
    const raw = formData.get("stock");
    // Server re-validation of the empty-field rule: tracking without a real
    // count is invalid — never coerce blank to 0.
    if (raw == null || String(raw).trim() === "") {
      return { ok: false, error: "invalid_input" };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "invalid_input" };
    }
    stock = Math.trunc(n);
  }

  const supabase = await createClient();

  // Update the variant and read back its parent product_id in one call.
  const { data: updated, error } = await supabase
    .from("product_variants")
    .update({ stock })
    .eq("id", variantId)
    .select("id, product_id")
    .maybeSingle();

  if (error || !updated) {
    if (error) console.error("[admin/stock] setVariantStock update failed:", error.message);
    return { ok: false, error: "update_failed" };
  }

  // STOREFRONT-REFRESH: recompute the parent's in_stock from its published
  // variants (a published variant that is orderable exists: stock IS NULL or
  // > 0) and write it back.
  const { data: sib } = await supabase
    .from("product_variants")
    .select("stock")
    .eq("product_id", updated.product_id)
    .eq("published", true);

  const inStock = (sib ?? []).some((v) => isOrderable(v.stock));

  await supabase
    .from("products")
    .update({ in_stock: inStock })
    .eq("id", updated.product_id);

  revalidatePath("/admin/stock");

  return { ok: true, stock };
}
