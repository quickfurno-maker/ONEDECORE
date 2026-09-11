/**
 * A rejected login must not leave a usable session.
 *
 * THE DEFECT
 *
 * A non-super-admin who typed VALID credentials into the Super Admin portal was
 * authenticated, correctly refused the entitlement, correctly answered with the
 * generic `?error=invalid` redirect — and handed a live 400-day session cookie
 * on the way out. `signOut()` was called and reported success; it simply did
 * nothing.
 *
 * WHY THE EXISTING TESTS DID NOT CATCH IT
 *
 * This is the part worth remembering. The Supabase double in
 * `staff-login-cookie-persistence.test.ts` emits deletion cookies from
 * `signOut()` UNCONDITIONALLY. The real `@supabase/ssr` client does not: it
 * calls `getAll()`, works out which cookies hold the session, and emits
 * deletions for those. A double that is more cooperative than the library tests
 * a system nobody is running.
 *
 * So the double here is deliberately faithful — `signOut()` deletes only what
 * `getAll()` shows it. Against the old adapter, which replayed the incoming
 * request forever, that returns nothing and the test reproduces the defect.
 *
 * Measured against real @supabase/ssr v0.12.3 and a local Supabase before
 * writing it: three `getAll` calls returning `[]`, one `setAll` carrying a
 * 2,573-byte session, then a final `getAll` still returning `[]` and no further
 * `setAll` at all.
 *
 * WHAT THESE TESTS ASSERT
 *
 * The RESPONSE, not the call. Asserting `signOut` was called is what the old
 * suite effectively did, and the defect called `signOut` faithfully every time.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";

import {
  handleStaffLoginSubmit,
  type LoginClientFactory,
  type LoginCookieAdapter,
  type LoginSupabaseClient,
  type PendingAuthCookie,
} from "../server/staff-login-submit.ts";
import { STAFF_LOGIN_AUTH_ALIAS_DOMAIN } from "../server/staff-login-auth-alias.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const SUBMIT = "src/features/staff-admin/server/staff-login-submit.ts";

const ORIGIN = "https://onedecore.in";
const ADMIN_EMAIL = "owner@onedecore.in";
const STAFF_DIGITS = "7447863402";
const PASSWORD = "LongEnough1";

const AUTH_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

/** The chunked pair `@supabase/ssr` writes for a session too large for one cookie. */
const SESSION: readonly PendingAuthCookie[] = [
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.0",
    value: "chunk-zero",
    options: { path: "/", sameSite: "lax", secure: true, httpOnly: true, maxAge: 34560000 },
  },
  {
    name: "sb-lpurlfmpvriyvpkujvyl-auth-token.1",
    value: "chunk-one",
    options: { path: "/", sameSite: "lax", secure: true, httpOnly: true, maxAge: 34560000 },
  },
];

interface DoubleOptions {
  readonly signInFails?: boolean;
  readonly accessState?: string;
  readonly hasPermission?: boolean;
  readonly session?: readonly PendingAuthCookie[];
}

/**
 * A Supabase double that behaves like the library, not like a helpful mock.
 *
 * `signOut()` reads `getAll()` and deletes exactly the auth cookies it can see.
 * If the adapter cannot show it the session that `signInWithPassword` just
 * wrote, it emits nothing — which is precisely the production behaviour.
 */
function makeClient(options: DoubleOptions = {}) {
  const recorded = { signOuts: 0, getAllAfterSignOut: [] as string[][] };

  const factory: LoginClientFactory = (
    adapter: LoginCookieAdapter
  ): LoginSupabaseClient => ({
    auth: {
      async signInWithPassword(credentials) {
        void credentials;
        if (options.signInFails) {
          return { error: { message: "Invalid login credentials" } };
        }
        adapter.setAll([...(options.session ?? SESSION)], { ...AUTH_HEADERS });
        return { error: null };
      },
      async signOut() {
        recorded.signOuts += 1;
        // The library's actual algorithm: look at what is there, delete that.
        const visible = adapter
          .getAll()
          .filter((cookie) => cookie.name.includes("-auth-token"));
        recorded.getAllAfterSignOut.push(visible.map((c) => c.name));
        if (visible.length === 0) return null;
        adapter.setAll(
          visible.map((cookie) => ({
            name: cookie.name,
            value: "",
            options: { path: "/", maxAge: 0 },
          })),
          { ...AUTH_HEADERS }
        );
        return null;
      },
    },
    async rpc(fn: string) {
      if (fn === "record_staff_first_login") {
        return { data: { accessState: options.accessState ?? "active" }, error: null };
      }
      if (fn === "has_active_role") return { data: false, error: null };
      return { data: options.hasPermission ?? true, error: null };
    },
  });

  return { factory, recorded };
}

