import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  ensureLandingVisitorCookie,
  isLandingLabPublicPath,
} from "@/features/landing-lab/server/lp-visitor-cookie";

/**
 * Next.js 16 Proxy entry point for session cookie management and first-party
 * Landing Lab visitor keys. Public /lp traffic does not run admin auth.
 */
export async function proxy(request: NextRequest) {
  if (isLandingLabPublicPath(request.nextUrl.pathname)) {
    return ensureLandingVisitorCookie(request);
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*", "/lp/:path*"],
};
