import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { looksLikeStaffLoginPhone } from "../contracts/staff-login-phone.ts";
import {
  isStaffLoginAuthAlias,
  staffLoginAuthAlias,
} from "./staff-login-auth-alias.ts";

/**
 * Staff login as an ORDINARY HTTP POST.
 *
 * WHY THIS IS NOT A SERVER ACTION
 *
 * In production, GoTrue was authenticating correctly — password login
 * `provider=email` HTTP 200, real `auth.sessions` rows, SM001 promoted to
 * active — and the browser still held no session:
 *
 *     Cookies -> https://onedecore.in
 *     "No data present for selected host"
 *
 * No `sb-<project>-auth-token` at all. The session existed on the server and
 * never reached the client.
 *
 * The old flow was `useActionState(loginAction)` → Server Action →
 * `cookies().set(...)` → `redirect()`. That makes cookie delivery depend on
 * Server Action / RSC mutation propagation surviving a navigation, and in
 * production it did not — the same requests logged "The destination stream
 * closed early". A `Set-Cookie` written into an aborted RSC stream is simply
 * never applied by the browser.
 *
 * So authentication moved off that path entirely. This is a plain form POST
 * answered with a plain 303 whose `Set-Cookie` headers are attached to the
 * response object that is actually returned. Cookie delivery becomes an
 * ordinary property of an ordinary HTTP response, which is the one thing the
 * browser is guaranteed to honour.
 *
 * The identifier and credential model is UNCHANGED: 10-digit staff mobile,
 * server-only derived alias, Super Admin email, no OTP, no phone provider.
 */

/** The ONLY failure signal. Never says which part was wrong. */
export const LOGIN_ERROR_CODE = "invalid";

/**
 * Ceiling on the login request body, in bytes.
 *
 * The real form is a few hundred bytes; this leaves generous headroom while
 * still refusing anything sent purely to make the server buffer it.
 */
export const MAX_LOGIN_BODY_BYTES = 8 * 1024;

/** Cookie exactly as `@supabase/ssr` asks us to write it. */
export interface PendingAuthCookie {
  readonly name: string;
  readonly value: string;
  readonly options?: Record<string, unknown>;
}

export interface LoginCookieAdapter {
  getAll(): { name: string; value: string }[];
  /**
   * `@supabase/ssr` v0.12.3 calls `setAll(cookiesToSet, headers)`.
   *
   * The second argument is NOT decoration. The library documents it as required
   * alongside the cookies:
   *
   *   "Responses that set auth cookies must not be cached by CDNs or reverse
   *    proxies, otherwise one user's session token can be served to a different
   *    user."
   *
   * It supplies `Cache-Control: private, no-cache, no-store, must-revalidate,
   * max-age=0`, `Expires: 0` and `Pragma: no-cache`. Declaring the parameter
   * here is what stops JavaScript silently discarding it at the call site.
   */
  setAll(
    cookiesToSet: PendingAuthCookie[],
    headers: Record<string, string>
  ): void;
}

/**
 * The cache policy applied to EVERY response from this endpoint.
 *
 * Supabase supplies these whenever it writes auth cookies, and those values win.
 * This baseline covers the responses it never gets to touch — a validation
 * failure, a rejected origin — because an authentication endpoint should not be
 * cacheable regardless of whether a session was issued.
 */
const AUTH_RESPONSE_CACHE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

/**
 * The request's own origin, as the public internet sees it.
 *
 * TRUST BOUNDARY: `X-Forwarded-*` is only meaningful because the app is reached
 * exclusively through the ONEDECORE Nginx reverse proxy, which sets them. A
 * client can forge those headers, but forging them here changes only what this
 * request compares ITSELF against — it cannot make a cross-site Origin match,
 * because the attacker's `Origin` is set by the victim's browser and is not
 * under the attacker's control.
 */
function effectiveRequestOrigin(request: NextRequest): string {
  const first = (raw: string | null): string | null =>
    raw ? (raw.split(",")[0] ?? "").trim() || null : null;

  const host =
    first(request.headers.get("x-forwarded-host")) ??
    first(request.headers.get("host")) ??
    request.nextUrl.host;

  const proto =
    first(request.headers.get("x-forwarded-proto")) ??
    request.nextUrl.protocol.replace(/:$/, "");

  return `${proto}://${host}`.toLowerCase();
}

