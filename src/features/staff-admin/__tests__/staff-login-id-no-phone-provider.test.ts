/**
 * Staff login ID with the Supabase Phone provider DISABLED.
 *
 * The owner's decision: a staff member's unique 10-digit Indian mobile is the
 * only login ID they ever see or type. No OTP, no SMS, no self-service reset —
 * a Super Admin sets every password.
 *
 * The Phone provider is off and stays off, and the first real staff sign-in
 * proved the consequence on the live stack:
 *
 *     422 Phone logins are disabled  ·  error_code=phone_provider_disabled
 *
 * Hosted Supabase password auth accepts only an email or a phone identifier, so
 * the transport now uses a deterministic, non-deliverable alias derived from
 * that same number. This suite guards both halves of that: the alias works as a
 * transport, and it never becomes a second identity — not in the UI, not in
 * errors, not as contact information.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  looksLikeStaffLoginPhone,
  normalizeStaffLoginPhone,
  staffLoginUsername,
} from "../contracts/staff-login-phone.ts";
import {
  STAFF_LOGIN_AUTH_ALIAS_DOMAIN,
  isStaffLoginAuthAlias,
  staffLoginAuthAlias,
} from "../server/staff-login-auth-alias.ts";
import {
  STAFF_PERMISSION_CODES,
  STAFF_ROLE_PERMISSIONS,
} from "../contracts/permissions.ts";
import {
  StaffIdentityConflictError,
  changeStaffAuthLoginPhone,
  convertStaffAuthLoginToAlias,
  issueStaffPhoneCredentials,
  reactivateStaffAuthAccess,
  resetStaffPhonePassword,
  revokeStaffAuthAccess,
  type StaffCredentialDeps,
} from "../server/staff-credential-provisioning.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** The login mutation authority — now a Route Handler flow, not a Server Action. */
const LOGIN_ACTION = "src/features/staff-admin/server/staff-login-submit.ts";
const LOGIN_FORM = "src/app/auth/login/login-form.tsx";
const CONTRACT = "src/features/staff-admin/contracts/staff-login-phone.ts";
const PROVISIONING =
  "src/features/staff-admin/server/staff-credential-provisioning.ts";
const ADAPTER = "src/features/staff-admin/server/staff-invite-adapter.ts";
const PANEL = "src/features/staff-admin/components/StaffLoginAccessPanel.tsx";
const CREDENTIAL_ACTIONS =
  "src/features/staff-admin/server/staff-credential-actions.ts";
const ALIAS_MODULE = "src/features/staff-admin/server/staff-login-auth-alias.ts";
const PHONE_MIGRATION =
  "supabase/migrations/20260903160000_staff_phone_login_credentials.sql";

const STAFF_ID = "11111111-1111-4111-8111-111111111111";
const DIGITS = "7447863402";
const E164 = "+917447863402";
const ALIAS = `${DIGITS}@${STAFF_LOGIN_AUTH_ALIAS_DOMAIN}`;

const NEW_DIGITS = "9812345678";
const NEW_E164 = "+919812345678";
const NEW_ALIAS = `${NEW_DIGITS}@${STAFF_LOGIN_AUTH_ALIAS_DOMAIN}`;

interface Call {
  readonly path: string;
  readonly method: string;
  readonly body?: Record<string, unknown>;
}

function deps(
  handler: (call: Call) => { status: number; body?: unknown }
): { readonly deps: StaffCredentialDeps; readonly calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    deps: {
      authorizedRequest: async (path, init) => {
        const call: Call = { path, method: init.method, body: init.body };
        calls.push(call);
        const { status, body } = handler(call);
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
          text: async () => JSON.stringify(body ?? {}),
        };
      },
    },
  };
}

/* ========================================================================== */
/* 1. The staff-visible login ID is the 10-digit mobile, and only that         */
/* ========================================================================== */

