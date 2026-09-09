/**
 * ONEDECORE Public Environment Configuration
 * Validates public Supabase configuration values at runtime without logging credential values.
 */

import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "@/lib/supabase/runtime-target";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[ONEDECORE Env Error] Missing required public environment variable: ${name}`
    );
  }
  return value.trim();
}

/**
 * THE PRODUCTION TARGET RULE, WITH THE LOOPBACK ESCAPE CLOSED.
 *
 * This used to compute `isLocal` as "hostname is loopback OR NODE_ENV is not
 * production", and then skip the managed-host check whenever `isLocal` was
 * true. The first half of that disjunction had no NODE_ENV condition, so a
 * loopback hostname disabled the check IN PRODUCTION TOO: a production build
 * configured with `http://127.0.0.1:54321` would have been accepted here and
 * handed to the browser and cookie-scoped clients without complaint.
 *
 * The predicates are the shared ones, so the browser client, the server
 * client and the service-role client now agree on what "the database" is.
 */
function validateSupabaseUrl(urlStr: string): string {
  if (isManagedOneDecoreSupabaseUrl(urlStr)) {
    return new URL(urlStr).origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[ONEDECORE Env Error] NEXT_PUBLIC_SUPABASE_URL must be the managed ONEDECORE Supabase project.`
    );
  }

  if (isLoopbackSupabaseUrl(urlStr)) {
    return new URL(urlStr).origin;
  }

  throw new Error(
    `[ONEDECORE Env Error] NEXT_PUBLIC_SUPABASE_URL must be the managed ONEDECORE project, or a loopback stack outside production.`
  );
}

function validatePublishableKey(keyStr: string): string {
  const isLocal = keyStr.startsWith("eyJ") || process.env.NODE_ENV !== "production";
  if (!keyStr.startsWith("sb_publishable_") && !isLocal) {
    throw new Error(
      `[ONEDECORE Env Error] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must begin with 'sb_publishable_' prefix.`
    );
  }
  return keyStr;
}

export function getPublicSupabaseEnv(): {
  url: string;
  publishableKey: string;
} {
  const rawUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const rawKey = getEnvVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return {
    url: validateSupabaseUrl(rawUrl),
    publishableKey: validatePublishableKey(rawKey),
  };
}