/**
 * Same-origin check for the login POST.
 *
 * WHY THIS IS HERE
 *
 * The previous login was a Next.js Server Action, and Server Actions compare
 * Origin against Host/X-Forwarded-Host automatically. Moving authentication to a
 * custom Route Handler dropped that protection — Next's own documentation says
 * custom Route Handlers must be audited for CSRF separately.
 *
 * Without it, an attacker-controlled page could cross-site POST credentials of
 * the attacker's choosing and land the resulting session cookies in the victim's
 * browser — a login-CSRF / session-fixation path into an administrative session,
 * which is precisely what this endpoint exists to create.
 *
 * A missing Origin fails closed. Every browser sends Origin on a POST, so a
 * genuine form submission always has one; treating absent as trusted would make
 * the check trivial to skip.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  let candidate: URL;
  try {
    candidate = new URL(origin);
  } catch {
    // Malformed, "null", or otherwise unparseable — fail closed.
    return false;
  }

  return (
    `${candidate.protocol.replace(/:$/, "")}://${candidate.host}`.toLowerCase() ===
    effectiveRequestOrigin(request)
  );
}

/** Only the surface this flow actually uses, so tests can supply a double. */
export interface LoginSupabaseClient {
  readonly auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ error: unknown }>;
    signOut(): Promise<unknown>;
  };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<{ data: unknown; error: unknown }>;
}

export type LoginClientFactory = (
  adapter: LoginCookieAdapter
) => LoginSupabaseClient;

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The login page URL for a failed attempt.
 *
 * Carries a single opaque code and the already-validated `next`, and nothing
 * else — never the identifier, never the password, never a reason. A distinct
 * code per failure would turn the form into an oracle for enumerating staff
 * mobile numbers.
 */
function failureUrl(request: NextRequest, safeNext: string): URL {
  const url = new URL("/auth/login", request.nextUrl.origin);
  url.searchParams.set("error", LOGIN_ERROR_CODE);
  if (safeNext !== "/admin") {
    url.searchParams.set("next", safeNext);
  }
  return url;
}

/**
 * Authenticates a staff login and returns the redirect that carries the session.
 *
 * The client factory is injected so the whole flow — including the exact
 * cookies handed to the response — can be exercised in tests without a network
 * or a live GoTrue.
 */