describe("the 10-digit mobile is the only staff-visible login ID", () => {
  test("exactly ten Indian mobile digits route to the staff path", () => {
    for (const value of ["7447863402", "9812345678", "6000000000"]) {
      assert.ok(looksLikeStaffLoginPhone(value), `${value} should be a staff login`);
    }
  });

  test("9- and 11-digit values are rejected, never repaired", () => {
    for (const value of ["744786340", "74478634021", "1234567890", ""]) {
      assert.equal(
        looksLikeStaffLoginPhone(value),
        false,
        `${value} must not be a staff login`
      );
      assert.equal(normalizeStaffLoginPhone(value).ok, false);
    }
  });

  test("the login field takes the BARE ten digits, not +91", () => {
    // The form contract is the 10 digits staff are told to type. A +91-prefixed
    // value is not a staff login identifier and must fall through to the email
    // path, where it simply fails as an unknown address.
    assert.equal(looksLikeStaffLoginPhone("+917447863402"), false);
    assert.equal(looksLikeStaffLoginPhone("917447863402"), false);
  });

  test("the username shown anywhere is the last 10 digits", () => {
    assert.equal(staffLoginUsername(E164), DIGITS);
  });

  test("the form asks for the login ID without naming any transport", () => {
    const form = read(LOGIN_FORM);
    assert.match(form, /Staff Login ID or Email/);
    assert.match(form, /Staff sign in with their unique 10-digit mobile number/);
    assert.doesNotMatch(form, /OTP|SMS|one-time|verification code/i);
    assert.doesNotMatch(form, /alias|staff-login\.onedecore/i);
    assert.doesNotMatch(form, /forgot|reset your password/i);
  });
});

/* ========================================================================== */
/* 2. The alias is derived, deterministic, and closed to arbitrary input       */
/* ========================================================================== */

describe("the internal auth alias", () => {
  test("is deterministic from the canonical login number", () => {
    assert.equal(staffLoginAuthAlias(DIGITS), ALIAS);
    assert.equal(staffLoginAuthAlias(E164), ALIAS);
    assert.equal(staffLoginAuthAlias("917447863402"), ALIAS);
    // Same input, same output, every time.
    assert.equal(staffLoginAuthAlias(DIGITS), staffLoginAuthAlias(E164));
  });

  test("uses a reserved non-deliverable domain", () => {
    // RFC 2606 reserves `.invalid`; it can never resolve, so nothing can be
    // delivered to it even by accident.
    assert.match(STAFF_LOGIN_AUTH_ALIAS_DOMAIN, /\.invalid$/);
    assert.match(ALIAS, /^[6-9]\d{9}@[a-z0-9.-]+\.invalid$/);
  });

  test("cannot be minted from arbitrary or email input", () => {
    for (const value of [
      "owner@onedecore.com",
      "7447863402@staff-login.onedecore.invalid",
      "not-a-number",
      "744786340",
      "0000000000",
      "",
      null,
      undefined,
    ]) {
      assert.equal(
        staffLoginAuthAlias(value),
        null,
        `${String(value)} must not produce an alias`
      );
    }
  });

  test("recognises its own aliases and nothing else", () => {
    assert.ok(isStaffLoginAuthAlias(ALIAS));
    assert.equal(isStaffLoginAuthAlias("owner@onedecore.com"), false);
    assert.equal(isStaffLoginAuthAlias("123@staff-login.onedecore.invalid"), false);
    assert.equal(isStaffLoginAuthAlias(null), false);
  });

  test("the closure against email input is enforced by the normalizer", () => {
    // `staffLoginAuthAlias` is safe only because normalization rejects anything
    // that is not digits (with an optional leading "+"). If that guard were
    // relaxed, an address pasted into the login field could be re-derived into
    // an alias and take the staff path.
    const contract = read(CONTRACT);
    assert.match(contract, /\^\\\+\?\\d\+\$/);
    assert.equal(normalizeStaffLoginPhone("owner@onedecore.com").ok, false);
    assert.equal(normalizeStaffLoginPhone("7447863402@x.invalid").ok, false);

    // And the contract module itself never logs.
    assert.doesNotMatch(contract, /console\.(log|error|warn|info)/);
  });
});

