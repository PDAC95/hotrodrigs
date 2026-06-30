"use server";

/**
 * Server Actions for the checkout shipping step (05-03).
 *
 * The ONLY server surface the AddressForm picker consumes. Reads run on the
 * RLS-enforced cookie client (createClient from @/lib/supabase/server) — NEVER
 * the service-role admin client — so the `addresses` table's owner-scoped RLS
 * policy decides what a session can see. A guest session (no auth.uid()) yields
 * zero rows, so the picker degrades to the new-address form with no extra branch.
 */

import { createClient } from "@/lib/supabase/server";

/**
 * Read the current user's saved shipping addresses (default first).
 *
 * RLS does the authorization: logged-in users get their own rows; guests get [].
 * Returns the DB column shape ({ id, line1, line2, city, region, postal_code,
 * country, is_default }) — the AddressForm maps region->state / postal_code->zip
 * to the EasyPost shape via the same field names address.js expects before it
 * posts to /api/shipping/quote.
 *
 * Never throws on a query error: a transient failure degrades to [] (the form
 * still works as a new-address entry).
 *
 * @returns {Promise<Array<{id:number, line1:string, line2:string|null, city:string, region:string, postal_code:string, country:string, is_default:boolean}>>}
 */
export async function getSavedAddresses() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("addresses")
      .select("id, line1, line2, city, region, postal_code, country, is_default")
      .order("is_default", { ascending: false });

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
