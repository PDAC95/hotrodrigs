"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "@/styles/hrr-menu.css";

/**
 * Sticky-bar "All Categories" — a click-driven menu on the HRR dark surface.
 *
 * Clicking the button opens a large categories panel fused under the bar;
 * hovering a category with children grows the SAME container sideways to
 * reveal a twin subcategories panel of identical size. One container, one
 * continuous outline — no seams by construction.
 *
 * Replaces the template's hover dropdown in the scrolled (sticky) state.
 */
const StickyCategoryMenu = ({ tree = [] }) => {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const wrapRef = useRef(null);

  const active = tree.find(
    (s) => s.id === activeId && s.children?.length > 0
  );

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // A fresh open starts without a twin.
  useEffect(() => {
    if (!open) setActiveId(null);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className='hrr-cat' ref={wrapRef}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup='true'
        className='category__button flex-align gap-8 fw-medium bg-main-two-600 p-16 text-white'
      >
        <span className='icon text-2xl d-xs-flex d-none'>
          <i className='ph ph-dots-nine' />
        </span>
        <span className='d-sm-flex d-none'>All</span> Categories
        <span className='arrow-icon text-xl d-flex'>
          <i className={`ph ${open ? "ph-caret-up" : "ph-caret-down"}`} />
        </span>
      </button>

      {open ? (
        <div className={`hrr-cat__drop ${active ? "has-twin" : ""}`}>
          {/* Categories panel */}
          <div className='hrr-cat__col'>
            <ul className='hrr-cat__list'>
              {tree.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`/c/${section.slug}`}
                    onClick={close}
                    onMouseEnter={() =>
                      setActiveId(
                        section.children?.length > 0 ? section.id : null
                      )
                    }
                    className={`hrr-cat__row ${
                      active?.id === section.id ? "is-active" : ""
                    }`}
                  >
                    <span className='hrr-cat__lead'>
                      <i className='ph ph-wrench' />
                    </span>
                    <span>{section.name}</span>
                    {section.children?.length > 0 ? (
                      <span className='hrr-cat__chev'>
                        <i className='ph ph-caret-right' />
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Twin subcategories panel — same size, same container */}
          {active ? (
            <div className='hrr-cat__col hrr-cat__col--twin'>
              <div className='hrr-cat__title'>{active.name}</div>
              <ul className='hrr-cat__list'>
                <li>
                  <Link
                    href={`/c/${active.slug}`}
                    onClick={close}
                    className='hrr-cat__row'
                  >
                    <span>All {active.name}</span>
                  </Link>
                </li>
                {active.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/c/${active.slug}/${child.slug}`}
                      onClick={close}
                      className='hrr-cat__row'
                    >
                      <span>{child.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default StickyCategoryMenu;
