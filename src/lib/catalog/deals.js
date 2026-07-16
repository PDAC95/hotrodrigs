import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PLACEHOLDER_IMAGE_URL } from "@/lib/catalog/products";

/**
 * Deal of the Week (display-only highlight, no price override).
 *
 * Returns the ACTIVE deal whose window contains now, preferring the one that
 * ends soonest (lets admin queue next week's deal in advance). Null when no
 * deal is live — the home section hides itself rather than inventing urgency.
 */
export async function getCurrentDeal() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, headline, starts_at, ends_at, product:products(id, name, slug, price_min, price_max, in_stock, cover_image_url)"
    )
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.product) return null;

  return {
    id: data.id,
    headline: data.headline,
    endsAt: data.ends_at,
    product: {
      ...data.product,
      cover_image_url: data.product.cover_image_url ?? PLACEHOLDER_IMAGE_URL,
    },
  };
}
