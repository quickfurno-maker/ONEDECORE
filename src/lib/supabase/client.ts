import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/config/env";
import type { Database } from "@/types/database.generated";

/**
 * Creates a browser-scoped Supabase client instance using generated Database types.
 * Safe for use in Client Components.
 */
export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
