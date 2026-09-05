/**
 * Staff login session-cookie persistence.
 *
 * PRODUCTION EVIDENCE THIS EXISTS FOR
 *
 * GoTrue was authenticating correctly — password login `provider=email`
 * HTTP 200, real `auth.sessions` rows, SM001 promoted to active, every
 * post-login route read returning 200 — and Firefox still showed:
 *
 *     Cookies -> https://onedecore.in
 *     "No data present for selected host"
 *
 * No `sb-<project>-auth-token`, chunked or otherwise. The session existed on the
 * server and never reached the browser, because the `Set-Cookie` was written
 * inside a Server Action / RSC mutation whose stream the navigation aborted
 * ("The destination stream closed early").
 *
 * So the flow moved to an ordinary POST answered with an ordinary 303.
 *
 * WHAT THESE TESTS ACTUALLY EXECUTE
 *
 * They execute the login FLOW HELPER (`handleStaffLoginSubmit`) with a Supabase
 * double, and assert the real `NextResponse` it produces — status, Location,
 * every `Set-Cookie`, and every response header.
 *
 * They do NOT execute the exported `POST` route with a real `createServerClient`
 * against a live GoTrue. The production route wiring is deliberately thin, and
 * is asserted separately ("the route forwards BOTH setAll arguments"), because
 * that one line is exactly where Supabase's cache headers were being dropped.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";

import {
  LOGIN_ERROR_CODE,
  MAX_LOGIN_BODY_BYTES,
  handleStaffLoginSubmit,
  type LoginCookieAdapter,
  type LoginSupabaseClient,
  type PendingAuthCookie,
} from "../server/staff-login-submit.ts";
import { STAFF_LOGIN_AUTH_ALIAS_DOMAIN } from "../server/staff-login-auth-alias.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips comments: these files DESCRIBE what they refuse to do. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const LOGIN_FORM = "src/app/auth/login/login-form.tsx";
const LOGIN_PAGE = "src/app/auth/login/page.tsx";
const ROUTE = "src/app/auth/login/submit/route.ts";
const SUBMIT = "src/features/staff-admin/server/staff-login-submit.ts";

const ORIGIN = "https://onedecore.in";
const DIGITS = "7447863402";
const ALIAS = `${DIGITS}@${STAFF_LOGIN_AUTH_ALIAS_DOMAIN}`;
const PASSWORD = "LongEnough1";

/** The canonical shape @supabase/ssr writes, including a chunked pair. */
const SESSION_COOKIES: readonly PendingAuthCookie[] = [
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.0",
    value: "chunk-zero",
    options: {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    },
  },
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.1",
    value: "chunk-one",
    options: {
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAge: 3600,
    },
  },
];

/**
 * The exact headers @supabase/ssr v0.12.3 passes as `setAll`'s second argument.
 *
 * The library documents WHY: a response that sets auth cookies must not be
 * cached by a CDN or reverse proxy, "otherwise one user's session token can be
 * served to a different user."
 */
const SUPABASE_AUTH_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

interface SignInCall {
  readonly email: string;
  readonly password: string;
}

interface Recorded {
  readonly signIns: SignInCall[];
  readonly rpcs: string[];
  readonly signOuts: number[];
}

interface ClientOptions {
  readonly signInFails?: boolean;
  readonly accessState?: string;
  readonly hasAdminAccess?: boolean;
  readonly authorizeErrors?: boolean;
  readonly cookies?: readonly PendingAuthCookie[];
}

/**
 * A Supabase double that writes cookies through the adapter exactly as
 * `@supabase/ssr` does — on sign-in, and again (as deletions) on sign-out.
 */
