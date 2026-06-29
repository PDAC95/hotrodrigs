"use client";

import React, { useMemo, useState } from "react";

// Variant Matrix (RESEARCH.md Pattern 3): the PDP loads ALL variants once on the server
// and hands them in as props. Selection is pure client-side derivation — zero network
// calls on click (BRWS-04, no N+1).

// size/pack come from the ETL as either null OR an empty string ('') for single-attribute
// products. Normalize both to null so a missing attribute is treated consistently.
const norm = (v) => (v == null || v === "" ? null : v);

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

const VariantSelector = ({ variants = [], priceMin, priceMax }) => {
  // Normalize once.
  const rows = useMemo(
    () => variants.map((v) => ({ ...v, size: norm(v.size), pack: norm(v.pack) })),
    [variants]
  );

  // Distinct option lists per attribute (skip the null "no attribute" entry).
  const sizes = useMemo(
    () => [...new Set(rows.map((v) => v.size).filter((s) => s != null))],
    [rows]
  );
  const packs = useMemo(
    () => [...new Set(rows.map((v) => v.pack).filter((p) => p != null))],
    [rows]
  );

  const hasSize = sizes.length > 0;
  const hasPack = packs.length > 0;

  // Default selection: first in-stock variant, else first variant.
  const defaultVariant = useMemo(() => {
    return rows.find((v) => (v.stock ?? 0) > 0) ?? rows[0] ?? null;
  }, [rows]);

  const [size, setSize] = useState(defaultVariant ? defaultVariant.size : null);
  const [pack, setPack] = useState(defaultVariant ? defaultVariant.pack : null);

  // The currently selected variant row (or undefined if the combo doesn't exist).
  const match = useMemo(
    () =>
      rows.find(
        (v) =>
          (!hasSize || v.size === size) && (!hasPack || v.pack === pack)
      ),
    [rows, size, pack, hasSize, hasPack]
  );

  // A size option is valid (has at least one matching row) given the current pack
  // selection — used to disable impossible combos.
  const sizeEnabled = (s) =>
    rows.some((v) => v.size === s && (!hasPack || v.pack === pack));
  const packEnabled = (p) =>
    rows.some((v) => v.pack === p && (!hasSize || v.size === size));

  const inStock = match && (match.stock ?? 0) > 0;
  const priceText = match
    ? formatPrice(match.price)
    : priceMin != null && priceMax != null && priceMin !== priceMax
    ? `${formatPrice(priceMin)} – ${formatPrice(priceMax)}`
    : formatPrice(priceMin ?? priceMax);

  return (
    <div className='mt-32'>
      {/* Price + availability */}
      <div className='flex-align flex-wrap gap-16 mb-24'>
        <h6 className='mb-0'>{priceText}</h6>
        {match ? (
          inStock ? (
            <span className='px-12 py-6 text-sm rounded-8 bg-success-50 text-success-600 fw-medium'>
              En stock
            </span>
          ) : (
            <span className='px-12 py-6 text-sm rounded-8 bg-gray-100 text-gray-500 fw-medium'>
              Agotado
            </span>
          )
        ) : (
          <span className='px-12 py-6 text-sm rounded-8 bg-gray-100 text-gray-500 fw-medium'>
            Selecciona una combinación
          </span>
        )}
      </div>

      {/* Size pills */}
      {hasSize && (
        <div className='mb-24'>
          <span className='text-gray-900 d-block mb-12 fw-medium'>Size</span>
          <div className='flex-align gap-8 flex-wrap'>
            {sizes.map((s) => {
              const enabled = sizeEnabled(s);
              const selected = s === size;
              return (
                <button
                  key={s}
                  type='button'
                  disabled={!enabled}
                  onClick={() => setSize(s)}
                  className={`px-16 py-8 text-sm rounded-8 border ${
                    selected
                      ? "border-main-600 text-main-600 bg-main-50"
                      : "border-gray-200 text-gray-900"
                  } ${
                    enabled
                      ? "hover-border-main-600 hover-text-main-600"
                      : "opacity-50 text-gray-400"
                  }`}
                  style={!enabled ? { cursor: "not-allowed" } : undefined}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pack pills */}
      {hasPack && (
        <div className='mb-24'>
          <span className='text-gray-900 d-block mb-12 fw-medium'>Pack</span>
          <div className='flex-align gap-8 flex-wrap'>
            {packs.map((p) => {
              const enabled = packEnabled(p);
              const selected = p === pack;
              return (
                <button
                  key={p}
                  type='button'
                  disabled={!enabled}
                  onClick={() => setPack(p)}
                  className={`px-16 py-8 text-sm rounded-8 border ${
                    selected
                      ? "border-main-600 text-main-600 bg-main-50"
                      : "border-gray-200 text-gray-900"
                  } ${
                    enabled
                      ? "hover-border-main-600 hover-text-main-600"
                      : "opacity-50 text-gray-400"
                  }`}
                  style={!enabled ? { cursor: "not-allowed" } : undefined}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