/* ========================================================================== */
/* 3. Sign-in uses the alias; the Super Admin email path is untouched          */
/* ========================================================================== */

describe("the login action", () => {
  test("signs staff in with the alias, never with a phone", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /staffLoginAuthAlias\(identifier\)/);
    assert.match(source, /signInWithPassword\(\{\s*email: alias/);
    assert.doesNotMatch(source, /signInWithPassword\(\{\s*phone:/);
    assert.doesNotMatch(source, /phone: phone\.e164/);
  });

  test("the Super Admin email/password path is unchanged", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /signInWithPassword\(\{\s*email: identifier\.toLowerCase\(\)/);
  });

  test("every failure funnels through ONE generic path", () => {
    const source = read(LOGIN_ACTION);

    // A single opaque code, and a single helper that builds every failure
    // response. Wrong password, unknown login, revoked and a submitted alias are
    // therefore indistinguishable to the caller by construction.
    assert.match(source, /export const LOGIN_ERROR_CODE = "invalid";/);
    assert.match(source, /url\.searchParams\.set\("error", LOGIN_ERROR_CODE\)/);

    const failures = source.match(/return fail\(\);/g) ?? [];
    assert.ok(failures.length >= 4, `expected several failures to share fail(): ${failures.length}`);

    // Exactly one place sets the error param, and it sets only that code.
    // (The literal "revoked" DOES appear in this module, as the access-state
    // comparison — it is never emitted to the browser.)
    const errorSets = source.match(/searchParams\.set\("error",[^)]*\)/g) ?? [];
    assert.equal(errorSets.length, 1, "only one error code may ever be emitted");
    assert.match(errorSets[0]!, /LOGIN_ERROR_CODE/);
  });

  test("the first-login and authorize flow is preserved", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /record_staff_first_login/);
    assert.match(source, /requested_permission: "admin\.access"/);
    assert.match(source, /getSafeAdminRedirect\(readField\(form, "next"\)\)/);

    // The revoked check still runs after a genuine sign-in.
    assert.match(source, /accessState === "revoked"/);
    assert.match(source, /auth\.signOut\(\)/);
  });

  test("the alias never leaves the action", () => {
    const source = read(LOGIN_ACTION);
    // No error path, log line or return value carries it.
    assert.doesNotMatch(source, /console\.(log|error|warn)/);
    assert.doesNotMatch(source, /error: alias|error: `[^`]*alias/);
    assert.doesNotMatch(source, /return \{ error: [^}]*alias/);
  });
});

/* ========================================================================== */
/* 3b. A submitted alias is not a login identifier                             */
/* ========================================================================== */

