"use server";

// Admin catalog authoring data layer (ADM-02).
//
// Reads + create/update server actions for products and their variants. All
// writes go through the RLS admin-cookie client (createClient), gated by the
// Phase 1 `products_admin_write` / `product_variants_admin_write` policies —
// which apply because the operator's JWT carries `user_role='admin'`. We NEVER
// use the service-role client here: RLS is the real write-gate.
//
// Because the storefront lists PARENTS off denormalized aggregates
// (price_min/price_max/in_stock/cover_image_url, Phase 3), every create/edit
// MUST refresh those aggregates for the affected product so it actually
// appears/sorts on the storefront. See refreshAggregates() below — it mirrors
// backfills 5a/5b in 20260629000000_storefront_read.sql, per-parent in JS.
//
// "use server" requires every EXPORT to be async; pure helpers stay
// non-exported module-local functions.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isOrderable } from "@/lib/catalog/availability";

// --------------------------------------------------------------------------
// Helpers (module-local — not exported, so they may be sync).
// --------------------------------------------------------------------------

// Base slug: lowercase, trim, spaces -> '-', strip anything not [a-z0-9-],
// collapse repeated dashes, trim leading/trailing dashes. Uniqueness is
// enforced by the DB unique constraint; createProduct retries with a suffix.
function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Recompute the denormalized parent aggregates for ONE product from its
// PUBLISHED variants and write them back to the products row:
//   price_min/price_max = min/max(price) over published variants (null if none)
//   in_stock            = a published ORDERABLE variant exists (stock IS NULL
//                         = untracked/orderable, or tracked stock > 0)
// Mirrors 5a/5b in 20260629000000_storefront_read.sql. cover_image_url is left
// as-is (no image editing in this plan).
async function refreshAggregates(supabase, productId) {
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("price, stock, published")
    .eq("product_id", productId);
  if (error) throw error;

  const published = (variants ?? []).filter((v) => v.published === true);
  const prices = published
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n));

  const price_min = prices.length ? Math.min(...prices) : null;
  const price_max = prices.length ? Math.max(...prices) : null;
  const in_stock = published.some((v) => isOrderable(v.stock));

  const { error: upErr } = await supabase
    .from("products")
    .update({ price_min, price_max, in_stock })
    .eq("id", productId);
  if (upErr) throw upErr;
}

// Parse the array-named variant rows the form posts (VariantRows renders each
// field as an array so we can getAll them). Returns aligned row objects.
function parseVariantRows(formData) {
  const ids = formData.getAll("variant_id");
  const skus = formData.getAll("variant_sku");
  const sizes = formData.getAll("variant_size");
  const packs = formData.getAll("variant_pack");
  const prices = formData.getAll("variant_price");
  const stocks = formData.getAll("variant_stock");

  const rows = [];
  const len = Math.max(
    ids.length,
    skus.length,
    sizes.length,
    packs.length,
    prices.length,
    stocks.length
  );
  for (let i = 0; i < len; i++) {
    rows.push({
      id: ids[i] != null ? String(ids[i]).trim() : "",
      sku: skus[i] != null ? String(skus[i]).trim() : "",
      size: sizes[i] != null ? String(sizes[i]).trim() : "",
      pack: packs[i] != null ? String(packs[i]).trim() : "",
      price: prices[i],
      stock: stocks[i],
    });
  }
  return rows;
}

// A row is "meaningful" (worth writing) when it carries a non-empty sku.
function hasSku(row) {
  return row.sku !== "";
}

