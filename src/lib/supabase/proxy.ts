import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/config/env";
import { DEFAULT_LOGIN_PORTAL } from "@/features/staff-admin/contracts/login-portal";
import type { Database } from "@/types/database.generated";

/**
 * Session cookie refresh and admin authentication for the Next.js 16 Proxy.
 *
 * THE RESPONSE HEADERS MATTER AS MUCH AS THE COOKIES
 *
 * `@supabase/ssr` 0.12.3 calls `setAll(cookiesToSet, headers)`, and documents
 * the second argument as part of the contract, not decoration:
 *
 *   "Responses that set auth cookies must not be cached by CDNs or reverse
 *    proxies, otherwise one user's session token can be served to a different
 *    user."
 *
 * It supplies `Cache-Control: private, no-cache, no-store, must-revalidate,
 * max-age=0`, `Expires: 0` and `Pragma: no-cache`. Declaring only the first
 * parameter made JavaScript discard them silently — and this module refreshes
 * tokens on EVERY /admin request, so it is the highest-volume producer of
 * session-bearing responses in the app.
 *
 * Both are therefore tracked together and re-applied on every return path: the
 * ordinary `next()` response and both redirect branches. A refreshed token that
 * reaches the browser without its no-store policy is exactly the cacheable
 * session response the library warns about.
 */

/** The Supabase surface this module uses, so tests can supply a double. */
export interface ProxyCookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(
    cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
    headers: Record<string, string>
  ): void;
}

export interface ProxySupabaseClient {
  readonly auth: {
    getClaims(): Promise<{
      data: { claims?: { sub?: string | null } | null } | null;
      error: unknown;
    }>;
  };
}

export type ProxyClientFactory = (
  adapter: ProxyCookieAdapter
) => ProxySupabaseClient;

function defaultProxyClient(adapter: ProxyCookieAdapter): ProxySupabaseClient {
  const { url, publishableKey } = getPublicSupabaseEnv();

  // The publishable key, as everywhere else. No service role here: the Proxy
  // resolves the caller's own claims and grants nothing on its own.
  const client = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => adapter.getAll(),
      // BOTH arguments forwarded — see the module docblock.
      setAll: (cookiesToSet, headers) => adapter.setAll(cookiesToSet, headers),
    },
  });

  return client as unknown as ProxySupabaseClient;
}

/**
 * Updates session cookies and enforces authentication for /admin routes.
 *
 * The client factory is injectable so the cookie AND header propagation can be
 * exercised in tests without a live GoTrue; production passes nothing.
 */
export async function updateSession(
  request: NextRequest,
  createClientWithCookies: ProxyClientFactory = defaultProxyClient
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  /*
   * The headers Supabase supplied alongside the refreshed cookies.
   *
   * Held outside `setAll` because `supabaseResponse` is REPLACED in there — a
   * header set on the old object would be discarded with it — and because both
   * redirect branches below build responses of their own that must carry the
   * same auth state.
   */
  const authResponseHeaders: Record<string, string> = {};

  const applyAuthHeaders = (response: NextResponse): NextResponse => {
    for (const [name, value] of Object.entries(authResponseHeaders)) {
      // Verbatim: the library's values are never normalised or weakened.
      response.headers.set(name, value);
    }
    return response;
  };

  /**
   * Carries the refreshed session onto a response built separately.
   *
   * Copies exactly two things — the auth cookies and the headers Supabase
   * supplied — rather than cloning the whole header set, so no internal Next
   * transport header is dragged onto a redirect.
   */
  const copySupabaseResponseState = (target: NextResponse): NextResponse => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      target.cookies.set(cookie.name, cookie.value, cookie);
    });
    return applyAuthHeaders(target);
  };

  const supabase = createClientWithCookies({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet, headers) {
      // Downstream Server Components read the refreshed values from the request.
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value)
      );
      supabaseResponse = NextResponse.next({
        request,
      });
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
      );

      Object.assign(authResponseHeaders, headers ?? {});
      applyAuthHeaders(supabaseResponse);
    },
  });

  // Refresh claims immediately after client creation for verified identity
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && !!data?.claims?.sub;
  const pathname = request.nextUrl.pathname;

  // Authentication check for /admin routes
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      /*
       * Name the portal.
       *
       * `/admin` is the Super Admin entry point, and sending the owner to a page
       * branded "Staff Portal" — which then asks for a 10-digit mobile — is the
       * whole incident this fixes. The redirect now says which identity contract
       * the visitor is being asked for.
       */
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("portal", DEFAULT_LOGIN_PORTAL);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("next", pathname);
      }

      // Preserve refreshed cookies AND their no-store headers on the redirect.
      return copySupabaseResponseState(NextResponse.redirect(loginUrl));
    }
  }

  // Redirect authenticated staff away from login form to admin portal
  if (pathname === "/auth/login" && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const safeTarget = nextParam && nextParam.startsWith("/admin") && !nextParam.startsWith("/admin//")
      ? nextParam
      : "/admin";

    return copySupabaseResponseState(
      NextResponse.redirect(new URL(safeTarget, request.url))
    );
  }

  return supabaseResponse;
}