describe("the alias is refused when typed into the login form", () => {
  /*
   * Without this guard the alias sails past the 10-digit test and lands on the
   * generic email path, where a correct password authenticates it — handing
   * every staff member a second login the owner never authorised, guessable by
   * anyone who knows their mobile number.
   */

  test("an alias submitted as the identifier is detected", () => {
    assert.ok(isStaffLoginAuthAlias(ALIAS));
    assert.ok(isStaffLoginAuthAlias(`  ${ALIAS.toUpperCase()}  `), "trimmed, case-insensitive");
    assert.ok(isStaffLoginAuthAlias(NEW_ALIAS));
  });

  test("a real address is NOT caught by the guard", () => {
    // The Super Admin must still be able to sign in.
    for (const value of [
      "owner@onedecore.com",
      "admin@staff-login.onedecore.com",
      "7447863402@gmail.com",
      "staff-login.onedecore.invalid",
      "a@b@staff-login.onedecore.invalid",
    ]) {
      assert.equal(
        isStaffLoginAuthAlias(value),
        false,
        `${value} must not be treated as an internal alias`
      );
    }
  });

  test("the action refuses it with the SAME generic error", () => {
    const source = read(LOGIN_ACTION);
    const guardAt = source.indexOf("isStaffLoginAuthAlias(identifier)");
    assert.ok(guardAt > 0, "the login action must check for a submitted alias");

    // The guard returns immediately, with the shared message — indistinguishable
    // from a wrong password, so the form cannot be used to probe for aliases.
    const guardBody = source.slice(guardAt, guardAt + 120);
    assert.match(guardBody, /return fail\(\);/);
  });

  test("no authentication is attempted for a submitted alias", () => {
    const source = read(LOGIN_ACTION);
    const guardAt = source.indexOf("isStaffLoginAuthAlias(identifier)");
    const clientAt = source.indexOf("createClientWithCookies({");
    // The CALL, not the interface declaration that also names it.
    const firstSignIn = source.indexOf("await supabase.auth.signInWithPassword(");

    // The guard runs before the Supabase client even exists, so a submitted
    // alias produces no credential test of any kind.
    assert.ok(guardAt > 0 && clientAt > 0 && firstSignIn > 0);
    assert.ok(guardAt < clientAt, "the alias guard must precede client creation");
    assert.ok(guardAt < firstSignIn, "the alias guard must precede any sign-in");
  });

  test("the staff account is reachable ONLY through the 10-digit route", () => {
    // The number routes to the staff path; its alias does not route anywhere.
    assert.ok(looksLikeStaffLoginPhone(DIGITS));
    assert.equal(looksLikeStaffLoginPhone(ALIAS), false);
    assert.equal(isStaffLoginAuthAlias(DIGITS), false);

    // And the alias cannot be re-derived from the submitted alias text, so
    // there is no second way in even if the guard order were changed.
    assert.equal(staffLoginAuthAlias(ALIAS), null);
  });
});

/* ========================================================================== */
/* 3c. The alias module is server-only, not merely tree-shaken                 */
/* ========================================================================== */

describe("the alias module cannot be reached from the client", () => {
  /** Every "use client" file in the app. */
  function clientComponents(): readonly string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "__tests__") continue;
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const src = read(rel);
          if (/^\s*["']use client["']/m.test(src)) {
            out.push(rel);
          }
        }
      }
    };
    walk("src");
    return out;
  }

  test("the module declares the server-only guard", () => {
    const src = read(ALIAS_MODULE);
    // Not a comment — the import itself, which fails the build if a client
    // module pulls it in. Tree-shaking is an optimisation, not a boundary.
    assert.match(src, /^import "server-only";/m);
  });

  test("the shared contract no longer carries the transport detail", () => {
    const contract = read(CONTRACT);
    assert.doesNotMatch(contract, /export function staffLoginAuthAlias/);
    assert.doesNotMatch(contract, /export function isStaffLoginAuthAlias/);
    assert.doesNotMatch(contract, /STAFF_LOGIN_AUTH_ALIAS_DOMAIN\s*=/);
    assert.doesNotMatch(contract, /staff-login\.onedecore\.invalid/);

    // What Client Components legitimately need stayed put.
    assert.match(contract, /export const STAFF_PASSWORD_MIN_LENGTH/);
    assert.match(contract, /export function staffLoginUsername/);
    assert.match(contract, /export function normalizeStaffLoginPhone/);
  });

  test("no client component imports it or names the domain", () => {
    const clients = clientComponents();
    assert.ok(clients.length > 0, "expected to find client components to scan");

    for (const rel of clients) {
      const src = read(rel);
      assert.ok(
        !src.includes("staff-login-auth-alias"),
        `${rel} must not import the server-only alias module`
      );
      assert.ok(
        !src.includes("staff-login.onedecore.invalid"),
        `${rel} must not contain the alias domain`
      );
      for (const name of [
        "staffLoginAuthAlias",
        "isStaffLoginAuthAlias",
        "STAFF_LOGIN_AUTH_ALIAS_DOMAIN",
      ]) {
        assert.ok(!src.includes(name), `${rel} must not reference ${name}`);
      }
    }
  });

  test("the credential panel still gets what it actually needs", () => {
    // The panel is the client component that forced the split: it imports the
    // shared contract, which must keep working.
    const panel = read(PANEL);
    assert.match(panel, /staff-login-phone/);
    assert.doesNotMatch(panel, /staff-login-auth-alias/);
  });

  test("only server modules import the alias", () => {
    // An actual import statement — a comment NAMING the module is fine and is
    // exactly how the shared contract documents where the detail moved to.
    const IMPORTS_ALIAS = /^\s*import[\s\S]{0,200}?["'][^"']*staff-login-auth-alias/m;

    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(entry.name) && IMPORTS_ALIAS.test(read(rel))) {
          importers.push(rel);
        }
      }
    };
    walk("src");

    assert.ok(importers.length > 0, "expected the alias module to be used");
    for (const rel of importers) {
      assert.ok(
        rel.includes("/server/") || rel.includes("/__tests__/") || rel === LOGIN_ACTION,
        `unexpected importer of the server-only alias module: ${rel}`
      );
    }
  });
});

