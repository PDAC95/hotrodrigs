import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";

// Shared page size for every catalog listing (numbered pagination, BRWS-02/06).
export const PAGE_SIZE = 24;

// Group flat category rows into the L1 -> L2 tree shape shared by both fetchers.
function buildTree(data) {
  const l1 = [];
  const childrenByParent = new Map();
  for (const row of data) {
    if (row.parent_id === null) {
      l1.push({ ...row, children: [] });
    } else {
      const arr = childrenByParent.get(row.parent_id) ?? [];
      arr.push(row);
      childrenByParent.set(row.parent_id, arr);
    }
  }
  for (const section of l1) {
    section.children = childrenByParent.get(section.id) ?? [];
  }
  return l1;
}

/**
 * Full L1 -> L2 category tree for the mega-menu (BRWS-01).
 * One query (147 rows); grouped in JS. parent_id null = L1 section, else L2 child.
 * Returns: [{ id, name, slug, sort_order, children: [{ id, name, slug, sort_order }] }]
 */
export async function getCategoryTree() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order")
    .order("sort_order");
  if (error) throw error;
  return buildTree(data);
}

/**
 * Cookie-less variant of getCategoryTree for the root not-found page.
 * The cookie-aware client calls next/headers cookies() — a Dynamic API — and a
 * root not-found using Dynamic APIs opts EVERY route out of static rendering
 * (the ○ pages in the route table all flip to ƒ). Categories are public-read
 * under RLS, so a bare anon client needs no cookies. Never throws: a 404 page
 * must render even if the catalog read fails (HeaderTwo degrades gracefully
 * on an empty tree).
 */
export async function getCategoryTreeStatic() {
  try {
    const supabase = createBareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order")
      .order("sort_order");
    if (error) return [];
    return buildTree(data);
  } catch {
    return [];
  }
}

/**
 * Single category by slug (+ its parent for the breadcrumb). Returns null if missing.
 * Returns: { id, name, slug, parent_id, sort_order, parent: {id,name,slug}|null }
 */
export async function getCategoryBySlug(slug) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let parent = null;
  if (data.parent_id !== null) {
    const { data: p, error: pErr } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("id", data.parent_id)
      .maybeSingle();
    if (pErr) throw pErr;
    parent = p ?? null;
  }
  return { ...data, parent };
}

/**
 * Breadcrumb trail (L1 -> L2) from a category row produced by getCategoryBySlug.
 * Returns: [{ name, slug }] — one entry for an L1, two for an L2.
 */
export function getBreadcrumb(category) {
  if (!category) return [];
  const trail = [];
  if (category.parent) {
    trail.push({ name: category.parent.name, slug: category.parent.slug });
  }
  trail.push({ name: category.name, slug: category.slug });
  return trail;
}