function makeClient(options: ClientOptions = {}) {
  const recorded: Recorded = { signIns: [], rpcs: [], signOuts: [] };

  const factory = (adapter: LoginCookieAdapter): LoginSupabaseClient => ({
    auth: {
      async signInWithPassword(credentials) {
        recorded.signIns.push(credentials);
        if (options.signInFails) {
          return { error: { message: "Invalid login credentials" } };
        }
        // Exactly as the library calls it: cookies AND the no-store headers.
        adapter.setAll([...(options.cookies ?? SESSION_COOKIES)], {
          ...SUPABASE_AUTH_HEADERS,
        });
        return { error: null };
      },
      async signOut() {
        recorded.signOuts.push(1);
        // Real deletion cookies: same names, empty value, maxAge 0 — and the
        // same cache headers, because this response carries auth cookies too.
        adapter.setAll(
          (options.cookies ?? SESSION_COOKIES).map((cookie) => ({
            name: cookie.name,
            value: "",
            options: { path: "/", maxAge: 0 },
          })),
          { ...SUPABASE_AUTH_HEADERS }
        );
        return null;
      },
    },
    async rpc(fn: string) {
      recorded.rpcs.push(fn);
      if (fn === "record_staff_first_login") {
        return {
          data: { accessState: options.accessState ?? "active" },
          error: null,
        };
      }
      if (options.authorizeErrors) {
        return { data: null, error: { message: "denied" } };
      }
      return { data: options.hasAdminAccess ?? true, error: null };
    },
  });

  return { factory, recorded };
}

interface RequestOptions {
  /** Omit to send the genuine same-origin value a browser would. */
  readonly origin?: string | null;
  readonly headers?: Record<string, string>;
}

function loginRequest(
  fields: Record<string, string>,
  requestOptions: RequestOptions = {}
): NextRequest {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  const headers = new Headers({
    // What Nginx forwards in production.
    host: "onedecore.in",
    "x-forwarded-host": "onedecore.in",
    "x-forwarded-proto": "https",
    ...(requestOptions.headers ?? {}),
  });

  // `origin: null` models a request that sends no Origin at all.
  const origin =
    "origin" in requestOptions ? requestOptions.origin : ORIGIN;
  if (origin) {
    headers.set("origin", origin);
  }

  return new NextRequest(`${ORIGIN}/auth/login/submit`, {
    method: "POST",
    body: form,
    headers,
  });
}

async function submit(
  fields: Record<string, string>,
  options: ClientOptions = {},
  requestOptions: RequestOptions = {}
) {
  const { factory, recorded } = makeClient(options);
  const response = await handleStaffLoginSubmit(
    loginRequest(fields, requestOptions),
    factory
  );
  return { response, recorded, location: response.headers.get("location") ?? "" };
}

/* ========================================================================== */
/* 1. The transport is an ordinary form POST                                   */
/* ========================================================================== */

describe("login is a normal POST, not a Server Action", () => {
  test("the form posts to the submit route", () => {
    const form = read(LOGIN_FORM);
    assert.match(form, /method="post"/);
    assert.match(form, /action="\/auth\/login\/submit"/);
  });

  test("the form no longer uses a Server Action for authentication", () => {
    // Comments EXPLAIN what the file refuses to do; assertions are about code.
    const form = code(read(LOGIN_FORM));
    // These are exactly what failed to deliver the cookie in production.
    assert.doesNotMatch(form, /useActionState/);
    assert.doesNotMatch(form, /loginAction/);
    assert.doesNotMatch(form, /formAction/);
    // What it does instead.
    assert.match(form, /method="post"/);
  });

  test("there is exactly ONE login mutation authority", () => {
    // The old Server Action is gone, not merely unused.
    let actionsExists = true;
    try {
      read("src/app/auth/login/actions.ts");
    } catch {
      actionsExists = false;
    }
    assert.equal(actionsExists, false, "the old login Server Action must be removed");

    // And the route handler exposes POST only.
    const route = read(ROUTE);
    assert.match(route, /export async function POST/);
    for (const verb of ["GET", "PUT", "PATCH", "DELETE"]) {
      assert.doesNotMatch(route, new RegExp(`export async function ${verb}\\b`));
    }
  });

  test("the route does not collide with the login page", () => {
    // A route.ts beside page.tsx at /auth/login would shadow the form itself.
    const authLogin = readdirSync(join(root, "src/app/auth/login"));
    assert.ok(authLogin.includes("page.tsx"));
    assert.ok(!authLogin.includes("route.ts"), "no route.ts may sit beside page.tsx");
    assert.ok(authLogin.includes("submit"));
  });

  test("the route forwards BOTH setAll arguments", () => {
    /*
     * These tests execute the FLOW HELPER, not this file. The production wiring
     * is thin, so it is asserted here directly — and this particular line is the
     * one that silently discarded Supabase's cache headers before.
     */
    const route = code(read(ROUTE));
    assert.match(
      route,
      /setAll:\s*\(cookiesToSet,\s*headers\)\s*=>\s*adapter\.setAll\(cookiesToSet,\s*headers\)/,
      "the route must forward (cookiesToSet, headers), not cookies alone"
    );
    assert.match(route, /getAll:\s*\(\)\s*=>\s*adapter\.getAll\(\)/);
  });

  test("the route uses the publishable key and no custom token handling", () => {
    const route = code(read(ROUTE));
    assert.match(route, /publishableKey/);
    assert.match(route, /createServerClient/);
    // No hand-rolled session format, no manual cookie serialisation.
    assert.doesNotMatch(route, /JSON\.stringify|access_token|refresh_token/);
    assert.doesNotMatch(route, /localStorage|sessionStorage/);
    for (const forbidden of ["service_role", "SERVICE_ROLE", "createAdminClient"]) {
      assert.ok(!route.includes(forbidden));
    }
  });

  test("the form still keeps its fields and staff copy", () => {
    const form = read(LOGIN_FORM);
    assert.match(form, /name="identifier"/);
    assert.match(form, /name="password"/);
    assert.match(form, /name="next"/);
    assert.match(form, /Staff Login ID or Email/);
    assert.match(
      form,
      /Staff sign in with their unique 10-digit mobile number\. Do not add \+91\./
    );
  });
});

