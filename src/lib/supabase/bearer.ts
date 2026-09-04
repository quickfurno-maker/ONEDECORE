import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/config/env";
import type { Database } from "@/types/database.generated";

/**
 * Creates a Supabase client authenticated by a caller-supplied access token.
 *
 * WHY THIS EXISTS
 *
 * Every other server client in this app resolves the caller from cookies, which
 * is correct for the browser workspace but unusable from a native client. The
 * ONEDECORE Owner mobile app holds a Supabase session of its own and can present
 * its access token, so the canonical CRM read models can run for that caller
 * without duplicating any of their logic in Android.
 *
 * WHAT IT IS NOT
 *
 * It is NOT a privilege escalation. It uses the same publishable key as the
 * browser client and simply forwards the caller's own bearer token, so:
 *
 *   - `auth.uid()` is the mobile user, not a service account
 *   - every RLS policy applies exactly as it does on the web
 *   - `authorize(...)` probes resolve that user's real permissions
 *
 * The service-role client stays where it is. Nothing here bypasses it, and
 * nothing here should ever be given `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Session persistence and auto-refresh are disabled because this client lives
 * for exactly one request: there is no storage to persist into, and refreshing
 * a token the caller owns is the caller's job.
 */
export function createBearerClient(accessToken: string) {
  const { url, publishableKey } = getPublicSupabaseEnv();

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Extracts a bearer token from a request's Authorization header.
 *
 * Returns null rather than throwing so callers can answer with their own
 * canonical "unauthenticated" shape instead of a stack trace. The scheme match
 * is case-insensitive because HTTP auth schemes are, and the token itself is
 * never logged.
 */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();

  return token ? token : null;
}
