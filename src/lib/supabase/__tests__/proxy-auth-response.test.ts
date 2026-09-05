/**
 * Proxy auth-response contract.
 *
 * This module refreshes session cookies on EVERY /admin request, so it is the
 * highest-volume producer of session-bearing responses in the app.
 *
 * `@supabase/ssr` 0.12.3 calls `setAll(cookiesToSet, headers)` and documents the
 * second argument as part of the contract:
 *
 *   "Responses that set auth cookies must not be cached by CDNs or reverse
 *    proxies, otherwise one user's session token can be served to a different
 *    user."
 *
 * The Proxy previously declared only the first parameter, so JavaScript
 * discarded `Cache-Control` / `Expires` / `Pragma` silently — attaching a
 * refreshed token to a response that a cache was free to keep.
 *
 * WHAT THESE TESTS EXECUTE
 *
 * The real `updateSession`, with an injected Supabase double, asserting the
 * actual `NextResponse` on every return path: the ordinary `next()`, the
 * unauthenticated /admin redirect, and the authenticated /auth/login redirect.
 * They do NOT contact a live GoTrue, so what is proven is propagation — that
 * whatever the library hands us reaches the browser intact.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";

import {
  updateSession,
  type ProxyCookieAdapter,
  type ProxySupabaseClient,
} from "../proxy.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const PROXY = "src/lib/supabase/proxy.ts";

const ORIGIN = "https://onedecore.in";
const USER_ID = "5e1f0000-0000-4000-8000-000000000001";

/** The exact headers @supabase/ssr v0.12.3 supplies with auth cookies. */
const SUPABASE_AUTH_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

const REFRESHED_COOKIES = [
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.0",
    value: "refreshed-chunk-zero",
    options: {
      path: "/",
      sameSite: "lax" as const,
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    },
  },
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.1",
    value: "refreshed-chunk-one",
    options: {
      path: "/",
      sameSite: "lax" as const,
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    },
  },
];

interface DoubleOptions {
  readonly authenticated?: boolean;
  /** False models a request where no token refresh happened. */
  readonly refreshes?: boolean;
  readonly headers?: Record<string, string>;
}

function makeClient(options: DoubleOptions = {}) {
  const seen = { adapterGetAllCalls: 0, setAllCalls: 0 };

  const factory = (adapter: ProxyCookieAdapter): ProxySupabaseClient => ({
    auth: {
      async getClaims() {
        adapter.getAll();
        seen.adapterGetAllCalls += 1;

        if (options.refreshes !== false) {
          // Exactly how the library calls it.
          seen.setAllCalls += 1;
          adapter.setAll(REFRESHED_COOKIES, {
            ...(options.headers ?? SUPABASE_AUTH_HEADERS),
          });
        }

        if (options.authenticated === false) {
          return { data: null, error: { message: "no session" } };
        }
        return { data: { claims: { sub: USER_ID } }, error: null };
      },
    },
  });

  return { factory, seen };
}

function proxyRequest(pathname: string, search = ""): NextRequest {
  return new NextRequest(`${ORIGIN}${pathname}${search}`, {
    method: "GET",
    headers: {
      host: "onedecore.in",
      "x-forwarded-host": "onedecore.in",
      "x-forwarded-proto": "https",
    },
  });
}

function assertAuthHeaders(response: { headers: Headers }, label: string) {
  for (const [name, expected] of Object.entries(SUPABASE_AUTH_HEADERS)) {
    assert.equal(
      response.headers.get(name),
      expected,
      `${label}: ${name} must be preserved exactly`
    );
  }
}

function assertRefreshedCookies(
  response: { cookies: { get(name: string): { value: string } | undefined } },
  label: string
) {
  for (const cookie of REFRESHED_COOKIES) {
    const actual = response.cookies.get(cookie.name);
    assert.ok(actual, `${label}: ${cookie.name} missing`);
    assert.equal(actual.value, cookie.value, `${label}: ${cookie.name} value`);
  }
}

/* ========================================================================== */
/* 1. Wiring                                                                   */
/* ========================================================================== */

