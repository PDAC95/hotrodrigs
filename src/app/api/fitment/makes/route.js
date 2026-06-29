import { getMakes } from "@/lib/catalog/fitment";

/**
 * GET /api/fitment/makes  ->  { makes: [{ id, name }] }
 *
 * Seeds the Make dropdown of the "My Truck" cascade (SRCH-03). HeaderTwo is a
 * client component, so the selector fetches makes on mount via this tiny handler
 * (the plan's stated alternative to a server prop). Keeps the catalog query on
 * the server-only fitment data layer, off the client bundle.
 */
export async function GET() {
  const makes = await getMakes();
  return Response.json({ makes });
}
