"use client";
import { useState } from "react";
import Link from "next/link";
import "@/styles/hrr-menu.css";

/**
 * Mobile category drawer content — a two-level SLIDING list.
 *
 * Level 1: the categories, same row design as everywhere else (wrench lead,
 * name, chevron). Tapping a category with children slides the track to
 * level 2: a back row ("All Categories"), the category title, a "View all"
 * link and its subcategories in the same row style. Tapping back slides home.
 *
 * Replaces the hover-based MegaMenuList inside the off-canvas drawer, where
 * hover flyouts can't work.
 */
const MobileCategoryList = ({ tree = [], onNavigate }) => {
  const [activeId, setActiveId] = useState(null);
  const active = tree.find((s) => s.id === activeId);

  const navigate = () => {
    setActiveId(null);
    onNavigate?.();
  };

  return (
    <div className={`hrr-mcat ${active ? "is-sub" : ""}`}>
      <div className='hrr-mcat__track'>
        {/* Level 1 — categories */}
        <div className='hrr-mcat__panel'>
          <ul>
            {tree.map((section) =>
              section.children?.length > 0 ? (
                <li key={section.id}>
                  <button
                    type='button'
                    className='hrr-mcat__row'
                    onClick={() => setActiveId(section.id)}
                    aria-expanded={active?.id === section.id}
                  >
                    <span className='hrr-mcat__lead'>
                      <i className='ph ph-wrench' />
                    </span>
                    <span>{section.name}</span>
                    <span className='hrr-mcat__chev'>
                      <i className='ph ph-caret-right' />
                    </span>
                  </button>
                </li>
              ) : (
                <li key={section.id}>
                  <Link
                    href={`/c/${section.slug}`}
                    onClick={navigate}
                    className='hrr-mcat__row'
                  >
                    <span className='hrr-mcat__lead'>
                      <i className='ph ph-wrench' />
                    </span>
                    <span>{section.name}</span>
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>

        {/* Level 2 — subcategories of the active category */}
        <div className='hrr-mcat__panel'>
          {active ? (
            <>
              <button
                type='button'
                className='hrr-mcat__back'
                onClick={() => setActiveId(null)}
              >
                <i className='ph ph-caret-left' />
                All Categories
              </button>
              <div className='hrr-mcat__title'>{active.name}</div>
              <div className='hrr-mcat__divider' />
              <ul>
                <li>
                  <Link
                    href={`/c/${active.slug}`}
                    onClick={navigate}
                    className='hrr-mcat__row'
                  >
                    <span>All {active.name}</span>
                    <span className='hrr-mcat__chev'>
                      <i className='ph ph-arrow-right' />
                    </span>
                  </Link>
                </li>
                {active.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/c/${active.slug}/${child.slug}`}
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
    </div>
  );
};

export default MobileCategoryList;
