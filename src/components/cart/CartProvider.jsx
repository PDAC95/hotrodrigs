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
 * Merge-on-login (RESEARCH Pattern 7): the guest→server merge runs SERVER-SIDE
 * inside the signIn Server Action (the browser client never emits SIGNED_IN for
 * a server-created session). signIn then soft-navigates to /account?cart_merged=1.
 * This provider consumes that soft-nav signal — read from window.location.search,
 * NOT useSearchParams (the latter without a Suspense boundary de-opts EVERY route
 * to client-side rendering in Next 15, since this provider wraps the whole app) —
 * to clear the guest localStorage cart, mark the session logged-in, refresh the
 * badge + lines once, and strip the param, all without a full reload.
 *
 * Double-merge guard: a sessionStorage key `hrr.cart_merged_handled` is the
 * cross-mount idempotency guard for a SINGLE login; it is RESET on every
 * logged-out transition so a second login in the same tab re-syncs. The mount
 * effect's in-mount merge is skipped whenever cart_merged is present OR the guard
 * is set, so a hard reload of /account?cart_merged=1 never double-merges.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { usePathname } from "next/navigation";

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

// Cross-mount idempotency guard for a SINGLE login (reset on every logged-out
// transition so repeated logins in one tab re-sync).
const MERGE_HANDLED_KEY = "hrr.cart_merged_handled";

// One-shot flag set by LoginForm right before a Google OAuth redirect. On the
// OAuth path signIn never runs, so the guest cart is NOT merged server-side;
// this flag tells the mount effect to fold it in exactly once on return.
const OAUTH_MERGE_PENDING_KEY = "hrr.oauth_merge_pending";

// True when the current URL still carries the post-login soft-nav signal.
function hasCartMergedParam() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("cart_merged") === "1"
  );
}

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
  const pathname = usePathname();

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
        // CART-03 merge reconciliation. Two login paths land here:
        //  - email+password: signIn already merged the guest cart SERVER-SIDE, so
        //    any leftover localStorage copy is ALREADY folded in. Re-merging it
        //    client-side double-counts on every reload (the 04-05 defect: badge/
        //    total grew by the guest line on each F5) — so we just drop the copy.
        //  - Google OAuth: signIn never ran (the server can't read localStorage),
        //    so the guest cart is NOT yet merged. LoginForm set a one-shot
        //    `hrr.oauth_merge_pending` flag before the redirect; consume it here
        //    to fold the guest cart in exactly once, then clear it. The flag is
        //    removed after use, so a refresh cannot double-merge.
        const guestLines = getGuestCart();
        const oauthMergePending =
          typeof window !== "undefined" &&
          sessionStorage.getItem(OAUTH_MERGE_PENDING_KEY) === "1";

        if (oauthMergePending && guestLines.length > 0) {
          try {
            await mergeGuestCartAction(guestLines);
          } catch {}
          clearGuestCart();
        } else if (guestLines.length > 0) {
          clearGuestCart();
        }
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(OAUTH_MERGE_PENDING_KEY);
        }
        if (cancelled) return;
        await refreshLoggedIn();
      } else {
        // GUARD RESET (canonical no-user point): becoming logged out clears the
        // per-login guard so the next login's cart_merged effect re-syncs, and
        // drops any stale OAuth-merge flag (e.g. a cancelled Google sign-in).
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(MERGE_HANDLED_KEY);
          sessionStorage.removeItem(OAUTH_MERGE_PENDING_KEY);
        }
        await refreshGuest();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshLoggedIn, refreshGuest]);

  // POST-LOGIN RE-SYNC — consume the /account?cart_merged=1 soft-nav signal once.
  // The server already merged the guest cart inside signIn; here we just sync the
  // UI without a full reload. Param read from window.location.search (NOT
  // useSearchParams — see header comment re Next 15 CSR bailout). Keyed on
  // `mounted` + `pathname` so a soft navigation re-runs this effect.
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const justMerged = hasCartMergedParam();
    if (!justMerged) return;
    if (sessionStorage.getItem(MERGE_HANDLED_KEY) === "1") return;

    // Set the guard BEFORE any await so a refresh/back to the same URL or a
    // re-render cannot re-enter.
    sessionStorage.setItem(MERGE_HANDLED_KEY, "1");
    // Mark logged-in and flip the once-per-login ref BEFORE awaiting so the mount
    // effect's in-mount merge cannot also fire.
    setIsLoggedIn(true);
    mergedRef.current = true;
    // The server already folded these items in — drop the localStorage copy so a
    // later login can't re-merge them.
    clearGuestCart();

    let cancelled = false;
    (async () => {
      await refreshLoggedIn();
      if (cancelled) return;
      // Strip the param via history.replaceState (NOT router.replace — avoids a
      // re-render/refetch loop). The URL becomes /account with no param.
      if (window.history?.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, pathname, refreshLoggedIn]);

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
