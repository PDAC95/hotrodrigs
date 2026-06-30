"use client";

/**
 * ShippingRates — the live rate step (SHIP-02/03/04).
 *
 * Given a verified-shaped `address` (from AddressForm) and, for guests, a
 * `guestCart` ([{variant_id, quantity}]), this DEBOUNCES a POST to the single
 * shipping seam /api/shipping/quote and renders the result:
 *
 *   - verified:false  -> a "couldn't verify" notice; the suggestion is lifted to
 *                        the parent (via onSuggestion) so AddressForm can apply it.
 *   - parcel.options  -> a RADIO list (carrier + price + ETA), index 0 (cheapest,
 *                        server-sorted) preselected; selecting one calls onSelect.
 *   - estimated:true  -> the option(s) PLUS a visible "estimated shipping" notice
 *                        (CONTEXT: never a silent swap).
 *   - freight present -> a separate non-blocking "we'll send you a freight quote"
 *                        notice; parcel items still rate (mixed cart).
 *   - empty:true      -> "Add items to your cart to see shipping rates."
 *
 * Re-quote discipline (Pitfall 7 — never charge a stale amount): every address OR
 * cart change cancels the in-flight request (AbortController) and re-fetches; the
 * previous selection is cleared so the parent can't keep a rate for a different
 * address/cart.
 *
 * Spinner + CLIENT timeout (SHIP-04, belt-and-suspenders over the server's 6s
 * ceiling): a client-side abort after CLIENT_TIMEOUT_MS resolves the spinner to a
 * flat "estimated shipping" notice so it can never hang forever.
 *
 * All copy in English (CLAUDE.md). Bootstrap markup matching the template.
 */

import React, { useEffect, useRef, useState } from "react";

// Debounce so rates load when the user STOPS typing, not on every keystroke.
const DEBOUNCE_MS = 600;
// Longer than the server's QUOTE_TIMEOUT_MS (6s) ceiling so the server's own
// estimated fallback normally wins; this only catches a truly stuck fetch.
const CLIENT_TIMEOUT_MS = 9000;
// Generic flat amount shown if the client itself times out (the server never
// answered). Matches the spirit of the flat-tier fallback.
const CLIENT_TIMEOUT_FLAT = 19.99;

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function rateLabel(opt) {
  const carrier = opt.carrier ? `${opt.carrier} ` : "";
  const service = opt.service ?? opt.label ?? "Shipping";
  const eta =
    opt.eta_days != null ? `${opt.eta_days} days` : "ETA varies";
  return `${carrier}${service} — ${formatPrice(opt.amount)} — ${eta}`;
}

// Stable key for the (address + cart) pair so the fetch effect re-runs only on a
// real change.
function quoteKey(address, guestCart) {
  if (!address) return "";
  return JSON.stringify({ a: address, c: guestCart ?? null });
}

