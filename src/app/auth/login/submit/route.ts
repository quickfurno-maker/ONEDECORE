import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/config/env";
import {
  handleStaffLoginSubmit,
  type LoginCookieAdapter,
  type LoginSupabaseClient,
} from "@/features/staff-admin/server/staff-login-submit";
import type { Database } from "@/types/database.generated";

/**
 * The single production login mutation authority.
 *
 * Deliberately a Route Handler rather than a Server Action: the session cookies
 * must ride on an ordinary HTTP response the browser is guaranteed to honour.
 * See `staff-login-submit.ts` for the production evidence behind that.
 *
 * This file stays thin on purpose — it wires the real Supabase client to the
 * flow and nothing else, so the flow itself is testable with a double. It lives
 * at /auth/login/submit rather than /auth/login so it cannot collide with the
 * page route.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { url, publishableKey } = getPublicSupabaseEnv();

  return handleStaffLoginSubmit(request, (adapter: LoginCookieAdapter) => {
    // The publishable key, exactly as everywhere else. No service role: the
    // caller authenticates as themselves and RLS applies from the first read.
    const client = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll: () => adapter.getAll(),
        // Captured, not written to a throwaway response. The flow applies them
        // to the response it actually returns.
        setAll: (cookiesToSet) => adapter.setAll(cookiesToSet),
      },
    });

    return client as unknown as LoginSupabaseClient;
  });
}
