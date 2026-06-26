import "server-only"; // build error if imported into client code
import { createClient } from "@supabase/supabase-js";

// Service-role client (Pattern 3). Bypasses RLS — server-only modules only.
// Reads server-only SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (never the public-prefixed vars).
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
