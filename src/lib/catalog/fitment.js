import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * All truck makes for the "My Truck" Make dropdown (SRCH-03).
 * Returns: [{ id, name }] ordered by name (10 makes).
 */
export async function getMakes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truck_makes")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * Models for a given make — the dependent Model dropdown of the cascade (SRCH-03).
 * Returns: [{ id, name }] ordered by name.
 */
export async function getModelsByMake(makeId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("truck_models")
    .select("id, name")
    .eq("make_id", makeId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
