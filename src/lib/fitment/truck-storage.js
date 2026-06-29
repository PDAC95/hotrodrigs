"use client";

/**
 * localStorage helpers for the persistent "My Truck" selection (SRCH-03).
 *
 * The selected truck follows the customer across visits on the same device.
 * Every accessor is guarded by `typeof window !== "undefined"` so it is a no-op
 * during SSR (Pitfall 3): the selector is a client island, and the truck used for
 * server-side FILTERING flows through the URL (?truck_model=ID), not this store.
 *
 * Stored shape (JSON under the `STORAGE_KEY`):
 *   { makeId, makeName, modelId, modelName }
 */

const STORAGE_KEY = "hrr.mytruck";

/**
 * Read the persisted truck.
 * @returns {{ makeId:number, makeName:string, modelId:number, modelName:string } | null}
 */
export function getStoredTruck() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Minimal shape guard: a full truck needs a model.
    if (!parsed || parsed.modelId == null) return null;
    return parsed;
  } catch {
    // Corrupt/blocked storage -> treat as no selection.
    return null;
  }
}

/**
 * Persist the chosen truck.
 * @param {{ makeId:number, makeName:string, modelId:number, modelName:string }} truck
 */
export function setStoredTruck(truck) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(truck));
  } catch {
    // Storage full or blocked (private mode) -> selection lives only in URL/state.
  }
}

/** Remove the persisted truck. */
export function clearStoredTruck() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { STORAGE_KEY };
