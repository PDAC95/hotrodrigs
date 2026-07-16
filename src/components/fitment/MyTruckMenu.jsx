"use client";
import { useEffect, useRef, useState } from "react";
import { useTruckSelection } from "@/components/fitment/MyTruckSelector";
import { slugify } from "@/lib/slugify";
import "@/styles/hrr-menu.css";

/**
 * Header "My Truck" icon + dropdown panel.
 *
 * A compact truck icon (styled like the Profile/Cart activity icons) that
 * opens a panel on the shared HRR dark-menu surface, with two states:
 *   - truck active: identity header (chip + make/model + filtering status)
 *                   with Change / Remove actions
 *   - no truck:     Make -> Model cascade to pick one right there
 *
 * Renders over useTruckSelection, the single source of truth for the
 * persisted fitment context (localStorage + ?truck_model URL params, SRCH-03).
 * The component stays mounted with the panel CSS-hidden so the on-load
 * URL-reflection effect keeps working on every page.
 *
 * `inline` renders just the panel (no trigger, no dropdown positioning) so the
 * same block can sit inside the mobile drawer.
 */
const MyTruckMenu = ({ compact = false, inline = false }) => {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  // Make-logo avatar in the trigger; falls back to the truck icon on 404.
  const [logoFailed, setLogoFailed] = useState(false);
  const wrapRef = useRef(null);

  const {
    makes,
    models,
    makeId,
    modelId,
    makeName,
    modelName,
    hasTruck,
    handleMakeChange,
    handleModelChange,
    clearTruck,
  } = useTruckSelection();

  // Close on outside click or Escape (dropdown mode only).
  useEffect(() => {
    if (inline || !open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, inline]);

  // Leaving the panel resets the transient "changing" mode.
  useEffect(() => {
    if (!open) setChanging(false);
  }, [open]);

  const onModelPicked = (e) => {
    handleModelChange(e);
    if (e.target.value) setChanging(false);
  };

  const showPicker = !hasTruck || changing;

  // A new make gets a fresh chance at loading its logo.
  useEffect(() => {
    setLogoFailed(false);
  }, [makeName]);

  const showAvatar = hasTruck && makeName && !logoFailed;

  const panelInner = (
    <>
      <div className='mtm-head'>
        <span className='mtm-chip' aria-hidden='true'>
          <i className='ph-fill ph-truck-trailer' />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className='mtm-head-caption'>
            {hasTruck ? (
              <>
                <span className='mtm-status-dot' aria-hidden='true' />
                Filtering parts to fit
              </>
            ) : (
              "No truck selected"
            )}
          </div>
          <div className='mtm-head-title'>
            {hasTruck ? `${makeName} ${modelName}` : "Choose your truck"}
          </div>
        </div>
      </div>

      <div className='mtm-body'>
        {showPicker ? (
          <>
            <div className='hrr-field'>
              <label className='hrr-field__label' htmlFor='mtm-make'>
                Make
              </label>
              <select
                id='mtm-make'
                className='hrr-select'
                value={makeId}
                onChange={handleMakeChange}
                suppressHydrationWarning
              >
                <option value=''>Select make</option>
                {makes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='hrr-field'>
              <label className='hrr-field__label' htmlFor='mtm-model'>
                Model
              </label>
              <select
                id='mtm-model'
                className='hrr-select'
                value={modelId}
                onChange={onModelPicked}
                disabled={!makeId || models.length === 0}
                suppressHydrationWarning
              >
                <option value=''>
                  {makeId ? "Select model" : "Select make first"}
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {changing ? (
              <div className='mtm-actions' style={{ marginTop: 12 }}>
                <button
                  type='button'
                  className='hrr-btn hrr-btn--ghost'
                  onClick={() => setChanging(false)}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <p className='mtm-hint'>
              We&apos;ll only show parts that fit. Saved on this device.
            </p>
          </>
        ) : (
          <>
            <div className='mtm-actions'>
              <button
                type='button'
                className='hrr-btn hrr-btn--outline'
                onClick={() => setChanging(true)}
              >
                Change truck
              </button>
              <button
                type='button'
                className='hrr-btn hrr-btn--ghost'
                onClick={clearTruck}
              >
                Remove
              </button>
            </div>
            <p className='mtm-hint'>
              Search and listings are filtered to parts that fit this truck.
            </p>
          </>
        )}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className='hrr-menu mtm-panel mtm-panel--inline' aria-label='My truck'>
        {panelInner}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className='position-relative'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='flex-align flex-column gap-8 item-hover-two'
        aria-expanded={open}
        aria-haspopup='true'
        aria-label={
          hasTruck ? `My Truck: ${makeName} ${modelName}` : "Choose my truck"
        }
      >
        <span className='text-2xl text-white d-flex position-relative item-hover__text'>
          {showAvatar ? (
            <span className='mtm-avatar' aria-hidden='true'>
              <img
                src={`/assets/images/fitment/makes/${slugify(makeName)}.png`}
                alt=''
                onError={() => setLogoFailed(true)}
              />
            </span>
          ) : (
            <>
              <i className='ph ph-truck-trailer' />
              {hasTruck ? (
                <span className='mtm-dot' aria-hidden='true' />
              ) : null}
            </>
          )}
        </span>
        {!compact ? (
          <span className='text-md text-white item-hover__text d-none d-lg-flex'>
            My Truck
          </span>
        ) : null}
      </button>

      <div
        role='dialog'
        aria-label='My truck'
        className={`hrr-menu mtm-panel ${open ? "" : "d-none"}`}
      >
        {panelInner}
      </div>
    </div>
  );
};

export default MyTruckMenu;