function makeRequest(
  portal: "admin" | "staff",
  identifier: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const body = new URLSearchParams({ portal, identifier, password: PASSWORD });
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    origin: ORIGIN,
    "x-forwarded-host": "onedecore.in",
    "x-forwarded-proto": "https",
  });
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookieHeader) headers.set("cookie", cookieHeader);

  return new NextRequest("https://localhost:3000/auth/login/submit", {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

/** Every Set-Cookie on the response, parsed to name + whether it is live. */
function cookieOutcome(response: Response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const byName = new Map<string, { live: boolean; maxAge: string | null }>();
  for (const header of raw) {
    const [pair, ...attrs] = header.split(";");
    const eq = (pair ?? "").indexOf("=");
    const name = (pair ?? "").slice(0, eq).trim();
    const value = (pair ?? "").slice(eq + 1).trim();
    const maxAgeAttr =
      attrs.map((a) => a.trim()).find((a) => /^max-age=/i.test(a)) ?? null;
    const maxAge = maxAgeAttr ? maxAgeAttr.split("=")[1]!.trim() : null;
    const expiredByMaxAge = maxAge !== null && Number(maxAge) <= 0;
    // A cookie is usable only with a value AND without an immediate expiry.
    byName.set(name, { live: value.length > 0 && !expiredByMaxAge, maxAge });
  }
  return {
    all: byName,
    liveNames: [...byName.entries()].filter(([, v]) => v.live).map(([n]) => n),
  };
}

/* -------------------------------------------------------------------------- */
/* 1. The defect itself                                                        */
/* -------------------------------------------------------------------------- */

describe("a rejected Super Admin login leaves no usable session", () => {
  test("valid credentials, no entitlement: generic failure AND no live cookie", async () => {
    /*
     * THE REGRESSION. Before the cookie-jar fix this produced a 303 to
     * ?error=invalid carrying a live 400-day session.
     */
    const { factory, recorded } = makeClient({ hasPermission: false });
    const response = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      factory
    );

    assert.equal(response.status, 303);
    assert.match(
      response.headers.get("location") ?? "",
      /\/auth\/login\?portal=admin&error=invalid$/
    );

    const cookies = cookieOutcome(response);
    assert.deepEqual(
      cookies.liveNames,
      [],
      `a rejected login must leave no live cookie, found: ${cookies.liveNames.join(", ")}`
    );
    assert.equal(recorded.signOuts, 1, "the session must be signed out");
  });

  test("signOut can SEE the session sign-in created", () => {
    /*
     * The heart of it. `signOut()` deletes what `getAll()` shows it; if the
     * adapter replays the incoming request, it shows nothing and the deletion
     * never happens. This asserts the jar, not the call.
     */
    return (async () => {
      const { factory, recorded } = makeClient({ hasPermission: false });
      await handleStaffLoginSubmit(makeRequest("admin", ADMIN_EMAIL), factory);
      assert.deepEqual(
        recorded.getAllAfterSignOut[0],
        SESSION.map((c) => c.name),
        "signOut must observe the cookies sign-in just wrote"
      );
    })();
  });

  test("every chunk is cleared, not just the first", async () => {
    const { factory } = makeClient({ hasPermission: false });
    const response = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      factory
    );
    const cookies = cookieOutcome(response);
    for (const chunk of SESSION) {
      const entry = cookies.all.get(chunk.name);
      assert.ok(entry, `${chunk.name} must appear on the response`);
      assert.equal(entry.live, false, `${chunk.name} must be cleared`);
      assert.equal(entry.maxAge, "0", `${chunk.name} must expire immediately`);
    }
  });

  test("the failure is indistinguishable from a wrong password", async () => {
    /*
     * No oracle: the same status, the same Location, the same error code. The
     * only thing that may differ is that neither leaves a session.
     */
    const rejected = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      makeClient({ hasPermission: false }).factory
    );
    const wrongPassword = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      makeClient({ signInFails: true }).factory
    );

    assert.equal(rejected.status, wrongPassword.status);
    assert.equal(
      rejected.headers.get("location"),
      wrongPassword.headers.get("location"),
      "a valid-but-unentitled login must not be distinguishable from a bad one"
    );
    assert.deepEqual(cookieOutcome(rejected).liveNames, []);
    assert.deepEqual(cookieOutcome(wrongPassword).liveNames, []);
  });

  test("the residual difference is a deletion header, and that is deliberate", async () => {
    /*
     * A KNOWN, ACCEPTED ASYMMETRY — recorded so it is a decision rather than an
     * oversight.
     *
     * A rejected-but-valid login emits ONE Set-Cookie: a deletion. A wrong
     * password emits none, because there was never a session to clear. An
     * attacker reading raw headers can therefore tell "valid credentials
     * lacking entitlement" from "bad credentials".
     *
     * Why that is accepted rather than papered over:
     *
     *   - The status, the Location and the body are identical. The brief's
     *     contract is about response and redirect semantics, and those match.
     *   - The same fact is obtainable more directly: those credentials belong
     *     to a staff identity, and the STAFF portal will issue that person a
     *     real session. The admin portal is not the cheapest oracle available.
     *   - Erasing the difference would mean emitting a dummy deletion for a
     *     cookie name this module derived itself — duplicating `@supabase/ssr`'s
     *     naming and chunking internals, which is exactly the coupling the fix
     *     above avoids, and which would silently rot on a library bump.
     *
     * The alternative it replaced was strictly worse: a live 400-day session.
     */
    const rejected = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      makeClient({ hasPermission: false }).factory
    );
    const outcome = cookieOutcome(rejected);
    assert.deepEqual(outcome.liveNames, [], "still nothing usable");
    for (const [, entry] of outcome.all) {
      assert.equal(entry.live, false, "every emitted cookie is a deletion");
    }
  });

  test("the auth response is still uncacheable", async () => {
    /*
     * A response carrying Set-Cookie must never be cached by a CDN, or one
     * visitor's token is served to the next. Deletions included.
     */
    const { factory } = makeClient({ hasPermission: false });
    const response = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      factory
    );
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("expires"), "0");
  });
});