/* ========================================================================== */
/* 4. Credential operations over the Auth Admin transport                      */
/* ========================================================================== */

describe("issuing credentials", () => {
  test("creates the Auth identity with the EXISTING staff UUID", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET" ? { status: 404 } : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await issueStaffPhoneCredentials(
      { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
      d
    );

    assert.equal(result.userId, STAFF_ID);
    assert.equal(result.identityCreated, true);

    const create = calls.find((c) => c.method === "POST");
    // auth.uid() must keep matching profiles.id, so the UUID is supplied.
    assert.equal(create?.body?.id, STAFF_ID);
  });

  test("uses the alias and the supplied password, and sends nothing", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET" ? { status: 404 } : { status: 200, body: { id: STAFF_ID } }
    );

    await issueStaffPhoneCredentials(
      { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
      d
    );

    const create = calls.find((c) => c.method === "POST");
    assert.equal(create?.body?.email, ALIAS);
    assert.equal(create?.body?.email_confirm, true, "confirmed, so no mail is awaited");
    assert.equal(create?.body?.password, "LongEnough1");

    // No phone credential: the provider is disabled.
    assert.equal("phone" in (create?.body ?? {}), false);
    assert.equal("phone_confirm" in (create?.body ?? {}), false);

    // Nothing that would dispatch a message.
    for (const call of calls) {
      assert.doesNotMatch(call.path, /invite|magiclink|recover|otp|resend/i);
    }
  });

  test("a login number that is not valid stops before any Auth write", async () => {
    const { deps: d, calls } = deps(() => ({ status: 200, body: { id: STAFF_ID } }));

    await assert.rejects(
      () =>
        issueStaffPhoneCredentials(
          { staffId: STAFF_ID, loginPhoneE164: "+9112345", password: "LongEnough1", displayName: "A" },
          d
        ),
      StaffIdentityConflictError
    );
    assert.equal(calls.length, 0, "no request may be made for an invalid login number");
  });

  test("an identity under a DIFFERENT number is a conflict, not an overwrite", async () => {
    const { deps: d } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: NEW_ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    await assert.rejects(
      () =>
        issueStaffPhoneCredentials(
          { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
          d
        ),
      /different mobile number/
    );
  });
});

describe("reset, revoke, reactivate", () => {
  test("a password reset keeps the UUID and does not move the alias", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await resetStaffPhonePassword(
      { staffId: STAFF_ID, password: "BrandNewPass1" },
      d
    );

    assert.equal(result.userId, STAFF_ID);
    const put = calls.find((c) => c.method === "PUT");
    assert.equal(put?.body?.password, "BrandNewPass1");
    // The identifier is not touched: the staff member's login ID is unchanged.
    assert.equal("email" in (put?.body ?? {}), false);
    assert.ok(calls.every((c) => c.path.includes(STAFF_ID)));
  });

  test("revoke still bans, reactivate still unbans", async () => {
    const { deps: revokeDeps, calls: revokeCalls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );
    const revoked = await revokeStaffAuthAccess({ staffId: STAFF_ID }, revokeDeps);
    assert.equal(revoked.banned, true);
    assert.equal(
      typeof revokeCalls.find((c) => c.method === "PUT")?.body?.ban_duration,
      "string"
    );

    const { deps: backDeps, calls: backCalls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );
    await reactivateStaffAuthAccess({ staffId: STAFF_ID }, backDeps);
    assert.equal(backCalls.find((c) => c.method === "PUT")?.body?.ban_duration, "none");
  });
});

