"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/hrr-menu.css";

/**
 * Search-bar category scope — a custom combobox over the real L1 tree.
 *
 * Replaces the select2 default control with the shared HRR dark-menu surface:
 * white trigger that blends into the search pill, dark listbox with pill-hover
 * rows and an orange check on the selected scope. Full keyboard support
 * (arrows, Home/End, Enter/Space, Escape, type-ahead) per the WAI-ARIA
 * select-only combobox pattern.
 *
 * A visually-hidden native <select name="category"> stays in the form so
 * HeaderTwo's submit handler (and a no-JS GET submit) keep working unchanged.
 */
const CategoryScopeSelect = ({ categories = [] }) => {
  const options = [
    { id: "", name: "All Categories" },
    ...categories.map((c) => ({ id: String(c.id), name: c.name })),
  ];

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  // The search pill clips overflow, so the listbox renders position:fixed at
  // viewport coords computed from the trigger (re-synced on scroll/resize).
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const syncMenuPos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 10, left: rect.left });
  }, []);

  // Track the trigger while open (sticky header, window resize).
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", syncMenuPos, true);
    window.addEventListener("resize", syncMenuPos);
    return () => {
      window.removeEventListener("scroll", syncMenuPos, true);
      window.removeEventListener("resize", syncMenuPos);
    };
  }, [open, syncMenuPos]);

  const selected = options.find((o) => o.id === value) ?? options[0];

  const openList = useCallback(() => {
    const idx = options.findIndex((o) => o.id === value);
    setActiveIdx(idx >= 0 ? idx : 0);
    syncMenuPos();
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, categories, syncMenuPos]);

  const choose = useCallback(
    (idx) => {
      const opt = options[idx];
      if (!opt) return;
      setValue(opt.id);
      setOpen(false);
      triggerRef.current?.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories]
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the active row in view while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  const onKeyDown = (e) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIdx(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIdx(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIdx);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // Type-ahead: accumulate printable chars in a 500ms window.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          const fresh = now - typeahead.current.at > 500;
          typeahead.current = {
            buffer: (fresh ? "" : typeahead.current.buffer) +
              e.key.toLowerCase(),
            at: now,
          };
          const idx = options.findIndex((o) =>
            o.name.toLowerCase().startsWith(typeahead.current.buffer)
          );
          if (idx >= 0) setActiveIdx(idx);
        }
      }
    }
  };

  return (
    <div className='hrr-scope' ref={wrapRef} onKeyDown={onKeyDown}>
      {/* Real form control — submit + no-JS path. */}
      <select
        name='category'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className='hrr-visually-hidden'
        tabIndex={-1}
        aria-hidden='true'
      >
        {options.map((o) => (
          <option key={o.id || "all"} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <button
        type='button'
        ref={triggerRef}
        className='hrr-scope__trigger'
        role='combobox'
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-controls='hrr-scope-listbox'
        aria-label='Search in category'
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <span>{selected.name}</span>
        <i
          className={`ph ph-caret-down hrr-scope__caret ${
            open ? "is-open" : ""
          }`}
          aria-hidden='true'
        />
      </button>

      {open ? (
        <div
          className='hrr-menu hrr-scope__list'
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
        >
          <ul
            id='hrr-scope-listbox'
            role='listbox'
            aria-label='Categories'
            className='hrr-menu__list'
            ref={listRef}
          >
            {options.map((o, i) => (
              <li
                key={o.id || "all"}
                role='option'
                aria-selected={o.id === value}
                data-active={i === activeIdx}
                className='hrr-option'
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span>{o.name}</span>
                {o.id === value ? (
                  <i
                    className='ph ph-check hrr-option__check'
                    aria-hidden='true'
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default CategoryScopeSelect;