export async function handleStaffLoginSubmit(
  request: NextRequest,
  createClientWithCookies: LoginClientFactory
): Promise<NextResponse> {
  /*
   * CSRF gate, before the body is even read.
   *
   * Nothing downstream runs for a cross-site POST: no form parsing, no Supabase
   * client, no credential test, no cookie. 403 with an empty body is the whole
   * response — the rejected Origin is never reflected, and no credential detail
   * is disclosed either way.
   */
  if (!isSameOrigin(request)) {
    return new NextResponse(null, {
      status: 403,
      headers: { ...AUTH_RESPONSE_CACHE_HEADERS },
    });
  }

  /*
   * A bound on the body before it is parsed.
   *
   * The Server Action this replaced inherited a framework body limit; a custom
   * Route Handler inherits none, and the repository carries no Nginx config to
   * confirm an upstream one. A genuine login post is a few hundred bytes —
   * identifier <= 254, password <= 128, next a couple of hundred — so this
   * ceiling is orders of magnitude above any real submission while refusing to
   * buffer a body sent to waste memory. A missing Content-Length is left to the
   * runtime rather than rejected, since only the oversized case is the risk.
   */
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) {
    return new NextResponse(null, {
      status: 413,
      headers: { ...AUTH_RESPONSE_CACHE_HEADERS },
    });
  }

  const form = await request.formData();

  // `email` stays accepted so an older cached form post keeps working.
  const identifier = (
    readField(form, "identifier") || readField(form, "email")
  ).trim();
  const password = readField(form, "password");
  const safeNext = getSafeAdminRedirect(readField(form, "next"));

  /*
   * Every captured cookie, in the order @supabase/ssr asked for it.
   *
   * This is the heart of the fix. The cookies are NOT written to a throwaway
   * response and hoped for — they are collected here and applied, below, to the
   * exact response object this function returns.
   */
  const pendingCookies: PendingAuthCookie[] = [];

  /*
   * The response headers @supabase/ssr hands us alongside those cookies.
   *
   * Dropping these was the second half of the same bug: a response that carries
   * an auth Set-Cookie but no no-store policy can be cached by a CDN or reverse
   * proxy, and then one staff member's session token is served to whoever asks
   * next. The library is explicit about this, which is why its `setAll` takes
   * them as a second argument.
   */
  const pendingHeaders: Record<string, string> = {};

  const applyCookies = (response: NextResponse): NextResponse => {
    for (const cookie of pendingCookies) {
      // Options are passed through verbatim: path, sameSite, secure, httpOnly,
      // maxAge/expires and the chunking `@supabase/ssr` may apply are its
      // decisions to make, not ours to normalise.
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    // Our conservative baseline first, then Supabase's values, so a header the
    // library supplied always wins and is never weakened by ours.
    for (const [name, value] of Object.entries(AUTH_RESPONSE_CACHE_HEADERS)) {
      response.headers.set(name, value);
    }
    for (const [name, value] of Object.entries(pendingHeaders)) {
      response.headers.set(name, value);
    }

    return response;
  };

  const fail = (): NextResponse =>
    // 303 so the browser re-issues a GET; a 302 would let some agents repost.
    // Cookies are applied even here: a revoked sign-out emits DELETION cookies
    // that must reach the browser, or a dead session would linger.
    applyCookies(NextResponse.redirect(failureUrl(request, safeNext), 303));

  if (!identifier || !password) {
    return fail();
  }

  if (identifier.length > 254 || password.length > 128) {
    return fail();
  }

  /*
   * The internal transport alias is NOT a login identifier.
   *
   * It is derived from a staff mobile, so anyone who knows the number can
   * construct it. Without this check it would slip past the 10-digit test and
   * authenticate down the generic email path, giving every staff member a
   * second login the owner never authorised.
   *
   * Refused before any client is built, so no credential is tested and the form
   * cannot be used to probe which aliases exist.
   */
  if (isStaffLoginAuthAlias(identifier)) {
    return fail();
  }

  const supabase = createClientWithCookies({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      pendingCookies.push(...cookiesToSet);
      Object.assign(pendingHeaders, headers ?? {});
    },
  });

  let signInFailed: boolean;

  if (looksLikeStaffLoginPhone(identifier)) {
    // Derived here, used here, never returned. A null alias means the value was
    // not a valid staff number after all — a credential failure like any other.
    const alias = staffLoginAuthAlias(identifier);
    if (!alias) {
      return fail();
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: alias,
      password,
    });
    signInFailed = Boolean(error);
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifier.toLowerCase(),
      password,
    });
    signInFailed = Boolean(error);
  }

  if (signInFailed) {
    return fail();
  }

  // A genuine sign-in just happened, so this is the ONLY place that may promote
  // credentials_ready -> active. Issuing credentials never activates anything.
  // It also reports a revoked account, which must not proceed even though the
  // password was correct.
  const { data: loginRecord } = await supabase.rpc("record_staff_first_login");
  const accessState =
    loginRecord && typeof loginRecord === "object"
      ? (loginRecord as { accessState?: unknown }).accessState
      : null;

  if (accessState === "revoked") {
    // signOut() emits deletion cookies through the same setAll capture, so the
    // redirect below actively clears the session rather than leaving a usable
    // one behind. Applying them is what makes the revocation real in the browser.
    await supabase.auth.signOut();
    return fail();
  }

  const { data: hasAccess, error: rpcError } = await supabase.rpc("authorize", {
    requested_permission: "admin.access",
  });

  if (rpcError || hasAccess !== true) {
    // Fail closed: authenticated but not entitled. The session cookies are still
    // applied, so /auth/forbidden renders for a known user rather than bouncing
    // them back to a login form they just satisfied.
    return applyCookies(
      NextResponse.redirect(new URL("/auth/forbidden", request.nextUrl.origin), 303)
    );
  }

  return applyCookies(
    NextResponse.redirect(new URL(safeNext, request.nextUrl.origin), 303)
  );
}
