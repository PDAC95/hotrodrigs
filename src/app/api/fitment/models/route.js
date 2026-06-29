import { getModelsByMake } from "@/lib/catalog/fitment";

/**
 * GET /api/fitment/models?make=<id>  ->  { models: [{ id, name }] }
 *
 * Feeds the dependent Model dropdown of the "My Truck" cascade (SRCH-03).
 * Runs server-side over the server-only fitment data layer so the catalog
 * queries never reach the client. Missing/blank `make` -> empty list.
 */
export async function GET(request) {
  const make = new URL(request.url).searchParams.get("make");
  if (!make) return Response.json({ models: [] });

  const makeId = Number(make);
  if (!Number.isFinite(makeId)) return Response.json({ models: [] });

  const models = await getModelsByMake(makeId);
  return Response.json({ models });
}
