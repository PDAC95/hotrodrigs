/**
 * Shipping module configuration — tunable constants + the single ship-from origin.
 *
 * Pure constants (no DB, no API key, no "server-only" needed). Imported by both
 * the EasyPost client (timeouts) and the rate/parcel logic (tiers, conversion).
 * The origin and tiers live here so 05-02's orchestrator + 05-03's UI never
 * hard-code a warehouse address or a fallback price.
 */

/**
 * The single fixed warehouse ship-from. Read from env with sane fallbacks so
 * quotes work locally before SHIP_FROM_* env is set.
 *
 * PRODUCTION NOTE: the placeholder below is a real, deliverable US address
 * (EasyPost rates against it cleanly) but it is NOT the real Hot Rod Rigs
 * warehouse — set SHIP_FROM_STREET1/CITY/STATE/ZIP in the environment before
 * shipping real orders.
 */
export const ORIGIN_ADDRESS = {
  name: process.env.SHIP_FROM_NAME || "Hot Rod Rigs",
  street1: process.env.SHIP_FROM_STREET1 || "1600 Amphitheatre Pkwy",
  city: process.env.SHIP_FROM_CITY || "Mountain View",
  state: process.env.SHIP_FROM_STATE || "CA",
  zip: process.env.SHIP_FROM_ZIP || "94043",
  country: process.env.SHIP_FROM_COUNTRY || "US",
};

/**
 * Weight conversion. The Phase-2 catalog ETL stored weight in POUNDS and dims in
 * INCHES (Pitfall 5); EasyPost parcels expect ounces for weight. Conversion is
 * centralized here so it happens in exactly one place (parcel-builder).
 *
 * SANITY CHECK against live data: a ~10 lb part must rate ~$10-20 ground, not
 * ~$1. If quotes come back implausibly cheap, the source unit is wrong here.
 */
export const LB_TO_OZ = 16;
export const WEIGHT_SOURCE_UNIT = "lb";

/** Fallback parcel dims (inches) when a variant's dims are null/0. */
export const DEFAULT_BOX = { length: 12, width: 12, height: 6 };

/**
 * Flat weight-tier fallback table (USD) — used when EasyPost is unavailable or
 * returns no rates. Defaults are Claude's discretion; tune against real margins.
 */
export const FLAT_RATE_TIERS = [
  { maxLb: 5, amount: 9.99 },
  { maxLb: 20, amount: 19.99 },
  { maxLb: 70, amount: 39.99 },
];
export const FLAT_RATE_OVER = 59.99;

/** Server-side Promise.race ceiling for a whole quote (consumed in 05-02). */
export const QUOTE_TIMEOUT_MS = 6000;
/** Per-request timeout handed to the EasyPost client. */
export const EASYPOST_CLIENT_TIMEOUT_MS = 8000;
/** How long a computed quote stays cached server-side (consumed in 05-02). */
export const QUOTE_CACHE_TTL_MS = 60000;
