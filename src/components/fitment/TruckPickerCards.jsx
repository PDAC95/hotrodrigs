"use client";
import { useEffect, useRef, useState } from "react";
import { useTruckSelection } from "@/components/fitment/MyTruckSelector";
import { getStoredTruck, setStoredTruck } from "@/lib/fitment/truck-storage";
import { slugify } from "@/lib/slugify";
import "@/styles/hrr-menu.css";
import "@/styles/truck-picker.css";

/**
 * Home "Shop by My Truck" module — three landscape picker cards (Make /
 * Model / Year) filling the section as a 3-up grid. Anatomy from the user's
 * reference card: gradient rim with a swept corner, a large media layer
 * behind a frosted-glass label panel, and a circular glass arrow that opens
 * the options panel — a tile GRID on the HRR dark surface (single-column
 * lists read poorly under full-width cards).
 *
 * Media per card: make logo (fallback monogram), truck front photo (fallback
 * icon), and the year's last two digits ('05). While a step is empty the
 * media is a slow conic ring. The rim warms to orange when the step is set.
 *
 * Make + Model ride the shared useTruckSelection hook — same persistent
 * fitment context as the header menu and search filters. Year is captured
 * and stored with the truck but does NOT filter results yet (no year ranges
 * in the fitment data).
 *
 * Assets: /assets/images/fitment/makes/{make}.png and
 * /assets/images/fitment/models/{make}-{model}.png — drop PNGs, they appear.
 */

const YEARS = (() => {
  const list = [];
  for (let y = 2026; y >= 1975; y--) list.push(String(y));
  return list;
})();

/** Image that falls back to `fallback` markup when the asset 404s. */
const WellImage = ({ src, alt, fallback }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) return fallback;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
};

/**
 * One picker card + its options panel. Option tiles are real buttons: Tab
 * order is native, arrows move by tile (Up/Down jump a computed grid row),
 * Escape closes and returns focus to the glass arrow.
 */