describe("changing the login number", () => {
  test("moves the alias, keeps UUID and password, invalidates old sessions", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await changeStaffAuthLoginPhone(
      { staffId: STAFF_ID, loginPhoneE164: NEW_E164 },
      d
    );

    assert.equal(result.userId, STAFF_ID, "the UUID never moves");

    const puts = calls.filter((c) => c.method === "PUT");
    assert.equal(puts[0]?.body?.email, NEW_ALIAS);
    assert.equal(puts[0]?.body?.email_confirm, true);
    // The password is never re-sent, so the employee keeps their own.
    assert.ok(puts.every((p) => !("password" in (p.body ?? {}))));

    // Ban then unban, so a session opened under the old number cannot refresh.
    assert.equal(typeof puts[1]?.body?.ban_duration, "string");
    assert.equal(puts[2]?.body?.ban_duration, "none");

    // The OLD number no longer maps to any identifier this user carries.
    assert.notEqual(staffLoginAuthAlias(DIGITS), NEW_ALIAS);
  });
});

/* ========================================================================== */
/* 5. SM001 — in-place transport repair                                        */
/* ========================================================================== */

describe("converting an identity issued under the phone provider", () => {
  /** SM001 as it exists today: right UUID, right password, phone-only. */
  const legacy = { id: STAFF_ID, phone: "917447863402", email: null };

  test("updates the EXISTING user instead of recreating it", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET" ? { status: 200, body: legacy } : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await convertStaffAuthLoginToAlias(
      { staffId: STAFF_ID, loginPhoneE164: E164 },
      d
    );

    assert.equal(result.userId, STAFF_ID);
    assert.equal(result.converted, true);

    // No create, no delete — only an update addressed by the existing id.
    assert.equal(calls.some((c) => c.method === "POST"), false);
    assert.equal(calls.some((c) => c.method === "DELETE"), false);
    assert.ok(calls.every((c) => c.path.includes(STAFF_ID)));

    const put = calls.find((c) => c.method === "PUT");
    assert.equal(put?.body?.email, ALIAS);
    assert.equal(put?.body?.email_confirm, true);
  });

  test("does NOT reset the password", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET" ? { status: 200, body: legacy } : { status: 200, body: { id: STAFF_ID } }
    );

    await convertStaffAuthLoginToAlias({ staffId: STAFF_ID, loginPhoneE164: E164 }, d);

    // Omitting the field is what preserves the existing hash.
    for (const call of calls) {
      assert.equal(
        "password" in (call.body ?? {}),
        false,
        "conversion must never send a password"
      );
    }
  });

  test("does not disturb the employment phone or ban state", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET" ? { status: 200, body: legacy } : { status: 200, body: { id: STAFF_ID } }
    );

    await convertStaffAuthLoginToAlias({ staffId: STAFF_ID, loginPhoneE164: E164 }, d);

    for (const call of calls) {
      assert.equal("phone" in (call.body ?? {}), false);
      assert.equal("ban_duration" in (call.body ?? {}), false);
    }
  });

  test("is idempotent — a converted identity is not written again", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await convertStaffAuthLoginToAlias(
      { staffId: STAFF_ID, loginPhoneE164: E164 },
      d
    );

    assert.equal(result.converted, false);
    assert.equal(calls.some((c) => c.method === "PUT"), false, "no write on a no-op");
  });

  test("refuses to rebind an identity already on another number", async () => {
    const { deps: d } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, email: NEW_ALIAS } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    await assert.rejects(
      () => convertStaffAuthLoginToAlias({ staffId: STAFF_ID, loginPhoneE164: E164 }, d),
      /already bound to a different mobile number/
    );
  });

  test("a missing identity is a conflict, not a silent create", async () => {
    const { deps: d, calls } = deps(() => ({ status: 404 }));

    await assert.rejects(
      () => convertStaffAuthLoginToAlias({ staffId: STAFF_ID, loginPhoneE164: E164 }, d),
      /no login identity to convert/
    );
    assert.equal(calls.some((c) => c.method === "POST"), false);
  });

  test("it is explicit and owner-invoked, never automatic on sign-in", () => {
    // Wiring it into the login action would let an unauthenticated request
    // trigger an Auth write.
    const loginAction = read(LOGIN_ACTION);
    assert.doesNotMatch(loginAction, /convertStaffAuthLoginToAlias/);
    assert.doesNotMatch(loginAction, /createAdminClient|serviceRole/);

    // It is exposed deliberately, through the audited adapter.
    assert.match(read(ADAPTER), /convertStaffAuthLoginToAliasInAuth/);
  });
});

