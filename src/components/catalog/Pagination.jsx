import Link from "next/link";

// Build a "?page=N" href that preserves every other existing query param
// (sort, filters) so each page is a shareable URL (BRWS-02).
function buildHref(basePath, searchParams, page) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "page" || value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, String(value));
    }
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Compact numbered window around the current page (with first/last anchors).
function pageWindow(current, totalPages) {
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

/**
 * Link-based numbered pagination (server component — no client island).
 * Renders shareable ?page= links preserving existing filters/sort. Prev/next + a
 * windowed run of page numbers with ellipsis gaps. Uses the template's pagination classes.
 */
const Pagination = ({ page, total, pageSize, basePath, searchParams }) => {
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / (pageSize || 1)));
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page || 1), totalPages);
  const windowPages = pageWindow(current, totalPages);

  const items = [];
  let prev = 0;
  for (const p of windowPages) {
    if (p - prev > 1) {
      items.push(
        <li key={`gap-${p}`} className='page-item'>
          <span className='page-link h-44 w-44 flex-center text-md rounded-8 border-0 text-gray-500'>
            …
          </span>
        </li>
      );
    }
    items.push(
      <li key={p} className='page-item'>
        <Link
          href={buildHref(basePath, searchParams, p)}
          className={`page-link h-44 w-44 flex-center text-md rounded-8 border border-gray-100 ${
            p === current
              ? "bg-main-600 text-white border-main-600"
              : "text-neutral-600"
          }`}
          aria-current={p === current ? "page" : undefined}
        >
          {p}
        </Link>
      </li>
    );
    prev = p;
  }

  return (
    <nav aria-label='Pagination' className='mt-48'>
      <ul className='pagination flex-center flex-wrap gap-16'>
        {current > 1 && (
          <li className='page-item'>
            <Link
              href={buildHref(basePath, searchParams, current - 1)}
              className='page-link h-44 w-44 flex-center text-md rounded-8 border border-gray-100 text-neutral-600'
              aria-label='Previous'
            >
              <i className='ph ph-caret-left' />
            </Link>
          </li>
        )}
        {items}
        {current < totalPages && (
          <li className='page-item'>
            <Link
              href={buildHref(basePath, searchParams, current + 1)}
              className='page-link h-44 w-44 flex-center text-md rounded-8 border border-gray-100 text-neutral-600'
              aria-label='Next'
            >
              <i className='ph ph-caret-right' />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Pagination;
