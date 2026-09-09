import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveSupabaseRuntimeTarget } from "./runtime-target.ts";

/**
 * The canonical fail-closed service-role client.
 *
 * WHAT CHANGED AND WHY IT MATTERED
 *
 * This factory used to accept ANY URL that parsed as http or https. It checked
 * the protocol and nothing else — not the host, not the project. Ten
 * production modules build privileged clients through it (quotations,
 * commerce, projects, the campaign dispatcher), and a service-role key bypasses
 * RLS completely. So a mistyped, stale or swapped `NEXT_PUBLIC_SUPABASE_URL`
 * would have handed an unrestricted credential to whatever host was configured,
 * with no error and no signal.
 *
 * The target is now validated by `runtime-target.ts`: in production, the
 * managed ONEDECORE project or nothing; outside production, that or a strict
 * loopback stack. The check is the same one the lead-intake environment
 * applies, so the two clients can no longer disagree about where "the database"
 * is.
 *
 * WHAT IT STILL DOES NOT DO
 *
 * It does not consult lead-intake activation, consent versions or processor
 * readiness. Those gate whether a LEAD may be accepted, not whether a
 * quotation PDF may read its own rows, and coupling them was what made two
 * factories necessary in the first place.
 */

function readRequired(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  name: string
): string {
  const value = env[name];
  if (value == null || value.trim() === "") {
    throw new Error(
      `[ONEDECORE Admin] Missing required environment variable ${name}.`
    );
  }
  return value.trim();
}

export function createAdminClient(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
) {
  const supabaseUrl = resolveSupabaseRuntimeTarget(env);
  const serviceRoleKey = readRequired(env, "SUPABASE_SERVICE_ROLE_KEY");

  /*
   * A publishable key in the service-role slot is a configuration mistake that
   * fails LATER and confusingly — as a row-level permission error deep inside
   * an unrelated feature — so it is refused here, by shape, at the boundary.
   */
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "[ONEDECORE Admin] Publishable key rejected in SUPABASE_SERVICE_ROLE_KEY slot."
    );
  }

  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable && serviceRoleKey === publishable) {
    throw new Error(
      "[ONEDECORE Admin] Service-role slot must not repeat the publishable key."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
