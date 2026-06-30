"use client";

/**
 * AddressForm — the checkout address step (SHIP-01).
 *
 * Responsibilities:
 *  - On mount, load the session's saved addresses via getSavedAddresses() (a
 *    server action on the RLS cookie client). Logged-in users with saved rows get
 *    a "Use a saved address" / "Enter a new address" picker; guests (empty list)
 *    drop straight into the new-address form.
 *  - Collect a US/CA address (locked scope) and LIFT it to the parent via
 *    onAddressChange in the EasyPost shape { street1, street2, city, state, zip,
 *    country } — the same shape /api/shipping/quote expects.
 *  - Render a server `suggestion` (passed down from the parent, which drives the
 *    quote fetch) with an "Use suggested address" button that replaces the form
 *    fields and re-emits the change. Verification itself happens server-side
 *    inside the quote endpoint; this form only renders + accepts the suggestion.
 *
 * Bootstrap 5 markup reusing the template's `common-input border-gray-100`
 * classes so it matches the original Checkout look (no Tailwind). All copy in
 * English (CLAUDE.md).
 */

import React, { useEffect, useRef, useState } from "react";

import { getSavedAddresses } from "@/lib/shipping/actions";

// Locked geographic scope: US + Canada only (RESEARCH / CONTEXT).
const COUNTRIES = [
  { code: "US", label: "United States (US)" },
  { code: "CA", label: "Canada (CA)" },
];

const EMPTY_ADDRESS = {
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

/** Map a Supabase `addresses` row -> the EasyPost shape this form emits. */
function savedToEasyPost(row) {
  return {
    street1: row.line1 ?? "",
    street2: row.line2 ?? "",
    city: row.city ?? "",
    state: row.region ?? "",
    zip: row.postal_code ?? "",
    country: row.country ?? "US",
  };
}

/** True when every required field is present (the parent gates the fetch on this). */
function isComplete(a) {
  return !!(a.street1 && a.city && a.state && a.zip && a.country);
}

const AddressForm = ({ onAddressChange, suggestion }) => {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  // "saved" | "new"
  const [mode, setMode] = useState("new");
  const [selectedSavedId, setSelectedSavedId] = useState(null);
  const [form, setForm] = useState(EMPTY_ADDRESS);

  // Avoid re-emitting an identical address (the parent debounces, but a stable
  // reference keeps the effect there cheap).
  const lastEmitted = useRef("");

  // Load saved addresses once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getSavedAddresses();
        if (cancelled) return;
        setSavedAddresses(rows);
        if (rows.length > 0) {
          // Default to the picker on the (default-first) saved address.
          const first = rows[0];
          setMode("saved");
          setSelectedSavedId(first.id);
          setForm(savedToEasyPost(first));
        }
      } catch {
        // degrade to the new-address form
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lift the current address up whenever it is complete (and actually changed).
  useEffect(() => {
    if (!isComplete(form)) return;
    const key = JSON.stringify(form);
    if (key === lastEmitted.current) return;
    lastEmitted.current = key;
    onAddressChange?.(form);
  }, [form, onAddressChange]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePickSaved = (row) => {
    setMode("saved");
    setSelectedSavedId(row.id);
    setForm(savedToEasyPost(row));
  };

  const handleEnterNew = () => {
    setMode("new");
    setSelectedSavedId(null);
    setForm(EMPTY_ADDRESS);
  };

  // Apply a server verification suggestion into the form (and switch to the
  // editable new-address view so the user sees what was applied).
  const applySuggestion = () => {
    if (!suggestion) return;
    const next = {
      street1: suggestion.street1 ?? "",
      street2: suggestion.street2 ?? "",
      city: suggestion.city ?? "",
      state: suggestion.state ?? "",
      zip: suggestion.zip ?? "",
      country: suggestion.country ?? form.country ?? "US",
    };
    setMode("new");
    setSelectedSavedId(null);
    setForm(next);
  };

  const showPicker = savedAddresses.length > 0;
  const showForm = mode === "new";

  return (
    <div className="address-form">
      <h6 className="text-lg mb-24">Shipping address</h6>

      {/* Saved-address picker (only when the session has saved rows). */}
      {showPicker && (
        <div className="mb-24">
          {savedAddresses.map((row) => (
            <div
              key={row.id}
              className="form-check common-check common-radio py-12 mb-0"
            >
              <input
                className="form-check-input"
                type="radio"
                name="saved-address"
                id={`saved-address-${row.id}`}
                checked={mode === "saved" && selectedSavedId === row.id}
                onChange={() => handlePickSaved(row)}
              />
              <label
                className="form-check-label fw-normal text-neutral-600"
                htmlFor={`saved-address-${row.id}`}
              >
                {row.line1}
                {row.line2 ? `, ${row.line2}` : ""}, {row.city}, {row.region}{" "}
                {row.postal_code}, {row.country}
                {row.is_default ? " (default)" : ""}
              </label>
            </div>
          ))}
          <div className="form-check common-check common-radio py-12 mb-0">
            <input
              className="form-check-input"
              type="radio"
              name="saved-address"
              id="saved-address-new"
              checked={mode === "new"}
              onChange={handleEnterNew}
            />
            <label
              className="form-check-label fw-normal text-neutral-600"
              htmlFor="saved-address-new"
            >
              Enter a new address
            </label>
          </div>
        </div>
      )}

      {loadingSaved && !showPicker && (
        <p className="text-gray-500 mb-24">Loading saved addresses…</p>
      )}

      {/* Address verification suggestion (lifted down from the parent quote). */}
      {suggestion && (
        <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16 mb-24">
          <p className="text-gray-900 fw-medium mb-8">
            We couldn&apos;t verify that address. Did you mean:
          </p>
          <p className="text-gray-700 mb-12">
            {suggestion.street1}
            {suggestion.street2 ? `, ${suggestion.street2}` : ""},{" "}
            {suggestion.city}, {suggestion.state} {suggestion.zip},{" "}
            {suggestion.country}
          </p>
          <button
            type="button"
            className="btn btn-main py-12 px-24 rounded-8"
            onClick={applySuggestion}
          >
            Use suggested address
          </button>
        </div>
      )}

      {/* New-address form (US/CA). */}
      {showForm && (
        <div className="row gy-3">
          <div className="col-12">
            <input
              type="text"
              className="common-input border-gray-100"
              placeholder="House number and street name"
              value={form.street1}
              onChange={(e) => updateField("street1", e.target.value)}
            />
          </div>
          <div className="col-12">
            <input
              type="text"
              className="common-input border-gray-100"
              placeholder="Apartment, suite, unit, etc. (Optional)"
              value={form.street2}
              onChange={(e) => updateField("street2", e.target.value)}
            />
          </div>
          <div className="col-12">
            <input
              type="text"
              className="common-input border-gray-100"
              placeholder="City"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="col-sm-6 col-xs-12">
            <input
              type="text"
              className="common-input border-gray-100"
              placeholder="State / Province"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
            />
          </div>
          <div className="col-sm-6 col-xs-12">
            <input
              type="text"
              className="common-input border-gray-100"
              placeholder="Postal / ZIP code"
              value={form.zip}
              onChange={(e) => updateField("zip", e.target.value)}
            />
          </div>
          <div className="col-12">
            <select
              className="common-input border-gray-100"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressForm;