describe("the proxy forwards the full setAll contract", () => {
  test("createServerClient declares setAll(cookiesToSet, headers)", () => {
    const src = read(PROXY);
    assert.match(
      src,
      /setAll:\s*\(cookiesToSet,\s*headers\)\s*=>\s*adapter\.setAll\(cookiesToSet,\s*headers\)/,
      "the client wiring must forward BOTH arguments"
    );
    // And the adapter itself declares the second parameter, so a one-argument
    // call is a compile error rather than a silent drop.
    assert.match(src, /headers:\s*Record<string,\s*string>/);
  });

  test("it uses the publishable key and no service role", () => {
    const src = read(PROXY);
    assert.match(src, /publishableKey/);
    for (const forbidden of [
      "service_role",
      "SERVICE_ROLE",
      "serviceRole",
      "createAdminClient",
      "sb_secret_",
    ]) {
      assert.ok(!src.includes(forbidden), `proxy must not reference ${forbidden}`);
    }
  });

  test("getClaims still runs immediately after client creation", () => {
    const src = read(PROXY);
    const created = src.indexOf("const supabase = createClientWithCookies({");
    const claims = src.indexOf("await supabase.auth.getClaims()");
    assert.ok(created > 0 && claims > created);

    // Nothing awaited in between — the identity check stays the first thing
    // that happens with the client.
    const between = src.slice(created, claims);
    const awaits = between.match(/await /g) ?? [];
    assert.equal(awaits.length, 0, `unexpected work before getClaims: ${between.length} chars`);
  });
});

/* ========================================================================== */
/* 2. The ordinary pass-through response                                       */
/* ========================================================================== */

describe("a refreshed /admin request keeps its whole auth response state", () => {
  test("refreshed cookies reach the response", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(proxyRequest("/admin/attendance"), factory);

    assertRefreshedCookies(response, "next()");
  });

  test("Cache-Control, Expires and Pragma reach the response", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(proxyRequest("/admin/attendance"), factory);

    assertAuthHeaders(response, "next()");
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
    assert.equal(response.headers.get("expires"), "0");
    assert.equal(response.headers.get("pragma"), "no-cache");
  });

  test("the refreshed values are visible to downstream Server Components", async () => {
    // `request.cookies.set` is what the rest of the render reads.
    const request = proxyRequest("/admin");
    const { factory } = makeClient({ authenticated: true });
    await updateSession(request, factory);

    for (const cookie of REFRESHED_COOKIES) {
      assert.equal(
        request.cookies.get(cookie.name)?.value,
        cookie.value,
        `${cookie.name} must be synchronised onto the request`
      );
    }
  });

  test("cookie options survive the response rebuild", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(proxyRequest("/admin"), factory);

    const cookie = response.cookies.get(REFRESHED_COOKIES[0]!.name);
    assert.ok(cookie);
    assert.equal(cookie.path, "/");
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.secure, true);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.maxAge, 3600);
  });
});

/* ========================================================================== */
/* 3. Both redirect branches                                                   */
/* ========================================================================== */