const ShippingRates = ({ address, guestCart, onSelect, onSuggestion }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const timeoutRef = useRef(null);

  const key = quoteKey(address, guestCart);

  useEffect(() => {
    // No address yet -> nothing to fetch.
    if (!address || !address.street1) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Any change cancels the in-flight request + pending debounce, and clears the
    // previous selection so a stale rate is never carried over (Pitfall 7).
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSelectedId(null);
    onSelect?.(null);

    let cancelled = false;

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      // Client-side hard timeout: abort + show a flat estimate if the fetch
      // itself stalls past the server ceiling (SHIP-04 belt-and-suspenders).
      timeoutRef.current = setTimeout(() => {
        controller.abort();
        if (cancelled) return;
        setResult({
          verified: true,
          estimated: true,
          parcel: {
            estimated: true,
            options: [
              {
                id: "client-timeout-flat",
                label: "Estimated shipping",
                carrier: "",
                service: "Estimated shipping",
                amount: CLIENT_TIMEOUT_FLAT,
                currency: "USD",
                eta_days: null,
              },
            ],
          },
          freight: null,
        });
        setLoading(false);
      }, CLIENT_TIMEOUT_MS);

      (async () => {
        try {
          const res = await fetch("/api/shipping/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              guest_cart: guestCart ?? undefined,
            }),
            signal: controller.signal,
          });
          if (cancelled) return;
          clearTimeout(timeoutRef.current);

          if (!res.ok) {
            // The server already swallows EasyPost errors into an estimated
            // fallback; a non-200 here is unexpected -> show the flat estimate
            // rather than a hard error so checkout never dead-ends.
            setResult({
              verified: true,
              estimated: true,
              parcel: {
                estimated: true,
                options: [
                  {
                    id: "server-error-flat",
                    label: "Estimated shipping",
                    carrier: "",
                    service: "Estimated shipping",
                    amount: CLIENT_TIMEOUT_FLAT,
                    currency: "USD",
                    eta_days: null,
                  },
                ],
              },
              freight: null,
            });
            setLoading(false);
            return;
          }

          const data = await res.json();
          if (cancelled) return;
          setResult(data);
          setLoading(false);

          // Lift the verification suggestion to the parent (AddressForm applies it).
          if (data.verified === false) {
            onSuggestion?.(data.suggestion ?? null);
          } else {
            onSuggestion?.(null);
            // Preselect the cheapest (server-sorted index 0).
            const opts = data.parcel?.options ?? [];
            if (opts.length > 0) {
              setSelectedId(opts[0].id);
              onSelect?.(opts[0]);
            }
          }
        } catch (err) {
          if (cancelled || err?.name === "AbortError") return;
          clearTimeout(timeoutRef.current);
          setError("rate_failed");
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleSelect = (opt) => {
    setSelectedId(opt.id);
    onSelect?.(opt);
  };

  // --- Render branches -----------------------------------------------------

  if (!address || !address.street1) {
    return (
      <p className="text-gray-500">
        Enter a shipping address to see live rates.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex-align gap-12 text-gray-700">
        <span
          className="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true"
        />
        <span>Getting live shipping rates…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16">
        <p className="text-gray-900 mb-0">
          We couldn&apos;t reach the shipping service. Please try again in a
          moment.
        </p>
      </div>
    );
  }

  if (!result) return null;

  if (result.verified === false) {
    return (
      <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16">
        <p className="text-gray-900 mb-0">
          We couldn&apos;t verify that address. See the suggested correction
          above and accept it to load rates.
        </p>
      </div>
    );
  }

  if (result.empty) {
    return (
      <p className="text-gray-500">
        Add items to your cart to see shipping rates.
      </p>
    );
  }

  const options = result.parcel?.options ?? [];
  const isEstimated = result.estimated === true || result.parcel?.estimated === true;
  const freight = result.freight;

  return (
    <div className="shipping-rates">
      <h6 className="text-lg mb-16">Shipping method</h6>

      {isEstimated && (
        <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-12 mb-16">
          <p className="text-gray-900 mb-0">
            Estimated shipping — final cost may be adjusted.
          </p>
        </div>
      )}

      {options.length > 0 ? (
        <div className="mb-16">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="form-check common-check common-radio py-12 mb-0"
            >
              <input
                className="form-check-input"
                type="radio"
                name="shipping-rate"
                id={`shipping-rate-${opt.id}`}
                checked={selectedId === opt.id}
                onChange={() => handleSelect(opt)}
              />
              <label
                className="form-check-label fw-normal text-neutral-600"
                htmlFor={`shipping-rate-${opt.id}`}
              >
                {rateLabel(opt)}
              </label>
            </div>
          ))}
        </div>
      ) : (
        !freight && (
          <p className="text-gray-500 mb-16">
            No shipping rates available for this address.
          </p>
        )
      )}

      {freight && (
        <div className="border border-gray-100 bg-color-three rounded-8 px-20 py-16 mt-8">
          <p className="text-gray-900 fw-medium mb-4">
            {freight.label ?? "Freight item"}
          </p>
          <p className="text-gray-700 mb-0">
            One or more items ship by freight — we&apos;ll send you a freight
            quote separately. This won&apos;t block your order.
          </p>
        </div>
      )}
    </div>
  );
};

export default ShippingRates;
