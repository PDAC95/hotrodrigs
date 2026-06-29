import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/lib/catalog/categories";

export { PAGE_SIZE };

// Mirror of scripts/etl/lib/load.mjs PLACEHOLDER_IMAGE_URL — products with no image
// row carry a null cover_image_url in the DB; the data layer fills it here so cards
// never branch on null (Pitfall 6).
export const PLACEHOLDER_IMAGE_URL = "/assets/images/placeholder-product.png";

// Apply the saved sort to a parent listing query.
// featured | price_asc | price_desc | name — default "featured" first, id tiebreak.
function applySort(q, sort) {
  switch (sort) {
    case "price_asc":
      return q.order("price_min", { ascending: true, nullsFirst: false }).order("id", { ascending: true });
    case "price_desc":
      return q.order("price_min", { ascending: false, nullsFirst: false }).order("id", { ascending: true });
    case "name":
      return q.order("name", { ascending: true }).order("id", { ascending: true });
    case "featured":
    default:
      return q.order("featured", { ascending: false }).order("id", { ascending: true });
  }
}

function withCover(row) {
  return { ...row, cover_image_url: row.cover_image_url ?? PLACEHOLDER_IMAGE_URL };
}

/**
 * One PAGE of parents in a category, sorted (BRWS-02/06). No N+1: price range, stock,
 * cover image, and featured flag are denormalized on products (Wave-0 migration).
 * Returns: { items: [...], total, page, pageSize }
 */
export async function listProductsByCategory(categoryId, { page = 1, sort = "featured" } = {}) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  let q = supabase
    .from("products")
    .select(
      "id, name, slug, price_min, price_max, in_stock, featured, cover_image_url, fits_all",
      { count: "exact" }
    )
    .eq("category_id", categoryId)
    .range(from, from + PAGE_SIZE - 1);
  q = applySort(q, sort);

  const { data, count, error } = await q;
  if (error) throw error;
  return {
    items: (data ?? []).map(withCover),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Full PDP aggregate for one parent — ONE query, no N+1 (Variant Matrix, BRWS-03/04).
 * Joins all variants, images, and the owning category. Returns null if not found.
 * Images ordered by sort_order; variants by id (stable selector ordering).
 */
export async function getProductBySlug(slug) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, product_variants(*), product_images(*), categories(id, name, slug, parent_id)"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const images = [...(data.product_images ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id
  );
  const variants = [...(data.product_variants ?? [])].sort((a, b) => a.id - b.id);

  return {
    ...data,
    cover_image_url: data.cover_image_url ?? PLACEHOLDER_IMAGE_URL,
    product_images: images,
    product_variants: variants,
  };
}
