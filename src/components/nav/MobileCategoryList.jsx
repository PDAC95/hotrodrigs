"use client";
import { useState } from "react";
import Link from "next/link";
import { TRUCK_AREAS } from "@/lib/catalog/areas";
import "@/styles/hrr-menu.css";

/**
 * Mobile category drawer content — an in-place view navigator.
 *
 * The drawer opens on a root choice: shop by truck AREA (physical zone of the
 * rig) or by CATEGORY (the L1/L2 tree). Every step navigates INSIDE the same
 * box: the list is swapped with a subtle direction-aware slide+fade, and each
 * level carries a back row.
 *
 *   root ── areas ─────────────→ /search?area=…
 *      └── cats ── section ────→ /c/{l1}/{l2}
 *
 * Replaces hover flyouts, which can't work in an off-canvas drawer.
 */
const MobileCategoryList = ({ tree = [], onNavigate }) => {
  // view: {name:'root'} | {name:'areas'} | {name:'cats'} | {name:'section', id}
  const [view, setView] = useState({ name: "root" });
  const [dir, setDir] = useState("fwd");

  const go = (next, d = "fwd") => {
    setDir(d);
    setView(next);
  };

  const section =
    view.name === "section" ? tree.find((s) => s.id === view.id) : null;

  // A real navigation closes the drawer and resets to the root choice.
  const navigate = () => {
    setView({ name: "root" });
    onNavigate?.();
  };

  const viewKey = view.name + (view.id ?? "");

  return (
    <div className='hrr-mcat'>
      <div
        key={viewKey}
        className={`hrr-mcat__view ${
          dir === "back" ? "hrr-mcat__view--back" : "hrr-mcat__view--fwd"
        }`}
      >
        {view.name === "root" ? (
          <>
            <div className='hrr-mcat__title'>Browse parts</div>
            <div className='hrr-mcat__divider' />
            <button
              type='button'
              className='hrr-mcat__choice'
              onClick={() => go({ name: "areas" })}
            >
              <span className='hrr-mcat__choice-icon'>
                <i className='ph ph-truck' />
              </span>
              <span className='hrr-mcat__choice-copy'>
                <strong>By truck area</strong>
                <em>Front, cab, interior, wheels…</em>
              </span>
              <span className='hrr-mcat__chev'>
                <i className='ph ph-caret-right' />
              </span>
            </button>
            <button
              type='button'
              className='hrr-mcat__choice'
              onClick={() => go({ name: "cats" })}
            >
              <span className='hrr-mcat__choice-icon'>
                <i className='ph ph-squares-four' />
              </span>
              <span className='hrr-mcat__choice-copy'>
                <strong>By category</strong>
                <em>Lighting, engine, exhaust…</em>
              </span>
              <span className='hrr-mcat__chev'>
                <i className='ph ph-caret-right' />
              </span>
            </button>
          </>
        ) : null}

        {view.name === "areas" ? (
          <>
            <button
              type='button'
              className='hrr-mcat__back'
              onClick={() => go({ name: "root" }, "back")}
            >
              <i className='ph ph-caret-left' />
              Browse parts
            </button>
            <div className='hrr-mcat__title'>Truck areas</div>
            <div className='hrr-mcat__divider' />
            <ul>
              {TRUCK_AREAS.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={`/search?area=${area.slug}`}
                    onClick={navigate}
                    className='hrr-mcat__row'
                  >
                    <span className='hrr-mcat__lead'>
                      <i className='ph ph-truck' />
                    </span>
                    <span>{area.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {view.name === "cats" ? (
          <>
            <button
              type='button'
              className='hrr-mcat__back'
              onClick={() => go({ name: "root" }, "back")}
            >
              <i className='ph ph-caret-left' />
              Browse parts
            </button>
            <div className='hrr-mcat__title'>Categories</div>
            <div className='hrr-mcat__divider' />
            <ul>
              {tree.map((s) =>
                s.children?.length > 0 ? (
                  <li key={s.id}>
                    <button
                      type='button'
                      className='hrr-mcat__row'
                      onClick={() => go({ name: "section", id: s.id })}
                    >
                      <span className='hrr-mcat__lead'>
                        <i className='ph ph-wrench' />
                      </span>
                      <span>{s.name}</span>
                      <span className='hrr-mcat__chev'>
                        <i className='ph ph-caret-right' />
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={s.id}>
                    <Link
                      href={`/c/${s.slug}`}
                      onClick={navigate}
                      className='hrr-mcat__row'
                    >
                      <span className='hrr-mcat__lead'>
                        <i className='ph ph-wrench' />
                      </span>
                      <span>{s.name}</span>
                    </Link>
                  </li>
                )
              )}
            </ul>
          </>
        ) : null}

        {view.name === "section" && section ? (
          <>
            <button
              type='button'
              className='hrr-mcat__back'
              onClick={() => go({ name: "cats" }, "back")}
            >
              <i className='ph ph-caret-left' />
              Categories
            </button>
            <div className='hrr-mcat__title'>{section.name}</div>
            <div className='hrr-mcat__divider' />
            <ul>
              <li>
                <Link
                  href={`/c/${section.slug}`}
                  onClick={navigate}
                  className='hrr-mcat__row'
                >
                  <span>All {section.name}</span>
                  <span className='hrr-mcat__chev'>
                    <i className='ph ph-arrow-right' />
                  </span>
                </Link>
              </li>
              {section.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/c/${section.slug}/${child.slug}`}
                    onClick={navigate}
                    className='hrr-mcat__row'
                  >
                    <span>{child.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MobileCategoryList;