/* -------------------------------------------------------------------------- */
/* 2. The revoked staff branch, which shared the same adapter                   */
/* -------------------------------------------------------------------------- */

describe("a revoked staff login leaves no usable session", () => {
  test("revoked account: generic failure AND no live cookie", async () => {
    /*
     * Same root cause, different branch. A revoked credential authenticates
     * successfully, so the session exists before the check — and was surviving
     * the rejection for exactly the same reason.
     */
    const { factory, recorded } = makeClient({ accessState: "revoked" });
    const response = await handleStaffLoginSubmit(
      makeRequest("staff", STAFF_DIGITS),
      factory
    );

    assert.equal(response.status, 303);
    assert.match(response.headers.get("location") ?? "", /error=invalid/);
    assert.deepEqual(
      cookieOutcome(response).liveNames,
      [],
      "a revoked account must not keep a session"
    );
    assert.equal(recorded.signOuts, 1);
    assert.deepEqual(
      recorded.getAllAfterSignOut[0],
      SESSION.map((c) => c.name),
      "signOut must see the session here too"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Successful logins still work                                             */
/* -------------------------------------------------------------------------- */

describe("entitled logins still receive a session", () => {
  test("a Super Admin gets a live session and the admin destination", async () => {
    const { factory, recorded } = makeClient({ hasPermission: true });
    const response = await handleStaffLoginSubmit(
      makeRequest("admin", ADMIN_EMAIL),
      factory
    );

    assert.equal(response.status, 303);
    assert.match(response.headers.get("location") ?? "", /onedecore\.in\/admin/);
    assert.deepEqual(
      cookieOutcome(response).liveNames.sort(),
      SESSION.map((c) => c.name).sort(),
      "the session must survive a successful login"
    );
    assert.equal(recorded.signOuts, 0, "a successful login must not sign out");
  });

  test("an entitled staff member gets a live session", async () => {
    const { factory, recorded } = makeClient({ accessState: "active", hasPermission: true });
    const response = await handleStaffLoginSubmit(
      makeRequest("staff", STAFF_DIGITS),
      factory
    );

    assert.equal(response.status, 303);
    assert.deepEqual(
      cookieOutcome(response).liveNames.sort(),
      SESSION.map((c) => c.name).sort()
    );
    assert.equal(recorded.signOuts, 0);
  });

  test("the staff identifier still resolves through the server-derived alias", async () => {
    const seen: string[] = [];
    const factory: LoginClientFactory = (adapter) => ({
      auth: {
        async signInWithPassword(credentials) {
          seen.push(credentials.email);
          adapter.setAll([...SESSION], { ...AUTH_HEADERS });
          return { error: null };
        },
        async signOut() {
          return null;
        },
      },
      async rpc(fn: string) {
        if (fn === "record_staff_first_login") {
          return { data: { accessState: "active" }, error: null };
        }
        return { data: true, error: null };
      },
    });

    await handleStaffLoginSubmit(makeRequest("staff", STAFF_DIGITS), factory);
    assert.equal(seen[0], `${STAFF_DIGITS}@${STAFF_LOGIN_AUTH_ALIAS_DOMAIN}`);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. The cookie jar contract                                                  */
/* -------------------------------------------------------------------------- */

describe("the cookie adapter behaves as a live jar", () => {
  /** Capture the adapter the flow builds, by way of the client factory. */
  async function captureAdapter(
    cookies: Record<string, string> = {}
  ): Promise<LoginCookieAdapter> {
    let captured: LoginCookieAdapter | null = null;
    const factory: LoginClientFactory = (adapter) => {
      captured = adapter;
      return {
        auth: {
          async signInWithPassword() {
            return { error: { message: "stop here" } };
          },
          async signOut() {
            return null;
          },
        },
        async rpc() {
          return { data: true, error: null };
        },
      };
    };
    await handleStaffLoginSubmit(makeRequest("admin", ADMIN_EMAIL, cookies), factory);
    assert.ok(captured, "the flow must build an adapter");
    return captured;
  }

  test("getAll starts from the incoming request", async () => {
    const adapter = await captureAdapter({ "sb-existing-auth-token": "prior" });
    assert.deepEqual(
      adapter.getAll().map((c) => c.name),
      ["sb-existing-auth-token"]
    );
  });

  test("getAll reflects a cookie written earlier in the same request", async () => {
    const adapter = await captureAdapter();
    assert.deepEqual(adapter.getAll(), []);
    adapter.setAll([{ name: "sb-x-auth-token", value: "live" }], {});
    assert.deepEqual(
      adapter.getAll().map((c) => c.name),
      ["sb-x-auth-token"],
      "a write must be visible to the next read"
    );
    assert.equal(adapter.getAll()[0]!.value, "live");
  });

  test("a deletion removes the cookie from the jar", async () => {
    const adapter = await captureAdapter();
    adapter.setAll([{ name: "sb-x-auth-token", value: "live" }], {});
    adapter.setAll([{ name: "sb-x-auth-token", value: "", options: { maxAge: 0 } }], {});
    assert.deepEqual(
      adapter.getAll(),
      [],
      "a deleted cookie must read as ABSENT, not as an empty string"
    );
  });

  test("both deletion shapes are recognised", async () => {
    // `@supabase/ssr` writes an empty value; `maxAge: 0` is the other form.
    const byEmptyValue = await captureAdapter();
    byEmptyValue.setAll([{ name: "a-auth-token", value: "v" }], {});
    byEmptyValue.setAll([{ name: "a-auth-token", value: "" }], {});
    assert.deepEqual(byEmptyValue.getAll(), []);

    const byMaxAge = await captureAdapter();
    byMaxAge.setAll([{ name: "b-auth-token", value: "v" }], {});
    byMaxAge.setAll([{ name: "b-auth-token", value: "v", options: { maxAge: 0 } }], {});
    assert.deepEqual(byMaxAge.getAll(), []);
  });

  test("a re-issued cookie replaces rather than duplicates", async () => {
    const adapter = await captureAdapter();
    adapter.setAll([{ name: "sb-x-auth-token", value: "first" }], {});
    adapter.setAll([{ name: "sb-x-auth-token", value: "second" }], {});
    const all = adapter.getAll();
    assert.equal(all.length, 1, "one cookie, not two");
    assert.equal(all[0]!.value, "second");
  });
});

/* -------------------------------------------------------------------------- */
/* 5. The source contract                                                      */
/* -------------------------------------------------------------------------- */

describe("the flow does not reintroduce a frozen jar", () => {
  test("getAll is not wired straight to the request", () => {
    /*
     * `getAll: () => request.cookies.getAll()` is the exact line that caused
     * this. It must not come back.
     */
    const source = code(read(SUBMIT));
    assert.doesNotMatch(
      source,
      /getAll:\s*\(\)\s*=>\s*request\.cookies\.getAll\(\)/,
      "the adapter must not replay the incoming request for the whole request"
    );
    assert.match(source, /cookieJar/, "a live jar must back the adapter");
  });

  test("pending cookies are applied in order so the last write wins", () => {
    const source = code(read(SUBMIT));
    assert.match(source, /for \(const cookie of pendingCookies\)/);
    // No sorting or de-duplication that could let a sign-in outlive a sign-out.
    assert.doesNotMatch(source, /pendingCookies\.(sort|reverse|filter)\(/);
  });

  test("signOut is still scoped to this session only", () => {
    /*
     * The intent is "reject THIS attempt", not "end every session this person
     * has on every device". `signOut()` with no argument is local scope, which
     * is what we want; `scope: "global"` would be a different product decision.
     */
    const source = code(read(SUBMIT));
    assert.match(source, /signOut\(\)/);
    assert.doesNotMatch(source, /scope:\s*["']global["']/);
  });
});