describe("redirects carry the refreshed session too", () => {
  test("an unauthenticated /admin redirect keeps cookies AND headers", async () => {
    const { factory } = makeClient({ authenticated: false });
    const response = await updateSession(
      proxyRequest("/admin/attendance"),
      factory
    );

    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(location.pathname, "/auth/login");
    assert.equal(location.searchParams.get("next"), "/admin/attendance");

    assertRefreshedCookies(response, "unauthenticated redirect");
    assertAuthHeaders(response, "unauthenticated redirect");
  });

  test("the bare /admin redirect carries no next param, but keeps state", async () => {
    const { factory } = makeClient({ authenticated: false });
    const response = await updateSession(proxyRequest("/admin"), factory);

    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(location.pathname, "/auth/login");
    assert.equal(location.searchParams.get("next"), null);
    assertAuthHeaders(response, "bare admin redirect");
  });

  test("an authenticated /auth/login redirect keeps cookies AND headers", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(proxyRequest("/auth/login"), factory);

    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(location.pathname, "/admin");

    assertRefreshedCookies(response, "authenticated login redirect");
    assertAuthHeaders(response, "authenticated login redirect");
  });

  test("a safe next is honoured on the login redirect", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(
      proxyRequest("/auth/login", "?next=%2Fadmin%2Fattendance"),
      factory
    );

    assert.equal(
      new URL(response.headers.get("location") ?? "").pathname,
      "/admin/attendance"
    );
    assertAuthHeaders(response, "safe next redirect");
  });

  test("an unsafe next still collapses to /admin", async () => {
    for (const unsafe of ["https://evil.example", "//evil.example", "/admin//evil", "/etc"]) {
      const { factory } = makeClient({ authenticated: true });
      const response = await updateSession(
        proxyRequest("/auth/login", `?next=${encodeURIComponent(unsafe)}`),
        factory
      );

      const location = new URL(response.headers.get("location") ?? "");
      assert.equal(location.origin, ORIGIN, `${unsafe} escaped the origin`);
      assert.equal(location.pathname, "/admin", `${unsafe} was not collapsed`);
    }
  });

  test("NO proxy response that carries an auth cookie can lose the headers", async () => {
    const cases: [string, DoubleOptions, string][] = [
      ["/admin/attendance", { authenticated: true }, "authenticated next()"],
      ["/admin/attendance", { authenticated: false }, "unauthenticated redirect"],
      ["/auth/login", { authenticated: true }, "authenticated login redirect"],
    ];

    for (const [pathname, options, label] of cases) {
      const { factory } = makeClient(options);
      const response = await updateSession(proxyRequest(pathname), factory);

      assert.ok(
        response.cookies.getAll().length > 0,
        `${label}: precondition — this response sets cookies`
      );
      assertAuthHeaders(response, label);
    }
  });

  test("exact supplied values are preserved, never normalised", async () => {
    const custom = {
      "Cache-Control": "no-store, max-age=0, s-maxage=0, private",
      Expires: "Thu, 01 Jan 1970 00:00:00 GMT",
      Pragma: "no-cache",
      "X-Supabase-Marker": "kept",
    };

    for (const pathname of ["/admin", "/auth/login"]) {
      const { factory } = makeClient({ authenticated: true, headers: custom });
      const response = await updateSession(proxyRequest(pathname), factory);

      for (const [name, expected] of Object.entries(custom)) {
        assert.equal(
          response.headers.get(name),
          expected,
          `${pathname}: ${name} must be passed through verbatim`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 4. Auth semantics are unchanged                                             */
/* ========================================================================== */

describe("authentication behaviour is unchanged", () => {
  test("an authenticated /admin request is allowed through", async () => {
    const { factory } = makeClient({ authenticated: true });
    const response = await updateSession(proxyRequest("/admin/attendance"), factory);

    // Not a redirect: the request proceeds.
    assert.equal(response.headers.get("location"), null);
    assert.ok(response.status < 300);
  });

  test("a non-admin, non-login path is untouched by the auth gate", async () => {
    const { factory } = makeClient({ authenticated: false });
    const response = await updateSession(proxyRequest("/auth/forbidden"), factory);

    assert.equal(response.headers.get("location"), null);
  });

  test("an unauthenticated /auth/login request is not redirected", async () => {
    const { factory } = makeClient({ authenticated: false });
    const response = await updateSession(proxyRequest("/auth/login"), factory);

    assert.equal(response.headers.get("location"), null);
  });

  test("a request with no refresh still behaves correctly", async () => {
    // No setAll call at all — nothing to preserve, and nothing should break.
    const { factory, seen } = makeClient({ authenticated: true, refreshes: false });
    const response = await updateSession(proxyRequest("/admin"), factory);

    assert.equal(seen.setAllCalls, 0);
    assert.equal(response.cookies.getAll().length, 0);
    assert.equal(response.headers.get("location"), null);
  });
});

/* ========================================================================== */
/* 5. Containment                                                              */
/* ========================================================================== */

describe("nothing else changed", () => {
  test("the proxy entry point and matcher are untouched", () => {
    const entry = read("src/proxy.ts");
    assert.match(entry, /updateSession\(request\)/);
    assert.match(entry, /matcher: \["\/admin\/:path\*", "\/auth\/:path\*", "\/lp\/:path\*"\]/);
  });

  test("the login route correction is intact", () => {
    const route = read("src/app/auth/login/submit/route.ts");
    assert.match(
      route,
      /setAll:\s*\(cookiesToSet,\s*headers\)\s*=>\s*adapter\.setAll\(cookiesToSet,\s*headers\)/
    );
  });

  test("the mobile CRM contract from PR #137's base is untouched", () => {
    assert.match(
      read("src/app/api/mobile/crm/leads/route.ts"),
      /queryLeadListPage\(auth\.context, query, auth\.db\)/
    );
  });
});