/* ========================================================================== */
/* 2. The session cookies actually reach the response — the whole point        */
/* ========================================================================== */

describe("session cookies ride the redirect", () => {
  test("a successful login answers 303", async () => {
    const { response } = await submit({ identifier: DIGITS, password: PASSWORD });
    assert.equal(response.status, 303);
  });

  test("EVERY cookie @supabase/ssr wrote is on the response", async () => {
    const { response } = await submit({ identifier: DIGITS, password: PASSWORD });

    const returned = response.cookies.getAll();
    assert.equal(
      returned.length,
      SESSION_COOKIES.length,
      "every captured cookie must be copied, none dropped"
    );

    for (const expected of SESSION_COOKIES) {
      const actual = response.cookies.get(expected.name);
      assert.ok(actual, `${expected.name} missing from the response`);
      assert.equal(actual.value, expected.value);
    }

    // And they are real Set-Cookie headers, not just an internal map.
    const header = response.headers.get("set-cookie") ?? "";
    for (const expected of SESSION_COOKIES) {
      assert.ok(
        header.includes(`${expected.name}=${expected.value}`),
        `${expected.name} missing from Set-Cookie`
      );
    }
  });

  test("cookie options are preserved exactly as supplied", async () => {
    const { response } = await submit({ identifier: DIGITS, password: PASSWORD });
    const cookie = response.cookies.get("sb-lpurlfmpvriyvpkujvyl-auth-token.0");

    assert.ok(cookie);
    assert.equal(cookie.path, "/");
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.secure, true);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.maxAge, 3600);
  });

  test("an unchunked single cookie works the same way", async () => {
    const single: PendingAuthCookie[] = [
      {
        name: "sb-lpurlfmpvriyvpkujvyl-auth-token",
        value: "whole-token",
        options: { path: "/", sameSite: "lax", secure: true, httpOnly: true },
      },
    ];
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      { cookies: single }
    );

    assert.equal(response.cookies.getAll().length, 1);
    assert.equal(
      response.cookies.get("sb-lpurlfmpvriyvpkujvyl-auth-token")?.value,
      "whole-token"
    );
  });

  test("no token is exposed in the body or the URL", async () => {
    const { response, location } = await submit({
      identifier: DIGITS,
      password: PASSWORD,
    });

    const body = await response.text();
    for (const secret of ["chunk-zero", "chunk-one", PASSWORD, ALIAS]) {
      assert.ok(!body.includes(secret), `response body leaked ${secret}`);
      assert.ok(!location.includes(secret), `redirect URL leaked ${secret}`);
    }
    // Tokens travel ONLY as httpOnly cookies.
    assert.doesNotMatch(location, /access_token|refresh_token/);
  });
});

/* ========================================================================== */
/* 2b. The no-store headers ride with the cookies                              */
/* ========================================================================== */

