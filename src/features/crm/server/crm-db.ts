import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The Supabase client shape every CRM server read runs against.
 *
 * CRM queries have always created their own cookie-scoped client. That is right
 * for the browser workspace and unusable from a native client, so the read
 * chain now accepts an OPTIONAL client instead.
 *
 * Existing callers pass nothing and behave exactly as before. The mobile read
 * endpoints pass a bearer-authenticated client for the same user, which lets
 * the canonical score, bucket and ranking logic run once and serve both UIs.
 *
 * The injected client is always a caller-scoped client — never service-role —
 * so RLS and `authorize(...)` resolve against the real user either way.
 */
export type CrmDb = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolves the client a CRM read should use: the injected one when a caller
 * supplied it, otherwise the cookie-scoped default.
 */
export async function resolveCrmDb(db?: CrmDb): Promise<CrmDb> {
  return db ?? (await createClient());
}
