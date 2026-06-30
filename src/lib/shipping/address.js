import "server-only";

import { easypost } from "./easypost-client";

/**
 * Supabase <-> EasyPost address mapping + the EasyPost delivery-verification
 * wrapper. THE single place the field mapping lives (Pitfall 4) — every caller
 * (05-02 quote orchestrator, 05-03 checkout form) goes through here so the
 * line1/region/postal_code -> street1/state/zip translation is never duplicated.
 *
 * Locked geographic scope: country in {"US","CA"}.
 */

/**
 * Map a Supabase `addresses` row to the EasyPost address shape.
 *   line1 -> street1, line2 -> street2, region -> state, postal_code -> zip.
 *
 * Idempotent: if the input already looks EasyPost-shaped (has `street1`), it is
 * passed through (normalized) rather than re-mapped, so callers can hand us
 * either shape. Country defaults to "US".
 *
 * @param {object} dbAddress - a raw `addresses` row OR an EasyPost-shaped object
 * @returns {{street1:string, street2:string, city:string, state:string, zip:string, country:string}}
 */
export function toEasyPostAddress(dbAddress) {
  const a = dbAddress || {};
  // Already EasyPost-shaped — pass through (idempotent).
  if (a.street1 !== undefined && a.line1 === undefined) {
    return {
      street1: a.street1 ?? "",
      street2: a.street2 ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      zip: a.zip ?? "",
      country: a.country ?? "US",
    };
  }
  return {
    street1: a.line1 ?? "",
    street2: a.line2 ?? "",
    city: a.city ?? "",
    state: a.region ?? "",
    zip: a.postal_code ?? "",
    country: a.country ?? "US",
  };
}

/**
 * Inverse mapping: an EasyPost-shaped (or normalized suggestion) address back to
 * the Supabase `addresses` column shape, so a verification suggestion can
 * repopulate the DB-shaped checkout form.
 *   street1 -> line1, street2 -> line2, state -> region, zip -> postal_code.
 *
 * @param {object} addr - EasyPost-shaped address
 * @returns {{line1:string, line2:string, city:string, region:string, postal_code:string, country:string}}
 */
export function fromEasyPostSuggestion(addr) {
  const a = addr || {};
  return {
    line1: a.street1 ?? "",
    line2: a.street2 ?? "",
    city: a.city ?? "",
    region: a.state ?? "",
    postal_code: a.zip ?? "",
    country: a.country ?? "US",
  };
}

/**
 * Verify a destination address against EasyPost (delivery verification).
 * Never throws: a bad address or an EasyPost error returns a structured
 * { verified:false, errors:[...] } so the 05-02 caller never crashes.
 *
 * @param {{street1:string, street2?:string, city:string, state:string, zip:string, country:"US"|"CA"}} input
 * @returns {Promise<{verified:boolean, errors:object[], suggestion:object|null, address_id:string|null}>}
 */
export async function verifyAddress(input) {
  const i = input || {};
  try {
    const address = await easypost.Address.create({
      verify: ["delivery"],
      street1: i.street1,
      street2: i.street2 ?? "",
      city: i.city,
      state: i.state,
      zip: i.zip,
      country: i.country,
    });

    const v = address?.verifications?.delivery;
    return {
      verified: !!v?.success,
      errors: v?.errors ?? [],
      // Normalized fields EasyPost echoes back on the address itself.
      suggestion: {
        street1: address?.street1 ?? "",
        street2: address?.street2 ?? "",
        city: address?.city ?? "",
        state: address?.state ?? "",
        zip: address?.zip ?? "",
        country: address?.country ?? i.country ?? "US",
      },
      address_id: address?.id ?? null,
    };
  } catch (err) {
    return {
      verified: false,
      errors: [{ message: err?.message ?? "Address verification failed" }],
      suggestion: null,
      address_id: null,
    };
  }
}