describe("an auth-cookie response is never cacheable", () => {
  test("every header @supabase/ssr supplied reaches the response", async () => {
    const { response } = await submit({ identifier: DIGITS, password: PASSWORD });

    for (const [name, expected] of Object.entries(SUPABASE_AUTH_HEADERS)) {
      assert.equal(
        response.headers.get(name),
        expected,
        `${name} must be preserved exactly as supplied`
      );
    }
  });

  test("Cache-Control, Expires and Pragma are the library's exact values", async () => {
    const { response } = await submit({ identifier: DIGITS, password: PASSWORD });

    assert.equal(
      response.headers.get("cache-control"),
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
    assert.equal(response.headers.get("expires"), "0");
    assert.equal(response.headers.get("pragma"), "no-cache");
  });

  test("NO response carrying an auth cookie may omit them", async () => {
    // Every outcome that emits a Set-Cookie: success, and revoked deletion.
    const cases = [
      await submit({ identifier: DIGITS, password: PASSWORD }),
      await submit(
        { identifier: DIGITS, password: PASSWORD },
        { accessState: "revoked" }
      ),
    ];

    for (const { response } of cases) {
      assert.ok(
        response.cookies.getAll().length > 0,
        "precondition: this response sets cookies"
      );
      for (const name of Object.keys(SUPABASE_AUTH_HEADERS)) {
        assert.ok(
          response.headers.get(name),
          `a session-bearing response is missing ${name}`
        );
      }
    }
  });

  test("a revoked redirect carries deletion cookies AND no-cache headers", async () => {
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      { accessState: "revoked" }
    );

    for (const cookie of SESSION_COOKIES) {
      const returned = response.cookies.get(cookie.name);
      assert.ok(returned);
      assert.equal(returned.value, "");
      assert.equal(returned.maxAge, 0);
    }
    assert.equal(
      response.headers.get("cache-control"),
      SUPABASE_AUTH_HEADERS["Cache-Control"]
    );
  });

  test("responses Supabase never touched are still no-store", async () => {
    // A validation failure returns before any client exists, so no library
    // headers arrive — the endpoint applies its own conservative baseline.
    const { response } = await submit({ identifier: "", password: "" });

    assert.equal(response.cookies.getAll().length, 0);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("pragma"), "no-cache");
  });

  test("a library-supplied header is never weakened by the baseline", async () => {
    // If Supabase ever sends something stricter, that value must survive.
    const stricter = {
      ...SESSION_COOKIES[0]!,
    };
    const { factory } = (() => {
      const recorded = { signIns: [], rpcs: [], signOuts: [] };
      return {
        factory: (adapter: LoginCookieAdapter): LoginSupabaseClient => ({
          auth: {
            async signInWithPassword() {
              adapter.setAll([stricter], {
                "Cache-Control": "no-store, max-age=0, s-maxage=0",
                "X-Supabase-Test": "kept",
              });
              return { error: null };
            },
            async signOut() {
              return null;
            },
          },
          async rpc(fn: string) {
            recorded.rpcs.push(fn as never);
            return fn === "record_staff_first_login"
              ? { data: { accessState: "active" }, error: null }
              : { data: true, error: null };
          },
        }),
      };
    })();

    const response = await handleStaffLoginSubmit(
      loginRequest({ identifier: DIGITS, password: PASSWORD }),
      factory
    );

    assert.equal(
      response.headers.get("cache-control"),
      "no-store, max-age=0, s-maxage=0",
      "the library's value must win over our baseline"
    );
    assert.equal(response.headers.get("x-supabase-test"), "kept");
  });
});

/* ========================================================================== */
/* 2c. CSRF — the protection the Server Action used to provide                 */
/* ========================================================================== */