const PickerCard = ({
  title,
  railTop,
  railBottom,
  stepIndex,
  isSet,
  valueLabel,
  emptyLabel,
  disabled,
  disabledHint,
  options,
  selectedValue,
  onPick,
  open,
  onToggle,
  onClose,
  media,
  denseGrid = false,
  variant = null,
}) => {
  const wrapRef = useRef(null);
  const gridRef = useRef(null);
  const triggerRef = useRef(null);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  // On open: focus the selected tile (or the first) and bring it into view.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const grid = gridRef.current;
      if (!grid) return;
      const target =
        grid.querySelector(".tpk-opt.is-selected") ||
        grid.querySelector(".tpk-opt");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    const tiles = Array.from(grid.querySelectorAll(".tpk-opt"));
    const idx = tiles.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    // Columns = tiles sharing the first tile's row (offsetTop).
    const firstTop = tiles[0].offsetTop;
    const cols = Math.max(
      1,
      tiles.filter((t) => t.offsetTop === firstTop).length
    );
    const delta =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
        ? -1
        : e.key === "ArrowDown"
        ? cols
        : -cols;
    const next = tiles[Math.min(tiles.length - 1, Math.max(0, idx + delta))];
    next?.focus();
    next?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div
      ref={wrapRef}
      className={`tpk-cardwrap ${variant ? `tpk-cardwrap--${variant}` : ""} ${
        isSet ? "is-set" : ""
      }`}
      onKeyDown={onKeyDown}
    >
      <div className='tpk-card'>
        <div className='tpk-card__rim'>
          <span className='tpk-card__rimglow' aria-hidden='true' />
          <div className='tpk-card__panel' />
        </div>

        <div className='tpk-card__media' aria-hidden='true'>
          {media}
        </div>

        <div className='tpk-card__overlay'>
          <div className='tpk-glass'>
            <span className='tpk-glass__title'>{title}</span>
            <span className={`tpk-glass__value ${isSet ? "is-set" : ""}`}>
              {isSet ? valueLabel : disabled ? disabledHint : emptyLabel}
            </span>
            <div className='tpk-glass__foot'>STEP {stepIndex} / 3</div>
          </div>
          <div className='tpk-rail'>
            <span className='tpk-rail__tag'>{railTop}</span>
            <span className='tpk-rail__tag'>{railBottom}</span>
            <button
              type='button'
              ref={triggerRef}
              className={`tpk-arrow ${open ? "is-open" : ""}`}
              aria-expanded={open}
              aria-haspopup='true'
              aria-label={`Choose ${title.toLowerCase()}`}
              disabled={disabled}
              onClick={onToggle}
            >
              <i className='ph ph-caret-down' />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className='tpk-menu' role='dialog' aria-label={`${title} options`}>
          <div className='tpk-menu__head'>
            <span className='tpk-menu__title'>Select {title.toLowerCase()}</span>
            <span className='tpk-menu__count'>
              {options.length} OPTION{options.length === 1 ? "" : "S"}
            </span>
          </div>
          <div
            ref={gridRef}
            className={`tpk-menu__grid ${
              denseGrid ? "tpk-menu__grid--dense" : ""
            }`}
          >
            {options.map((o) => {
              const selected = String(o.value) === String(selectedValue);
              return (
                <button
                  key={o.value}
                  type='button'
                  className={`tpk-opt ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onPick(o.value)}
                >
                  <span>{o.label}</span>
                  {selected ? (
                    <i
                      className='ph ph-check tpk-opt__check'
                      aria-hidden='true'
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const TruckPickerCards = () => {
  const {
    makes,
    models,
    makeId,
    modelId,
    makeName,
    modelName,
    hydrated,
    hasTruck,
    handleMakeChange,
    handleModelChange,
  } = useTruckSelection();

  // Year: captured + persisted with the stored truck, not a filter (yet).
  const [year, setYear] = useState("");
  const [openMenu, setOpenMenu] = useState(null); // 'make' | 'model' | 'year'

  // makeId is a dep so a full clear (header Remove wipes make+model) and an
  // in-flight make change both re-read the stored truck's year.
  useEffect(() => {
    if (!hydrated) return;
    const stored = getStoredTruck();
    setYear(stored?.year ? String(stored.year) : "");
  }, [hydrated, modelId, makeId]);

  const pickMake = (value) => {
    handleMakeChange({ target: { value: String(value) } });
    setOpenMenu(null);
  };

  const pickModel = (value) => {
    handleModelChange({ target: { value: String(value) } });
    setOpenMenu(null);
  };

  const pickYear = (value) => {
    const y = String(value);
    setYear(y);
    const stored = getStoredTruck();
    if (stored) setStoredTruck({ ...stored, year: Number(y) });
    setOpenMenu(null);
  };

  const makeSlug = makeName ? slugify(makeName) : null;
  const modelSlug = modelName ? slugify(modelName) : null;

  const makeMonogram = makeName
    ? makeName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase()
    : null;

  const idleRing = <span className='tpk-ring' />;

  return (
    <section className='truck-picker mt-32'>
      <div className='container container-lg'>
        <div className='border border-gray-100 p-24 rounded-16'>
          <div className='section-heading mb-24'>
            <div className='flex-between flex-wrap gap-8'>
              <h5 className='mb-0'>Shop by My Truck</h5>
              <span className='tpk-note'>
                Pick your rig and we&apos;ll filter everything to parts that
                fit.
              </span>
            </div>
          </div>

          <div className='row gy-4'>
            <div className='col-lg-4 col-md-6'>
              <PickerCard
                title='Make'
                railTop='Hot Rod'
                railBottom='Rigs'
                stepIndex={1}
                isSet={Boolean(makeId && makeName)}
                valueLabel={makeName}
                emptyLabel='Choose a brand'
                disabled={false}
                disabledHint=''
                options={makes.map((m) => ({ value: m.id, label: m.name }))}
                selectedValue={makeId}
                onPick={pickMake}
                open={openMenu === "make"}
                onToggle={() =>
                  setOpenMenu((o) => (o === "make" ? null : "make"))
                }
                onClose={() => setOpenMenu(null)}
                media={
                  makeName ? (
                    <WellImage
                      key={makeSlug}
                      src={`/assets/images/fitment/makes/${makeSlug}.png`}
                      alt={makeName}
                      fallback={
                        <span className='tpk-media-mono'>{makeMonogram}</span>
                      }
                    />
                  ) : (
                    idleRing
                  )
                }
              />
            </div>

            <div className='col-lg-4 col-md-6'>
              <PickerCard
                title='Model'
                variant='model'
                railTop='Fitment'
                railBottom='Step'
                stepIndex={2}
                isSet={Boolean(modelId && modelName)}
                valueLabel={modelName}
                emptyLabel='Choose a model'
                disabled={!makeId || models.length === 0}
                disabledHint='Select make first'
                options={models.map((m) => ({ value: m.id, label: m.name }))}
                selectedValue={modelId}
                onPick={pickModel}
                open={openMenu === "model"}
                onToggle={() =>
                  setOpenMenu((o) => (o === "model" ? null : "model"))
                }
                onClose={() => setOpenMenu(null)}
                media={
                  modelName ? (
                    <WellImage
                      key={`${makeSlug}-${modelSlug}`}
                      src={`/assets/images/fitment/models/${makeSlug}-${modelSlug}.png`}
                      alt={`${makeName} ${modelName}`}
                      fallback={
                        <i className='ph-fill ph-truck tpk-media-icon' />
                      }
                    />
                  ) : (
                    idleRing
                  )
                }
              />
            </div>

            <div className='col-lg-4 col-md-6'>
              <PickerCard
                title='Year'
                railTop='Model'
                railBottom='Year'
                stepIndex={3}
                isSet={Boolean(year)}
                valueLabel={year}
                emptyLabel='Choose a year'
                disabled={!hasTruck}
                disabledHint='Select model first'
                options={YEARS.map((y) => ({ value: y, label: y }))}
                selectedValue={year}
                onPick={pickYear}
                open={openMenu === "year"}
                onToggle={() =>
                  setOpenMenu((o) => (o === "year" ? null : "year"))
                }
                onClose={() => setOpenMenu(null)}
                denseGrid
                media={
                  year ? (
                    <span key={year} className='tpk-media-year'>
                      <span className='tpk-media-year__tick'>&rsquo;</span>
                      <span className='tpk-media-year__digits'>
                        {year.slice(-2)}
                      </span>
                    </span>
                  ) : (
                    idleRing
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TruckPickerCards;