/* ========================================================================== */
/* 6. Prohibitions — OTP, SMS, self-reset, signup                              */
/* ========================================================================== */

describe("no OTP, no SMS, no self-service reset, no signup", () => {
  /** Application source only — library typings in node_modules are irrelevant. */
  function appSources(): readonly string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "__tests__") continue;
          walk(rel);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          out.push(rel);
        }
      }
    };
    walk("src");
    return out;
  }

  test("no OTP API is called anywhere in application source", () => {
    for (const rel of appSources()) {
      const src = read(rel);
      for (const forbidden of [
        "signInWithOtp",
        "verifyOtp",
        "resend(",
        "signUp(",
      ]) {
        assert.ok(
          !src.includes(forbidden),
          `${rel} must not call ${forbidden}`
        );
      }
    }
  });

  test("no staff sign-in uses a phone identifier", () => {
    for (const rel of appSources()) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /signInWithPassword\(\s*\{\s*phone/,
        `${rel} must not sign in with a phone`
      );
    }
  });

  test("ONEDECORE exposes no forgot-password, self-reset or signup route", () => {
    const routes = readdirSync(join(root, "src/app/auth"), {
      withFileTypes: true,
    })
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
  });

  test("the app-level signup claim is scoped honestly", () => {
    /*
     * WHAT THE TESTS ABOVE PROVE:
     *   "No ONEDECORE public signup path exists in application source."
     *
     * WHAT THEY DO NOT PROVE:
     *   "Project-level Supabase public signup is disabled."
     *
     * This distinction matters BECAUSE the alias is deterministic. If the
     * Supabase project still allows new users to sign up, an external caller
     * holding only the public project URL and publishable key could attempt to
     * register `<10digits>@staff-login.onedecore.invalid` before the owner
     * issues that employee's credentials. Such a user gains no application
     * permission — `authorize("admin.access")` and every RLS policy still deny
     * them — but the collision would block staff onboarding, which is a
     * denial-of-service on the credential workflow rather than a breach.
     *
     * Disabling `Allow new users to sign up` in the Supabase dashboard is
     * therefore a PRODUCTION DEPLOYMENT GATE, not something this repository can
     * assert. Admin-created users must stay allowed — that is how every staff
     * credential is issued.
     *
     * This test exists to keep that caveat next to the code it qualifies, so a
     * later reader does not mistake the source scan for proof of the external
     * setting.
     */
    const aliasModule = read(ALIAS_MODULE);
    // The alias is derived from a public fact (the staff mobile), so its
    // secrecy is never load-bearing — the guarantees rest on RLS and authorize.
    assert.match(aliasModule, /deterministic|derived/);
    assert.ok(true, "documented deployment gate, not an in-repo assertion");
  });

  test("password control stays exclusively with the Super Admin", () => {
    assert.ok(STAFF_PERMISSION_CODES.includes("staff.credentials.manage"));
    assert.ok(
      STAFF_ROLE_PERMISSIONS.super_admin.includes("staff.credentials.manage")
    );
    for (const role of [
      "sales_manager",
      "sales_executive",
      "project_manager",
      "designer",
    ] as const) {
      assert.ok(
        !STAFF_ROLE_PERMISSIONS[role].includes("staff.credentials.manage"),
        `${role} must not manage credentials`
      );
    }
  });
});