describe("cross-site login POSTs are refused", () => {
  /*
   * Server Actions compare Origin against Host automatically. Moving to a custom
   * Route Handler dropped that, and this endpoint's whole job is to mint an
   * administrative session — so a cross-site POST could plant an attacker's
   * session in a victim's browser.
   */

  test("a genuine same-origin browser POST is accepted", async () => {
    const { response, recorded } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: "https://onedecore.in" }
    );

    assert.equal(response.status, 303);
    assert.equal(recorded.signIns.length, 1);
  });

  test("a hostile Origin is rejected with NO auth side effects", async () => {
    const { response, recorded } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: "https://evil.example" }
    );

    assert.equal(response.status, 403);
    // The decisive assertions: nothing happened.
    assert.equal(recorded.signIns.length, 0, "no credential may be tested");
    assert.equal(recorded.rpcs.length, 0, "no RPC may run");
    assert.equal(recorded.signOuts.length, 0);
    assert.equal(response.cookies.getAll().length, 0, "no session may be issued");
    assert.equal(response.headers.get("set-cookie"), null);
  });

  test("the hostile Origin is never reflected back", async () => {
    const hostile = "https://evil.example";
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: hostile }
    );

    const body = await response.text();
    assert.ok(!body.includes("evil.example"));
    for (const [, value] of response.headers) {
      assert.ok(!value.includes("evil.example"), "no header may echo the origin");
    }
  });

  test("malformed and absent Origin fail closed", async () => {
    for (const origin of ["not-a-url", "null", "://broken", null]) {
      const { response, recorded } = await submit(
        { identifier: DIGITS, password: PASSWORD },
        {},
        { origin }
      );
      assert.equal(response.status, 403, `origin ${String(origin)} must be refused`);
      assert.equal(recorded.signIns.length, 0);
    }
  });

  test("a matching host on a different scheme is still cross-origin", async () => {
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: "http://onedecore.in" }
    );
    assert.equal(response.status, 403);
  });

  test("a subdomain of the real host is not the same origin", async () => {
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: "https://evil.onedecore.in" }
    );
    assert.equal(response.status, 403);
  });

  test("the rejection is refused before the body is even parsed", () => {
    const src = read(SUBMIT);
    const guardAt = src.indexOf("if (!isSameOrigin(request))");
    const formAt = src.indexOf("await request.formData()");
    const clientAt = src.indexOf("createClientWithCookies({");

    assert.ok(guardAt > 0, "the origin guard must exist");
    assert.ok(guardAt < formAt, "the guard must precede form parsing");
    assert.ok(guardAt < clientAt, "the guard must precede client creation");
  });

  test("an oversized body is refused before parsing", async () => {
    const { response, recorded } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { headers: { "content-length": String(MAX_LOGIN_BODY_BYTES + 1) } }
    );

    assert.equal(response.status, 413);
    assert.equal(recorded.signIns.length, 0);
    assert.equal(response.cookies.getAll().length, 0);
    // A real login post is nowhere near the ceiling.
    assert.ok(MAX_LOGIN_BODY_BYTES >= 254 + 128 + 512);
  });

  test("a normal-sized body is unaffected", async () => {
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { headers: { "content-length": "700" } }
    );
    assert.equal(response.status, 303);
  });

  test("the 403 carries no credential detail", async () => {
    const { response } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      {},
      { origin: "https://evil.example" }
    );
    const body = await response.text();
    assert.equal(body, "");
    assert.ok(!body.includes(DIGITS));
  });
});

/* ========================================================================== */
/* 3. Identifier model — unchanged from the owner lock                         */
/* ========================================================================== */

describe("the credential model is untouched", () => {
  test("a 10-digit mobile authenticates via the server-derived alias", async () => {
    const { recorded } = await submit({ identifier: DIGITS, password: PASSWORD });

    assert.equal(recorded.signIns.length, 1);
    assert.equal(recorded.signIns[0]?.email, ALIAS);
    assert.equal(recorded.signIns[0]?.password, PASSWORD);
  });

  test("the Super Admin email path is unchanged and lower-cased", async () => {
    const { recorded } = await submit({
      identifier: "Owner@OneDecore.In",
      password: PASSWORD,
    });

    assert.equal(recorded.signIns[0]?.email, "owner@onedecore.in");
  });

  test("a directly submitted alias is refused BEFORE any authentication", async () => {
    const { response, recorded, location } = await submit({
      identifier: ALIAS,
      password: PASSWORD,
    });

    // The decisive assertion: no credential was tested at all.
    assert.equal(recorded.signIns.length, 0, "no sign-in may be attempted");
    assert.equal(recorded.rpcs.length, 0);
    assert.equal(response.status, 303);
    assert.match(location, new RegExp(`error=${LOGIN_ERROR_CODE}`));
  });

  test("9- and 11-digit inputs never reach the staff path", async () => {
    for (const identifier of ["744786340", "74478634021"]) {
      const { recorded } = await submit({ identifier, password: PASSWORD });
      // They fall through to the email path as an unknown address, never as a
      // staff alias.
      assert.notEqual(recorded.signIns[0]?.email, ALIAS);
    }
  });

  test("a +91-prefixed value is not a staff identifier", async () => {
    const { recorded } = await submit({
      identifier: `+91${DIGITS}`,
      password: PASSWORD,
    });
    assert.notEqual(recorded.signIns[0]?.email, ALIAS);
  });
});

