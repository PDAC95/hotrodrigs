import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, PLACEHOLDER_IMAGE_URL } from "@/lib/catalog/products";

export { PAGE_SIZE };

/**
 * THE SWAPPABLE SEARCH SEAM (SRCH-01/02/03/04).
 *
 * All FTS / trigram / fitment logic lives behind this one function so v2 (Meilisearch,
 * DISC-02) can replace it without touching any page. Composes category + text +
 * fitment + price + sort + pagination in ONE indexed round-trip via the
 * public.search_products RPC, which returns one row per parent plus a window `total`.
 *
 * Returns: { items: [...], total, page, pageSize }
 */
export async function searchProducts({
  query = null,
  categoryId = null,
  truckModelId = null,
  priceMin = null,
  priceMax = null,
  sort = "relevance",
  page = 1,
  area = null,
} = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_products", {
    p_query: query,
    p_category_id: categoryId,
    p_truck_model: truckModelId,
    p_price_min: priceMin,
    p_price_max: priceMax,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
    p_area: area,
  });
  if (error) throw error;

  const rows = data ?? [];
  // `total` is a window count repeated on every row; read it off the first row.
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const items = rows.map((r) => ({
    ...r,
    cover_image_url: r.cover_image_url ?? PLACEHOLDER_IMAGE_URL,
  }));

  return { items, total, page, pageSize: PAGE_SIZE };
}
