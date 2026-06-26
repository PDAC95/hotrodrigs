/**
 * FK-safe, batched, idempotent catalog loader — Phase 02, Plan 03, Task 2.
 *
 * The real DB write of the ETL. Consumes the Plan 02 merged rows + the Plan 03
 * `validateAll` output + parsed fitment, and upserts the whole catalog into
 * Supabase via the SERVICE-ROLE admin client, in FK-safe order:
 *
 *   categories -> truck_makes -> truck_models -> products
 *              -> product_variants -> product_images -> product_truck_compat
 *
 * Idempotency (CAT-05) is structural: every write is `upsert` on a stable
 * natural key (slug / item_no / name / composite), so re-runs update in place
 * and never double rows. Quarantine (CAT-06/07) rides on the `published` flag
 * from validate.mjs. Parent integrity (CAT-03) is asserted: every variant
 * resolves to a parent product or is reported as an orphan (never inserted with
 * a null FK).
 *
 * Admin client: `src/lib/supabase/admin.js` imports `"server-only"`, which THROWS
 * under plain node ("This module cannot be imported from a Client Component").
 * So this module builds the service-role client INLINE from process.env — see
 * `createOfflineAdminClient`. It must NEVER be imported by `src/app` (service-role
 * leak gate `npm run check:leak`).
 */
import { createClient } from "@supabase/supabase-js";

// Parents with zero images still publish — attach this placeholder so the
// storefront never renders a broken <img> and the row stays live (CONTEXT).
export const PLACEHOLDER_IMAGE_URL = "/assets/images/placeholder-product.png";

const BATCH_SIZE = 500;

/**
 * Build a service-role Supabase client for OFFLINE scripts (no `server-only`
 * guard). Run the ETL with `node --env-file=.env.local ...` so these vars load.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createOfflineAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createOfflineAdminClient: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing " +
        "(run with `node --env-file=.env.local ...`)."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Derive a URL-safe slug from a name (lower, ASCII, hyphenated).
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/**
 * Stable product slug derived from BOTH parent name and parent id, so the same
 * parent always maps to the same row across re-runs even if two parents share a
 * name. e.g. slugify("Brake Pads")+"-"+"12345" -> "brake-pads-12345".
 * @param {{parent_id:string,parent_name:string|null}} param0
 * @returns {string}
 */
export function productSlug({ parent_id, parent_name }) {
  const base = slugify(parent_name) || "product";
  return `${base}-${parent_id}`;
}

/**
 * Upsert `rows` into `table` in batches of `size`, conflicting on `onConflict`.
 * Throws with a located message on the first failing batch. Mutating call.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} table
 * @param {Array<Object>} rows
 * @param {string} onConflict - comma-separated natural-key columns (all UNIQUE).
 * @param {number} [size=500]
 * @returns {Promise<number>} number of rows sent.
 */
export async function upsertInBatches(admin, table, rows, onConflict, size = BATCH_SIZE) {
  if (!rows || rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await admin
      .from(table)
      .upsert(slice, { onConflict, defaultToNull: false });
    if (error) {
      throw new Error(`${table} upsert @${i}: ${error.message}`);
    }
  }
  return rows.length;
}