/* ========================================================================== */
/* 4. Failure, revocation and authorization                                    */
/* ========================================================================== */

describe("failures disclose nothing", () => {
  test("bad credentials redirect with only a generic code", async () => {
    const { response, location } = await submit(
      { identifier: DIGITS, password: "wrong-password" },
      { signInFails: true }
    );

    assert.equal(response.status, 303);
    const url = new URL(location);
    assert.equal(url.pathname, "/auth/login");
    assert.equal(url.searchParams.get("error"), LOGIN_ERROR_CODE);

    // Nothing else rides along.
    assert.equal(url.searchParams.get("identifier"), null);
    assert.equal(url.searchParams.get("password"), null);
    assert.ok(!location.includes(DIGITS), "the identifier must not be echoed");
    assert.ok(!location.includes("wrong-password"));
  });

  test("an unknown login and a wrong password are indistinguishable", async () => {
    const a = await submit(
      { identifier: DIGITS, password: "x".repeat(12) },
      { signInFails: true }
    );
    const b = await submit(
      { identifier: "nobody@onedecore.in", password: "y".repeat(12) },
      { signInFails: true }
    );
    assert.equal(a.location, b.location);
    assert.equal(a.response.status, b.response.status);
  });

  test("missing fields produce the same generic failure", async () => {
    for (const fields of [
      { identifier: "", password: PASSWORD },
      { identifier: DIGITS, password: "" },
    ]) {
      const { response, location, recorded } = await submit(fields);
      assert.equal(response.status, 303);
      assert.match(location, new RegExp(`error=${LOGIN_ERROR_CODE}`));
      assert.equal(recorded.signIns.length, 0);
    }
  });

  test("a successful sign-in records the first login", async () => {
    const { recorded } = await submit({ identifier: DIGITS, password: PASSWORD });
    assert.ok(recorded.rpcs.includes("record_staff_first_login"));
    assert.ok(recorded.rpcs.includes("authorize"));
    // Promotion is attempted before entitlement is checked.
    assert.ok(
      recorded.rpcs.indexOf("record_staff_first_login") <
        recorded.rpcs.indexOf("authorize")
    );
  });

  test("a revoked account is signed out and its cookies are DELETED", async () => {
    const { response, recorded, location } = await submit(
      { identifier: DIGITS, password: PASSWORD },
      { accessState: "revoked" }
    );

    assert.equal(recorded.signOuts.length, 1, "a revoked account must be signed out");
    assert.match(location, new RegExp(`error=${LOGIN_ERROR_CODE}`));

    // The deletion cookies must reach the browser, or a live session lingers.
    for (const cookie of SESSION_COOKIES) {
      const returned = response.cookies.get(cookie.name);
      assert.ok(returned, `${cookie.name} deletion missing`);
      assert.equal(returned.value, "", "the value must be cleared");
      assert.equal(returned.maxAge, 0, "the cookie must be expired");
    }
  });

  test("admin.access is required and fails closed", async () => {
    for (const options of [
      { hasAdminAccess: false },
      { authorizeErrors: true },
    ] as const) {
      const { response, location } = await submit(
        { identifier: DIGITS, password: PASSWORD },
        options
      );
      assert.equal(response.status, 303);
      assert.equal(new URL(location).pathname, "/auth/forbidden");
    }
  });
});

/* ========================================================================== */
/* 5. Redirect targets                                                         */
/* ========================================================================== */