/* ========================================================================== */
/* 7. The alias stays out of the UI, the audit trail and the client bundle     */
/* ========================================================================== */

describe("the alias is never user-facing", () => {
  test("no client component derives or renders it", () => {
    for (const rel of [LOGIN_FORM, PANEL]) {
      const src = read(rel);
      assert.doesNotMatch(src, /staffLoginAuthAlias|STAFF_LOGIN_AUTH_ALIAS_DOMAIN/);
      assert.doesNotMatch(src, /staff-login\.onedecore\.invalid/);
    }
  });

  test("credential action feedback never returns it", () => {
    const actions = read(CREDENTIAL_ACTIONS);
    assert.doesNotMatch(actions, /staffLoginAuthAlias/);
    assert.doesNotMatch(actions, /staff-login\.onedecore\.invalid/);
  });

  test("the transport module never logs it", () => {
    const provisioning = read(PROVISIONING);
    assert.doesNotMatch(provisioning, /console\.(log|error|warn|info)/);
    // Errors name the login number's validity, never the derived value.
    assert.doesNotMatch(provisioning, /\$\{alias\}/);
  });

  test("no credential result carries the alias back to the caller", () => {
    const provisioning = read(PROVISIONING);
    for (const shape of [
      /return \{[^}]*alias[^}]*\}/,
      /readonly alias/,
      /readonly email:/,
    ]) {
      assert.doesNotMatch(provisioning, shape);
    }
  });

  test("the alias is not persisted as staff contact information", () => {
    const provisioning = read(PROVISIONING);
    const actions = read(CREDENTIAL_ACTIONS);
    for (const src of [provisioning, actions]) {
      assert.doesNotMatch(src, /login_email|auth_email|staff_email\b/);
    }
  });
});

/* ========================================================================== */
/* 8. Nothing structural changed                                               */
/* ========================================================================== */

describe("no schema, no migration, no collateral", () => {
  test("uniqueness still comes from the canonical login phone", () => {
    const sql = read(PHONE_MIGRATION);
    assert.match(sql, /login_phone_e164/);
    assert.match(sql, /unique/i);
    // No competing login identifier was introduced.
    assert.doesNotMatch(sql, /login_email|auth_alias|username text/);
  });

  test("the historical phone-login migration is unedited", () => {
    // Its original contract must still read exactly as shipped.
    const sql = read(PHONE_MIGRATION);
    assert.match(sql, /login_phone_e164/);
    assert.match(sql, /staff\.credentials\.manage/);
  });

  test("no migration was added for this change", () => {
    const migrations = readdirSync(join(root, "supabase", "migrations"));
    for (const name of migrations) {
      assert.doesNotMatch(
        name,
        /alias|login_email|phone_provider/i,
        `unexpected migration ${name}`
      );
    }
    // The last shipped migration is still the P5 catalogue.
    assert.ok(
      migrations.some((n) => n.startsWith("20260904170000")),
      "expected the known head migration to still be present"
    );
  });

  test("the mobile CRM read contract from PR #135 is untouched", () => {
    const leads = read("src/app/api/mobile/crm/leads/route.ts");
    const pipeline = read("src/app/api/mobile/crm/pipeline/route.ts");
    assert.match(leads, /queryLeadListPage\(auth\.context, query, auth\.db\)/);
    assert.match(pipeline, /fetchCrmPipelineBoard\(/);
    assert.match(read("src/lib/supabase/bearer.ts"), /publishableKey/);
  });

  test("the service-role key is still acquired in exactly one place", () => {
    const provisioning = read(PROVISIONING);
    assert.doesNotMatch(provisioning, /serviceRoleKey|createAdminClient/);
    assert.match(read(ADAPTER), /serviceRoleKey/);
  });
});
