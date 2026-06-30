"use client";

/**
 * CartProvider — cross-component reactive cart state (count + drawer + lines)
 * without a new dependency (CONTEXT: React context + the guest-store change
 * event, NOT Zustand).
 *
 * Sources of truth:
 *  - logged-in: /api/cart/count for the badge, getCartAction() for drawer lines
 *  - guest:     guestCartCount(getGuestCart()) for the badge, getGuestCartAction
 *               for server-derived display lines
 *
 * Hydration safety (RESEARCH Pitfall 7): the badge must render nothing/0 until a
 * `mounted` flag flips in useEffect, otherwise SSR (no localStorage) and the
 * client first paint disagree. Consumers read `mounted` + suppressHydrationWarning.
 *
 * Merge-on-login (RESEARCH Pattern 7): once a freshly authenticated session is
 * detected AND a non-empty guest store exists, call mergeGuestCartAction once,
 * then clearGuestCart(). Guarded by a ref so it runs a single time per login.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getGuestCart,
  guestCartCount,
  clearGuestCart,
  CART_EVENT,
} from "@/lib/cart/guest-store";
import {
  getCartAction,
  getGuestCartAction,
  mergeGuestCartAction,
} from "@/lib/cart/actions";

const CartContext = createContext(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    // A consumer rendered outside the provider — degrade gracefully so a stray
    // header instance never crashes the app.
    return {
      mounted: false,
      count: 0,
      lines: [],
      isLoggedIn: false,
      isDrawerOpen: false,
      openDrawer: () => {},
      closeDrawer: () => {},
      setCount: () => {},
      setLines: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}

const CartProvider = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const [lines, setLines] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Once-per-login merge guard.
  const mergedRef = useRef(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Recompute the guest badge + lines from localStorage (server re-derives price).
  const refreshGuest = useCallback(async () => {
    const guestLines = getGuestCart();
    setCount(guestCartCount(guestLines));
    try {
      const { lines: derived } = await getGuestCartAction(guestLines);
      setLines(derived ?? []);
    } catch {
      setLines([]);
    }
  }, []);

  // Refresh the logged-in badge + drawer lines from the server.
  const refreshLoggedIn = useCallback(async () => {
    try {
      const { lines: srvLines, count: srvCount } = await getCartAction();
      setLines(srvLines ?? []);
      setCount(srvCount ?? 0);
    } catch {
      // leave previous state on a transient failure
    }
  }, []);

  // Public refresh — picks the right source.
  const refresh = useCallback(async () => {
    if (isLoggedIn) {
      await refreshLoggedIn();
    } else {
      await refreshGuest();
    }
  }, [isLoggedIn, refreshLoggedIn, refreshGuest]);

  // Initial hydration + auth detection + merge-on-login.
  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      const loggedIn = !!user;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        // MERGE-ON-LOGIN: a non-empty guest store folds into the DB cart once.
        const guestLines = getGuestCart();
        if (guestLines.length > 0 && !mergedRef.current) {
          mergedRef.current = true;
          try {
            const { lines: merged, count: mergedCount } =
              await mergeGuestCartAction(guestLines);
            clearGuestCart();
            if (cancelled) return;
            setLines(merged ?? []);
            setCount(mergedCount ?? 0);
            return;
          } catch {
            // fall through to a plain logged-in refresh
          }
        }
        await refreshLoggedIn();
      } else {
        await refreshGuest();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshLoggedIn, refreshGuest]);

  // React to guest-cart mutations from anywhere (add/update/remove/clear).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => {
      if (!isLoggedIn) refreshGuest();
    };
    window.addEventListener(CART_EVENT, onChange);
    return () => window.removeEventListener(CART_EVENT, onChange);
  }, [isLoggedIn, refreshGuest]);

  const value = {
    mounted,
    count,
    lines,
    isLoggedIn,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    setCount,
    setLines,
    refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartProvider;