describe("the redirect target is always safe", () => {
  test("a safe next is preserved through a successful login", async () => {
    const { location } = await submit({
      identifier: DIGITS,
      password: PASSWORD,
      next: "/admin/attendance",
    });
    assert.equal(new URL(location).pathname, "/admin/attendance");
  });

  test("an unsafe next collapses to /admin", async () => {
    for (const unsafe of [
      "https://evil.example.com/admin",
      "//evil.example.com",
      "/admin//evil",
      "/etc/passwd",
      "",
    ]) {
      const { location } = await submit({
        identifier: DIGITS,
        password: PASSWORD,
        next: unsafe,
      });
      const url = new URL(location);
      assert.equal(url.origin, ORIGIN, `${unsafe} escaped the origin`);
      assert.equal(url.pathname, "/admin", `${unsafe} was not collapsed`);
    }
  });

  test("a safe next survives a FAILED attempt too", async () => {
    const { location } = await submit(
      { identifier: DIGITS, password: "bad", next: "/admin/attendance" },
      { signInFails: true }
    );
    const url = new URL(location);
    assert.equal(url.pathname, "/auth/login");
    assert.equal(url.searchParams.get("next"), "/admin/attendance");
  });

  test("an unsafe next is not reflected back into the login page", async () => {
    const { location } = await submit(
      { identifier: DIGITS, password: "bad", next: "https://evil.example.com" },
      { signInFails: true }
    );
    assert.ok(!location.includes("evil.example.com"));
  });

  test("the page re-validates next and renders one fixed message", () => {
    const page = read(LOGIN_PAGE);
    assert.match(page, /getSafeAdminRedirect\(rawNext\)/);
    assert.match(page, /resolvedParams\.error === LOGIN_ERROR_CODE/);

    const form = read(LOGIN_FORM);
    assert.match(form, /Invalid staff credentials\./);
    // No enumerating variants anywhere in the rendered surface.
    for (const leak of ["invalid_user", "wrong_password", "revoked", "alias_exists"]) {
      assert.ok(!page.includes(leak) && !form.includes(leak), `must not render ${leak}`);
    }
  });
});

/* ========================================================================== */
/* 6. Containment — unchanged owner locks                                      */
/* ========================================================================== */

describe("the owner locks still hold", () => {
  test("no service role and no admin client in the login path", () => {
    for (const rel of [ROUTE, SUBMIT]) {
      const src = read(rel);
      for (const forbidden of [
        "service_role",
        "SERVICE_ROLE",
        "serviceRole",
        "createAdminClient",
        "sb_secret_",
      ]) {
        assert.ok(!src.includes(forbidden), `${rel} must not reference ${forbidden}`);
      }
    }
    // The route uses the same publishable key as every other caller-scoped path.
    assert.match(read(ROUTE), /publishableKey/);
  });

  test("no phone provider, no OTP, no signup in the login path", () => {
    for (const rel of [ROUTE, SUBMIT, LOGIN_FORM, LOGIN_PAGE]) {
      const src = read(rel);
      for (const forbidden of [
        "signInWithOtp",
        "verifyOtp",
        "signUp(",
        "resend(",
      ]) {
        assert.ok(!src.includes(forbidden), `${rel} must not call ${forbidden}`);
      }
      assert.doesNotMatch(src, /signInWithPassword\(\s*\{\s*phone/);
    }
  });

  test("no forgot-password or self-service reset was introduced", () => {
    const routes = readdirSync(join(root, "src/app/auth"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const forbidden of [
      "forgot-password",
      "reset-password",
      "recover",
      "signup",
      "sign-up",
      "register",
    ]) {
      assert.ok(!routes.includes(forbidden), `/auth/${forbidden} must not exist`);
    }
    // The submit route is the only thing added under /auth/login.
    assert.ok(routes.includes("login"));
  });

  test("the alias stays server-only and out of the client", () => {
    assert.match(
      read("src/features/staff-admin/server/staff-login-auth-alias.ts"),
      /^import "server-only";/m
    );
    for (const rel of [LOGIN_FORM, LOGIN_PAGE]) {
      const src = read(rel);
      assert.ok(!src.includes("staff-login-auth-alias"));
      assert.ok(!src.includes(STAFF_LOGIN_AUTH_ALIAS_DOMAIN));
      assert.ok(!src.includes("staffLoginAuthAlias"));
    }
    // The submit flow is server-only too.
    assert.match(read(SUBMIT), /^import "server-only";/m);
  });

  test("this hotfix adds no migration", () => {
    const migrations = readdirSync(join(root, "supabase", "migrations"));
    for (const name of migrations) {
      assert.doesNotMatch(name, /login_cookie|session_cookie|auth_cookie/i);
    }
  });

  test("the mobile CRM contract is untouched", () => {
    assert.match(
      read("src/app/api/mobile/crm/leads/route.ts"),
      /queryLeadListPage\(auth\.context, query, auth\.db\)/
    );
    assert.match(read("src/lib/supabase/bearer.ts"), /publishableKey/);
  });
});
