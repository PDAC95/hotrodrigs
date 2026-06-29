"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Sort selector (client island, SRCH/BRWS).
 *
 * A native <select> "Ordenar por" that pushes ?sort= to the URL preserving all
 * other params. The server page re-queries with the new sort — no client-side
 * list reordering. Resets page to 1 on any sort change.
 *
 * The default option label adapts to the page: "relevance" on /search (FTS rank)
 * vs "featured" on a PLP — driven by the `defaultSort` prop. Both map to the same
 * "best match first" intent and the data layer accepts either.
 */
const SortSelect = ({ defaultSort = "relevance" }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("sort") ?? defaultSort;

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== defaultSort) {
        params.set("sort", value);
      } else {
        params.delete("sort");
      }
      // Any sort change invalidates the current page window.
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams, defaultSort]
  );

  const firstLabel =
    defaultSort === "relevance" ? "Más relevante" : "Destacados";

  return (
    <div className='position-relative text-gray-500 flex-align gap-8 text-14'>
      <label htmlFor='sorting' className='text-inherit flex-shrink-0'>
        Ordenar por:
      </label>
      <select
        value={current}
        onChange={handleChange}
        className='form-control common-input px-14 py-14 text-inherit rounded-6 w-auto'
        id='sorting'
      >
        <option value={defaultSort}>{firstLabel}</option>
        <option value='price_asc'>Precio: menor a mayor</option>
        <option value='price_desc'>Precio: mayor a menor</option>
        <option value='name'>Nombre A-Z</option>
      </select>
    </div>
  );
};

export default SortSelect;
