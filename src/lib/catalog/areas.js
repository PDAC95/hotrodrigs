/**
 * Truck areas — the physical-area taxonomy for browsing the catalog
 * (products.area tag, seeded by 20260710160000_truck_areas.sql).
 *
 * Shared by the header nav, /search (?area=), and future home "Shop by Truck
 * Area" rows. Pure data, importable from client and server.
 */
export const TRUCK_AREAS = [
  { slug: "front", name: "Front" },
  { slug: "rear", name: "Rear" },
  { slug: "side", name: "Side" },
  { slug: "cab", name: "Cab & Roof" },
  { slug: "interior", name: "Interior" },
  { slug: "wheels", name: "Wheels & Axles" },
  { slug: "engine", name: "Engine Bay" },
  { slug: "trailer", name: "Trailer" },
];

export function areaName(slug) {
  return TRUCK_AREAS.find((a) => a.slug === slug)?.name ?? null;
}
