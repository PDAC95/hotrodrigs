/**
 * Asset/URL slug: lowercase, any non-alphanumeric run becomes a single "-".
 * Shared by the fitment surfaces so image filenames stay deterministic
 * ("Chevrolet & GMC" -> "chevrolet-gmc").
 */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
