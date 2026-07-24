import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/config/env";

/**
 * Creates a browser-scoped Supabase client instance.
 * Safe for use in Client Components.
 */
export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
