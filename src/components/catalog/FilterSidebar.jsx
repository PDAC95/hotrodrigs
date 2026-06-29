"use client";
import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Faceted filter sidebar (client island, SRCH-01/04 + BRWS).
 *
 * The MarketPro left-column facet stack: category (L1/L2 tree), price (min/max),
 * and the active-truck fitment facet. EVERY facet mutates the URL only — the
 * server page re-queries via search_products so category + price + truck + text
 * compose in ONE indexed call. No client-side list filtering (anti-pattern).
 * Any facet change resets ?page.
 *
 * The truck facet does NOT re-implement the Make->Model persistence (that lives
 * in the global MyTruckSelector). The URL ?truck_model is the source of truth
 * here: the sidebar surfaces the active truck label and a clear button.
 *
 * On mobile the whole stack collapses to a "Filtros" toggle (Bootstrap collapse).
 *
 * Props:
 *   categories   — getCategoryTree(): [{ id, name, slug, children: [...] }]
 *   makes        — getMakes(): [{ id, name }] (reserved; truck selection is the header's job)
 *   activeFilters — the page's resolved searchParams object (sp)
 */
const FilterSidebar = ({ categories = [], activeFilters = {} }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = activeFilters.category
    ? String(activeFilters.category)
    : "";
  const activeTruckModel = activeFilters.truck_model
    ? String(activeFilters.truck_model)
    : "";

  const [priceMin, setPriceMin] = useState(activeFilters.price_min ?? "");
  const [priceMax, setPriceMax] = useState(activeFilters.price_max ?? "");
  const [open, setOpen] = useState(false);

  // Mutate the URL: set/clear params, always reset page, then push.
  const apply = useCallback(
    (mutate) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const setParam = useCallback(
    (key, value) => {
      apply((params) => {
        if (value === null || value === "" || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
    },
    [apply]
  );

  const handleCategory = (id) => {
    // Toggle off if re-clicking the active category.
    setParam("category", String(id) === activeCategory ? "" : id);
  };

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    apply((params) => {
      if (priceMin !== "" && priceMin != null) {
        params.set("price_min", String(priceMin));
      } else {
        params.delete("price_min");
      }
      if (priceMax !== "" && priceMax != null) {
        params.set("price_max", String(priceMax));
      } else {
        params.delete("price_max");
      }
    });
  };

  const clearPrice = () => {
    setPriceMin("");
    setPriceMax("");
    apply((params) => {
      params.delete("price_min");
      params.delete("price_max");
    });
  };

  const clearTruck = () => {
    apply((params) => {
      params.delete("truck_model");
      params.delete("truck_make");
    });
  };

  const renderCategoryItem = (cat, isChild = false) => {
    const selected = String(cat.id) === activeCategory;
    return (
      <li key={cat.id} className={isChild ? "ms-12" : ""}>
        <button
          type='button'
          onClick={() => handleCategory(cat.id)}
          className={`btn p-0 text-start w-100 py-6 ${
            selected
              ? "text-main-600 fw-semibold"
              : "text-gray-600 hover-text-main-600"
          }`}
        >
          {selected ? <i className='ph ph-check me-4' /> : null}
          {cat.name}
        </button>
        {!isChild && cat.children && cat.children.length > 0 ? (
          <ul className='list-unstyled mb-0'>
            {cat.children.map((child) => renderCategoryItem(child, true))}
          </ul>
        ) : null}
      </li>
    );
  };

  const facets = (
    <div className='shop-sidebar'>
      {/* Category facet */}
      <div className='shop-sidebar__box border border-gray-100 rounded-8 p-24 mb-24'>
        <div className='flex-between mb-16'>
          <h6 className='text-lg mb-0'>Categorías</h6>
          {activeCategory ? (
            <button
              type='button'
              onClick={() => setParam("category", "")}
              className='btn btn-sm text-gray-500 hover-text-main-600 p-0 text-sm'
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <ul
          className='list-unstyled mb-0 max-h-300 overflow-auto scroll-sm'
          style={{ maxHeight: 360 }}
        >
          {categories.map((cat) => renderCategoryItem(cat))}
        </ul>
      </div>

      {/* Price facet */}
      <div className='shop-sidebar__box border border-gray-100 rounded-8 p-24 mb-24'>
        <h6 className='text-lg mb-16'>Precio</h6>
        <form onSubmit={handlePriceSubmit} className='flex-align gap-8 mb-12'>
          <input
            type='number'
            min='0'
            step='0.01'
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder='Mín'
            aria-label='Precio mínimo'
            className='form-control common-input py-8 px-12 rounded-6'
          />
          <span className='text-gray-400'>–</span>
          <input
            type='number'
            min='0'
            step='0.01'
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder='Máx'
            aria-label='Precio máximo'
            className='form-control common-input py-8 px-12 rounded-6'
          />
        </form>
        <div className='flex-align gap-8'>
          <button
            type='button'
            onClick={handlePriceSubmit}
            className='btn bg-main-600 text-white hover-bg-main-700 py-8 px-20 rounded-6 text-sm'
          >
            Aplicar
          </button>
          {activeFilters.price_min || activeFilters.price_max ? (
            <button
              type='button'
              onClick={clearPrice}
              className='btn text-gray-500 hover-text-main-600 p-0 text-sm'
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {/* Truck (fitment) facet — reflects the URL contract from 03-04. */}
      <div className='shop-sidebar__box border border-gray-100 rounded-8 p-24 mb-24'>
        <h6 className='text-lg mb-12 flex-align gap-8'>
          <i className='ph ph-truck' />
          Mi camión
        </h6>
        {activeTruckModel ? (
          <div className='flex-align gap-12'>
            <span className='text-sm text-main-600 fw-medium'>
              Filtrando por tu camión
            </span>
            <button
              type='button'
              onClick={clearTruck}
              className='btn btn-sm text-gray-500 hover-text-main-600 p-0 text-sm flex-align gap-4'
            >
              <i className='ph ph-x-circle' />
              Quitar
            </button>
          </div>
        ) : (
          <p className='text-sm text-gray-500 mb-0'>
            Elige tu camión en la parte superior para ver solo las partes que le
            quedan.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile "Filtros" toggle (collapses the stack below lg). */}
      <div className='d-lg-none mb-24'>
        <button
          type='button'
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className='btn bg-gray-50 text-heading hover-bg-main-600 hover-text-white py-12 px-24 rounded-8 w-100 flex-between'
        >
          <span className='flex-align gap-8'>
            <i className='ph ph-funnel' />
            Filtros
          </span>
          <i className={`ph ${open ? "ph-caret-up" : "ph-caret-down"}`} />
        </button>
      </div>
      <div className={`${open ? "d-block" : "d-none"} d-lg-block`}>{facets}</div>
    </>
  );
};

export default FilterSidebar;