// Normalize a posted price to a number >= 0, or null when invalid.
function normalizePrice(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// Normalize a posted stock: empty = untracked (NULL); numeric = tracked count.
// Invalid non-empty input also falls back to NULL — never 0 (an accidental 0
// is a dead product).
function normalizeStock(raw) {
  if (raw == null || String(raw).trim() === "") return null; // untracked/orderable
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

// Postgres unique-violation code.
const UNIQUE_VIOLATION = "23505";

// --------------------------------------------------------------------------
// Reads.
// --------------------------------------------------------------------------

// Products list for the admin, scoped by an optional name/slug ilike search.
// NEVER lists the whole ~10k catalog unbounded — an empty query still caps at
// `limit`. Returns [] on no rows.
export async function listAdminProducts({ q = "", limit = 50 } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, slug, price_min, price_max, in_stock")
    .order("id", { ascending: true })
    .limit(limit);

  const term = String(q ?? "").trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// One product + its variants for the edit form. null when missing.
export async function getAdminProduct(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const variants = [...(data.product_variants ?? [])].sort((a, b) => a.id - b.id);
  return { ...data, product_variants: variants };
}

// --------------------------------------------------------------------------
// Mutations.
// --------------------------------------------------------------------------

// Insert the product row, generating a unique slug. On a slug unique-violation
// retry with a numeric suffix (-2, -3, ...). Returns the new id.
async function insertProductWithUniqueSlug(supabase, fields) {
  const base = slugify(fields.name) || "product";
  // Try the base slug, then base-2, base-3, ... a handful of times.
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("products")
      .insert({ ...fields, slug })
      .select("id")
      .single();

    if (!error) return { id: data.id };
    // Only retry on a slug collision; surface anything else.
    if (error.code === UNIQUE_VIOLATION && /slug/i.test(error.message ?? "")) {
      continue;
    }
    throw error;
  }
  // Exhausted the simple retries — fall back to a timestamp suffix.
  const slug = `${base}-${Date.now()}`;
  const { data, error } = await supabase
    .from("products")
    .insert({ ...fields, slug })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

// Create action: new product + at least one published variant, then refresh
// aggregates so the storefront lists it. Returns { ok, id } | { ok:false, error }.
export async function createProduct(formData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "name_required" };

  const description = String(formData.get("description") ?? "").trim() || null;
  const oem_number = String(formData.get("oem_number") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category_id") ?? "").trim();
  const category_id = categoryRaw ? Number(categoryRaw) : null;
  const prop65_warning = formData.get("prop65_warning") != null;

  // At least ONE row with a non-empty sku AND a valid price >= 0.
  const rows = parseVariantRows(formData).filter(hasSku);
  const writable = rows
    .map((r) => ({ ...r, priceNum: normalizePrice(r.price) }))
    .filter((r) => r.priceNum !== null);
  if (writable.length === 0) return { ok: false, error: "variant_required" };

  const { id: newId } = await insertProductWithUniqueSlug(supabase, {
    name,
    description,
    oem_number,
    category_id: Number.isFinite(category_id) ? category_id : null,
    prop65_warning,
  });

  const variantInserts = writable.map((r) => ({
    product_id: newId,
    sku: r.sku,
    size: r.size || null,
    pack: r.pack || null,
    price: r.priceNum,
    stock: normalizeStock(r.stock),
    published: true,
  }));

  const { error: vErr } = await supabase
    .from("product_variants")
    .insert(variantInserts);
  if (vErr) {
    if (vErr.code === UNIQUE_VIOLATION) return { ok: false, error: "duplicate_sku" };
    throw vErr;
  }

  await refreshAggregates(supabase, newId);
  revalidatePath("/admin/products");
  return { ok: true, id: newId };
}

// Update action: edit product scalar fields, update existing variants, and add
// new ones. Slug stays stable (don't churn URLs). Refreshes aggregates.
// deleting variants is out of scope for v1.1 — editing + adding covers ADM-02.
export async function updateProduct(formData) {
  const supabase = await createClient();

  const id = Number(formData.get("product_id"));
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "invalid_id" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "name_required" };

  const description = String(formData.get("description") ?? "").trim() || null;
  const oem_number = String(formData.get("oem_number") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category_id") ?? "").trim();
  const category_id = categoryRaw ? Number(categoryRaw) : null;
  const prop65_warning = formData.get("prop65_warning") != null;

  // Update scalar product fields (slug left unchanged on purpose).
  const { error: pErr } = await supabase
    .from("products")
    .update({
      name,
      description,
      oem_number,
      category_id: Number.isFinite(category_id) ? category_id : null,
      prop65_warning,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (pErr) throw pErr;

  const rows = parseVariantRows(formData).filter(hasSku);

  // Partition into existing (has variant_id) vs new (blank id).
  for (const r of rows) {
    const priceNum = normalizePrice(r.price);
    if (priceNum === null) continue; // skip rows with an invalid price

    if (r.id) {
      // Update an existing variant's editable fields.
      const { error } = await supabase
        .from("product_variants")
        .update({
          size: r.size || null,
          pack: r.pack || null,
          price: priceNum,
          stock: normalizeStock(r.stock),
          updated_at: new Date().toISOString(),
        })
        .eq("id", Number(r.id))
        .eq("product_id", id);
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { ok: false, error: "duplicate_sku" };
        throw error;
      }
    } else {
      // Insert a brand-new published variant.
      const { error } = await supabase.from("product_variants").insert({
        product_id: id,
        sku: r.sku,
        size: r.size || null,
        pack: r.pack || null,
        price: priceNum,
        stock: normalizeStock(r.stock),
        published: true,
      });
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { ok: false, error: "duplicate_sku" };
        throw error;
      }
    }
  }

  await refreshAggregates(supabase, id);
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, id };
}