/** Re-query a whole table's natural-key -> id map (Pattern 6). Paginates. */
async function fetchIdMap(admin, table, columns, keyFn) {
  const map = new Map();
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .range(from, from + page - 1);
    if (error) throw new Error(`${table} id-map select @${from}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) map.set(keyFn(r), r.id);
    if (data.length < page) break;
    from += page;
  }
  return map;
}

/**
 * Orchestrate the full FK-safe catalog load.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{
 *   merged: Array<Object>,                              // Plan 02 mergeRows output
 *   validated: { rows: Array<Object>, summary: Object },// Plan 03 validateAll output
 *   fitmentByParent: Map<string, { fitsAll:boolean, relations:Array<{make:string,model:string}>, rawBackup:string|null }>,
 *   dryRun?: boolean                                    // short-circuit ALL writes
 * }} input
 * @returns {Promise<Object>} loadStats for the Plan 04 reconciliation report.
 */
export async function loadCatalog(admin, { merged, validated, fitmentByParent, dryRun = false }) {
  const validatedRows = validated?.rows ?? merged;
  // item_no -> validated row (carries published + quarantine_reasons).
  const vByItem = new Map(validatedRows.map((r) => [r.item_no, r]));

  const loadStats = {
    dryRun,
    counts: {
      categories: 0,
      truck_makes: 0,
      truck_models: 0,
      products: 0,
      product_variants: 0,
      product_images: 0,
      product_truck_compat: 0,
    },
    distinctCategoryPairs: 0,
    orphanVariants: [],
    parentsWithoutCategory: [],
    quarantine: validated?.summary ?? null,
    imageStrategy: "delete-then-insert per touched parent",
    placeholdersUsed: 0,
  };

  // ---- helper: dry-run aware upsert ----
  const doUpsert = async (table, rows, onConflict) => {
    loadStats.counts[table] += rows.length;
    if (dryRun || rows.length === 0) return;
    await upsertInBatches(admin, table, rows, onConflict);
  };

  // ===========================================================================
  // 1. CATEGORIES — build the (L1 -> L2) tree from distinct pairs.
  // ===========================================================================
  const l1Names = new Set();
  const l2Pairs = new Map(); // l2-slug -> { name, parentL1 }
  const pairKeys = new Set(); // distinct (L1,L2) pairs for the report
  for (const r of merged) {
    const l1 = r.section_l1;
    if (l1) l1Names.add(l1);
    if (l1 && r.subcategory_l2) {
      pairKeys.add(`${l1}|||${r.subcategory_l2}`);
    }
  }
  loadStats.distinctCategoryPairs = pairKeys.size;

  // L1 nodes first (parent_id null).
  const l1Rows = [...l1Names].map((name) => ({
    name,
    slug: slugify(name),
    parent_id: null,
  }));
  await doUpsert("categories", l1Rows, "slug");

  // Map L1 slug -> id (skip the re-query in dry-run; ids unknown offline).
  const catIdBySlug = dryRun
    ? new Map()
    : await fetchIdMap(admin, "categories", "id, slug", (r) => r.slug);

  // L2 nodes (parent_id = its L1 id). Slug is L1+L2 to stay globally unique.
  const l2RowsSet = new Map();
  for (const key of pairKeys) {
    const [l1, l2] = key.split("|||");
    const slug = `${slugify(l1)}-${slugify(l2)}`;
    if (!l2RowsSet.has(slug)) {
      l2RowsSet.set(slug, {
        name: l2,
        slug,
        parent_id: dryRun ? null : catIdBySlug.get(slugify(l1)) ?? null,
      });
    }
  }
  await doUpsert("categories", [...l2RowsSet.values()], "slug");

  // Final category map: (l1|||l2) -> categoryId (L2), with L1-only fallback.
  let categoryIdByPair = new Map();
  let categoryIdByL1 = new Map();
  if (!dryRun) {
    const allCats = await fetchIdMap(admin, "categories", "id, slug", (r) => r.slug);
    for (const slug of l1Names) {
      const s = slugify(slug);
      if (allCats.has(s)) categoryIdByL1.set(slug, allCats.get(s));
    }
    for (const key of pairKeys) {
      const [l1, l2] = key.split("|||");
      const s = `${slugify(l1)}-${slugify(l2)}`;
      if (allCats.has(s)) categoryIdByPair.set(key, allCats.get(s));
    }
  }

  // resolve a merged row -> category id (L2 preferred, L1 fallback, else null).
  const resolveCategoryId = (r) => {
    if (dryRun) return null;
    if (r.section_l1 && r.subcategory_l2) {
      const id = categoryIdByPair.get(`${r.section_l1}|||${r.subcategory_l2}`);
      if (id != null) return id;
    }
    if (r.section_l1) return categoryIdByL1.get(r.section_l1) ?? null;
    return null;
  };

  // ===========================================================================
  // 2. TRUCK_MAKES — distinct canonical makes across all fitment relations.
  // ===========================================================================
  const makeNames = new Set();
  const modelPairs = new Set(); // "make|||model"
  for (const f of fitmentByParent.values()) {
    for (const rel of f.relations) {
      if (rel.make) makeNames.add(rel.make);
      if (rel.make && rel.model) modelPairs.add(`${rel.make}|||${rel.model}`);
    }
  }
  const makeRows = [...makeNames].map((name) => ({ name }));
  await doUpsert("truck_makes", makeRows, "name");

  const makeIdByName = dryRun
    ? new Map()
    : await fetchIdMap(admin, "truck_makes", "id, name", (r) => r.name);

  // ===========================================================================
  // 3. TRUCK_MODELS — distinct (make, model) -> rows carrying make_id.
  // ===========================================================================
  const modelRows = [];
  for (const key of modelPairs) {
    const [make, model] = key.split("|||");
    const makeId = dryRun ? null : makeIdByName.get(make) ?? null;
    if (!dryRun && makeId == null) continue; // unknown make -> skip (reported via ambiguous upstream)
    modelRows.push({ make_id: makeId, name: model });
  }
  await doUpsert("truck_models", modelRows, "make_id,name");

  // model id keyed by "make|||model" (re-query joins make_id back to make name).
  let modelIdByPair = new Map();
  if (!dryRun) {
    const idByMakeName = new Map(); // make_id -> make name
    for (const [name, id] of makeIdByName) idByMakeName.set(id, name);
    const page = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("truck_models")
        .select("id, make_id, name")
        .range(from, from + page - 1);
      if (error) throw new Error(`truck_models id-map @${from}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const makeName = idByMakeName.get(r.make_id);
        if (makeName) modelIdByPair.set(`${makeName}|||${r.name}`, r.id);
      }
      if (data.length < page) break;
      from += page;
    }
  }

  // ===========================================================================
  // 4. PRODUCTS — ONE per distinct parent_id; stable slug from parent_id.
  // ===========================================================================
  // Group variants by parent; pick a representative for parent-level fields.
  const variantsByParent = new Map(); // parent_id -> [merged rows]
  for (const r of merged) {
    if (r.parent_id == null) continue;
    if (!variantsByParent.has(r.parent_id)) variantsByParent.set(r.parent_id, []);
    variantsByParent.get(r.parent_id).push(r);
  }

  const productRows = [];
  const slugByParent = new Map(); // parent_id -> slug (for variant FK resolution)
  for (const [parentId, rows] of variantsByParent) {
    const rep = rows[0];
    const slug = productSlug({ parent_id: parentId, parent_name: rep.parent_name });
    slugByParent.set(parentId, slug);
    // products.name is NOT NULL. A handful of parents have no Parent Name in the
    // source (2 of 10,263 today). Fall back to their most-specific category, then
    // L1, then the parent_id — so they still load and render a meaningful title.
    const productName =
      rep.parent_name ?? rep.subcategory_l2 ?? rep.section_l1 ?? `Product ${parentId}`;
    // first variant with a non-null OEM / prop65 is the representative
    const oem = rows.find((x) => x.oem_number != null)?.oem_number ?? null;
    const prop65 = rows.some((x) => x.prop65 === true);
    const fit = fitmentByParent.get(parentId) ?? null;
    productRows.push({
      category_id: resolveCategoryId(rep),
      name: productName,
      slug,
      description: rep.description ?? null,
      oem_number: oem,
      prop65_warning: prop65,
      fits_all: fit?.fitsAll ?? false,
      raw_fitment: fit?.rawBackup ?? null,
    });
    if (resolveCategoryId(rep) == null && !dryRun) {
      loadStats.parentsWithoutCategory.push(parentId);
    }
  }
  await doUpsert("products", productRows, "slug");

  // parent_id -> productId (re-query by slug, then map back through slugByParent).
  let productIdByParent = new Map();
  if (!dryRun) {
    const idBySlug = await fetchIdMap(admin, "products", "id, slug", (r) => r.slug);
    for (const [parentId, slug] of slugByParent) {
      const id = idBySlug.get(slug);
      if (id != null) productIdByParent.set(parentId, id);
    }
    // CAT-03 parent integrity: every parent must map.
    for (const parentId of variantsByParent.keys()) {
      if (!productIdByParent.has(parentId)) {
        throw new Error(`parent integrity (CAT-03): parent_id ${parentId} did not map to a product`);
      }
    }
  }

  // ===========================================================================
  // 5. PRODUCT_VARIANTS — ONE per item_no; product_id from the parent map.
  // ===========================================================================
  const variantRows = [];
  for (const r of merged) {
    const v = vByItem.get(r.item_no) ?? r;
    const productId = dryRun ? null : productIdByParent.get(r.parent_id) ?? null;
    if (!dryRun && productId == null) {
      // orphan: variant whose parent did not resolve -> report, never insert null FK.
      loadStats.orphanVariants.push(r.item_no);
      continue;
    }
    variantRows.push({
      product_id: productId,
      sku: r.item_no,
      item_no: r.item_no,
      size: r.size ?? null,
      pack: r.pack ?? null,
      price: r.price ?? null,
      stock: 0,
      weight: r.weight ?? null,
      length: r.length ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      ltl_flag: r.ltl_flag ?? false,
      ship_type: r.ship_type ?? null,
      oversized: r.oversized ?? false,
      description: r.description ?? null,
      published: v.published ?? true,
    });
  }
  await doUpsert("product_variants", variantRows, "item_no");

  // ===========================================================================
  // 6. PRODUCT_IMAGES — per parent, deduped gallery; placeholder when empty.
  //    Idempotency (Pitfall 4): delete-then-insert per touched parent.
  // ===========================================================================
  const imageRows = [];
  for (const [parentId, rows] of variantsByParent) {
    const productId = dryRun ? null : productIdByParent.get(parentId);
    const seen = new Set();
    const urls = [];
    for (const r of rows) {
      for (const url of r.images ?? []) {
        if (url && !seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      }
    }
    if (urls.length === 0) {
      urls.push(PLACEHOLDER_IMAGE_URL);
      loadStats.placeholdersUsed++;
    }
    urls.forEach((url, idx) => {
      imageRows.push({
        product_id: productId,
        url,
        alt: rows[0].parent_name ?? null,
        sort_order: idx,
      });
    });
  }

  if (!dryRun) {
    // delete-then-insert: clear galleries for the touched parents first.
    const touchedIds = [...variantsByParent.keys()]
      .map((p) => productIdByParent.get(p))
      .filter((id) => id != null);
    for (let i = 0; i < touchedIds.length; i += BATCH_SIZE) {
      const slice = touchedIds.slice(i, i + BATCH_SIZE);
      const { error } = await admin.from("product_images").delete().in("product_id", slice);
      if (error) throw new Error(`product_images delete @${i}: ${error.message}`);
    }
  }
  // Insert via upsert on the unique key as a belt-and-suspenders idempotency guard.
  await doUpsert("product_images", imageRows, "product_id,url");

  // ===========================================================================
  // 7. PRODUCT_TRUCK_COMPAT — per parent, fitment relations with a model.
  // ===========================================================================
  const compatRows = [];
  const compatSeen = new Set();
  for (const [parentId, f] of fitmentByParent) {
    const productId = dryRun ? null : productIdByParent.get(parentId);
    if (!dryRun && productId == null) continue;
    for (const rel of f.relations) {
      if (!rel.model) continue; // make-only / fits_all -> no compat row (Plan 02)
      const modelId = dryRun ? null : modelIdByPair.get(`${rel.make}|||${rel.model}`) ?? null;
      if (!dryRun && modelId == null) continue;
      const dedupeKey = `${productId}|||${modelId}`;
      if (!dryRun && compatSeen.has(dedupeKey)) continue;
      compatSeen.add(dedupeKey);
      compatRows.push({ product_id: productId, truck_model_id: modelId });
    }
  }
  await doUpsert("product_truck_compat", compatRows, "product_id,truck_model_id");

  return loadStats;
}
