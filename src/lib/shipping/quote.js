import "server-only";

import { parcelProvider } from "./providers/parcel";
import { freightProvider } from "./providers/freight";
import { flatRateForWeight } from "./flat-rate";
import { QUOTE_TIMEOUT_MS, QUOTE_CACHE_TTL_MS } from "./config";

/**
 * quoteCart — the single server-side quote orchestrator (consumed by the
 * /api/shipping/quote route and, later, Phase 6 payment).
 *
 * Responsibilities (all rate policy lives here, never on the client):
 *  - Partition cart lines into parcel vs freight (ltl_flag/oversized) BEFORE
 *    building the box (Pitfall 3).
 *  - Race the parcel call against QUOTE_TIMEOUT_MS; on timeout OR any EasyPost
 *    error, fall back to a flat weight-tier estimate flagged estimated:true so
 *    checkout never dead-ends (SHIP-04 / RESEARCH Pattern 5).
 *  - Return the freight bucket separately (manual quote, never "no shipping").
 *  - Cache the computed quote by cacheKey within QUOTE_CACHE_TTL_MS so identical
 *    (cart+address) requests don't re-bill EasyPost (Pitfall 7).
 *
 * Server-only: sits behind the EasyPost client + cart-read leak-gate.
 */

/** Module-level cache: cacheKey -> { ts:number, value:object }. */
const quoteCache = new Map();

/** Sum parcel weight in POUNDS (weight * effective_qty) for the flat-tier fallback. */
function totalParcelLb(parcelLines) {
  return parcelLines.reduce(
    (sum, l) => sum + (Number(l.weight) || 0) * (Number(l.effective_qty) || 0),
    0
  );
}

/**
 * Race the parcel provider against a hard timeout. On a timeout or any EasyPost
 * error, return a flat-tier estimate ({estimated:true}) instead of throwing.
 */
async function raceParcel(parcelLines, toAddress) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("easypost_timeout")),
      QUOTE_TIMEOUT_MS
    );
  });

  try {
    const result = await Promise.race([
      parcelProvider.quote(parcelLines, toAddress),
      timeout,
    ]);
    return result;
  } catch (err) {
    const totalLb = totalParcelLb(parcelLines);
    return {
      estimated: true,
      options: [flatRateForWeight(totalLb)],
      reason: err?.message ?? "parcel_quote_failed",
    };
  } finally {
    // Never leak the timer when the parcel call wins (or fails).
    clearTimeout(timer);
  }
}

/**
 * Quote an entire cart.
 *
 * @param {object} params
 * @param {object[]} params.lines - shipping lines from cart-read (parcel + freight mixed)
 * @param {object} params.toAddress - EasyPost-shaped destination address
 * @param {string} params.cacheKey - stable hash of (cart lines + address); changing
 *   either invalidates the cache.
 * @returns {Promise<{parcel:object, freight:object|null, estimated:boolean}>}
 */
export async function quoteCart({ lines, toAddress, cacheKey }) {
  const all = Array.isArray(lines) ? lines : [];

  // Empty cart — valid, non-estimated empty parcel.
  if (all.length === 0) {
    return { parcel: { estimated: false, options: [] }, freight: null, estimated: false };
  }

  // Cache hit (within TTL) — return the prior quote, no re-bill (Pitfall 7).
  if (cacheKey) {
    const hit = quoteCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < QUOTE_CACHE_TTL_MS) {
      return hit.value;
    }
  }

  // Partition BEFORE building the box (Pitfall 3).
  const parcelLines = all.filter((l) => !(l.ltl_flag || l.oversized));
  const freightLines = all.filter((l) => l.ltl_flag || l.oversized);

  const freight = await freightProvider.quote(freightLines);
  const parcelResult = await raceParcel(parcelLines, toAddress);

  const value = {
    parcel: parcelResult,
    freight,
    estimated: !!parcelResult.estimated,
  };

  if (cacheKey) {
    quoteCache.set(cacheKey, { ts: Date.now(), value });
  }

  return value;
}
