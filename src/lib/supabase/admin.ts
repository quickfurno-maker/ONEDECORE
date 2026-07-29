import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getLeadIntakeServerEnv } from "../../config/server-env.ts";
import type { Database } from "../../types/database.generated.ts";

/**
 * Server-only Supabase administrative client (service role).
 * Never import from Client Components. No cookie/session storage.
 */
export function createAdminClient() {
  const env = getLeadIntakeServerEnv();
  if (!env.serviceRoleKey) {
    throw new Error(
      "[ONEDECORE Admin] Service-role key unavailable in current lead intake mode."
    );
  }

  return createClient<Database>(env.supabaseUrl!, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
