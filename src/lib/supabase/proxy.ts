import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/config/env";
import type { Database } from "@/types/database.generated";

/**
 * Updates session cookies and enforces authentication checks for Next.js 16 Proxy / Middleware.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, publishableKey } = getPublicSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh claims immediately after client creation for verified identity
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && !!data?.claims?.sub;
  const pathname = request.nextUrl.pathname;

  // Authentication check for /admin routes
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/auth/login", request.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("next", pathname);
      }
      const redirectResponse = NextResponse.redirect(loginUrl);

      // Preserve refreshed cookies on redirect response
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectResponse;
    }
  }

  // Redirect authenticated staff away from login form to admin portal
  if (pathname === "/auth/login" && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const safeTarget = nextParam && nextParam.startsWith("/admin") && !nextParam.startsWith("/admin//")
      ? nextParam
      : "/admin";

    const redirectResponse = NextResponse.redirect(new URL(safeTarget, request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
