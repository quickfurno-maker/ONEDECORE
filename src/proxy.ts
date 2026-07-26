import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy entry point for session cookie management.
 *
 * Public Portfolio page, service and slug validation deliberately lives in the
 * route files under src/app/portfolio, not here. Routes own their own 404
 * contract so it holds regardless of matcher configuration.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};
