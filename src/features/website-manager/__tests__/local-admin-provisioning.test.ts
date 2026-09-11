/**
 * Two things that silently broke the local admin, and must not again.
 *
 * 1. `getClaims` PROBES A FIXED LIST.
 *
 *    It does not ask "what permissions does this user hold"; it asks
 *    `authorize()` a hard-coded set of questions and pushes the ones that come
 *    back true. A permission missing from that list is invisible to the whole
 *    application no matter how correctly it is granted — which is exactly what
 *    happened to `website.manage`: seeded, granted to super_admin, enforced by
 *    every RLS policy, and the admin page still said Access Denied.
 *
 *    The list is the contract. This suite asserts it contains what the admin
 *    surfaces actually gate on, so the next permission is added in both places
 *    or fails here.
 *
 * 2. `db:reset` DESTROYS THE ONLY LOCAL LOGIN.
 *
 *    It recreates the database including `auth.users`. Roles and permissions
 *    return because migrations seed them; users do not, because nothing does.
 *    The symptom is indistinguishable from a wrong password — 303 to
 *    `?error=invalid`, no `Set-Cookie` — which is how it reads as "my login is
 *    broken" rather than "the account no longer exists".
 *
 *    `scripts/dev-ensure-superadmin.mjs` is the supported way back. What this
 *    suite defends is that it cannot become a way INTO anything else: no
 *    production host, no hard-coded credential, no RLS bypass, no backdoor.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CLAIMS = "src/server/auth/claims.ts";
const HELPER = "scripts/dev-ensure-superadmin.mjs";
const GUARDS = "scripts/phase-5c1-qa-guards.mjs";

/* -------------------------------------------------------------------------- */
/* 1. The claims probe list                                                    */
/* -------------------------------------------------------------------------- */

describe("getClaims probes every permission the admin actually gates on", () => {
  /** Permission codes `getClaims` asks `authorize()` about. */
  const probed = () => {
    const source = code(read(CLAIMS));
    return [...source.matchAll(/requested_permission:\s*"([^"]+)"/g)].map((m) => m[1]!);
  };

  /** Permission codes `getClaims` actually pushes into the claim set. */
  const published = () => {
    const source = code(read(CLAIMS));
    return [...source.matchAll(/permissions\.push\("([^"]+)"\)/g)].map((m) => m[1]!);
  };

  test("website.manage is probed and published", () => {
    /*
     * THE REGRESSION THIS FILE EXISTS FOR. Removing either line puts the
     * Website Manager behind a permission the application cannot see.
     */
    assert.ok(probed().includes("website.manage"), "website.manage must be probed");
    assert.ok(published().includes("website.manage"), "website.manage must reach the claim set");
  });

  test("admin.access is probed and published", () => {
    // Without it the admin layout refuses everyone, including the owner.
    assert.ok(probed().includes("admin.access"));
    assert.ok(published().includes("admin.access"));
  });

  test("every probed permission is published, and vice versa", () => {
    /*
     * A probe whose result is discarded is dead code that looks like coverage;
     * a push with no probe is an undefined variable. They must be one set.
     */
    assert.deepEqual(
      [...new Set(probed())].sort(),
      [...new Set(published())].sort(),
      "the probe list and the published list describe different permissions"
    );
  });

  test("each permission is probed exactly once", () => {
    const list = probed();
    assert.equal(
      list.length,
      new Set(list).size,
      "a duplicated probe is a wasted round trip on every admin request"
    );
  });

  test("the claim set still refuses an inactive profile", () => {
    /*
     * The other half of the local-login failure mode: a profile the auth
     * trigger created is `pending`, so a freshly provisioned account
     * authenticates and is then bounced. That check must stay.
     */
    const source = code(read(CLAIMS));
    assert.match(source, /profile\.status !== "active"/);
    assert.match(source, /return null;/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. The provisioning helper cannot reach anything but local                  */
/* -------------------------------------------------------------------------- */

describe("dev:ensure-superadmin is local-only and credential-free", () => {
  test("it exists and is wired to an npm script", () => {
    assert.ok(existsSync(join(root, HELPER)));
    const pkg = JSON.parse(read("package.json")) as {
      scripts?: Record<string, string>;
    };
    assert.equal(pkg.scripts?.["dev:ensure-superadmin"], "node scripts/dev-ensure-superadmin.mjs");
  });

  test("it refuses a non-loopback Supabase host", () => {
    /*
     * The guard runs BEFORE any client is constructed, and it is the shared one
     * the Phase 5C1 scripts already use rather than a second copy that could
     * drift more permissive.
     */
    const helper = code(read(HELPER));
    assert.match(helper, /assertLocalSupabaseUrl\(status\.API_URL/);
    assert.match(helper, /from "\.\/phase-5c1-qa-guards\.mjs"/);

    const guards = read(GUARDS);
    assert.match(guards, /LOCAL_HOSTNAMES = new Set\(\["localhost", "127\.0\.0\.1", "::1"\]\)/);
    assert.match(guards, /must target local Supabase/);
  });

  test("the URL and service-role key come from the local stack, never from .env", () => {
    /*
     * Reading `NEXT_PUBLIC_SUPABASE_URL` would make the target whatever the
     * developer's env happened to say — which on a machine configured for the
     * managed project is production.
     */
    const helper = code(read(HELPER));
    assert.match(helper, /supabase", "status", "-o", "json"/);
    assert.doesNotMatch(helper, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.doesNotMatch(helper, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(helper, /dotenv|\.env\.local/);
  });

  test("credentials come only from the environment and are never defaulted", () => {
    const helper = code(read(HELPER));
    assert.match(helper, /process\.env\.ONEDECORE_LOCAL_ADMIN_EMAIL/);
    assert.match(helper, /process\.env\.ONEDECORE_LOCAL_ADMIN_PASSWORD/);
    // No `?? "something"` fallback that would create a known-password account.
    assert.doesNotMatch(helper, /ONEDECORE_LOCAL_ADMIN_PASSWORD\s*\?\?\s*"[^"]+"/);
    assert.doesNotMatch(helper, /ONEDECORE_LOCAL_ADMIN_EMAIL\s*\?\?\s*"[^"]+"/);
  });

  test("no credential is ever printed", () => {
    /*
     * Every console line is checked rather than the file as a whole: the point
     * is that nothing reaches a terminal, a CI log or a screen share.
     */
    const helper = code(read(HELPER));
    const logged = [...helper.matchAll(/console\.(log|error)\(([\s\S]*?)\);/g)].map((m) => m[2]!);
    for (const line of logged) {
      assert.doesNotMatch(line, /\bpassword\b/, `a log line references password: ${line.slice(0, 80)}`);
      assert.doesNotMatch(line, /\bemail\b/, `a log line references email: ${line.slice(0, 80)}`);
    }
  });

  test("it adds no bypass: no RLS change, no backdoor, no service-role in the app", () => {
    const helper = code(read(HELPER));
    for (const forbidden of [
      "disable row level security",
      "alter table",
      "drop policy",
      "create policy",
      "grant ",
      "bypassrls",
    ]) {
      assert.doesNotMatch(
        helper,
        new RegExp(forbidden, "i"),
        `${forbidden} has no business in a provisioning helper`
      );
    }
    // It grants a ROLE, and lets the migrations' role-permission grants decide
    // what that role can do.
    assert.match(helper, /insert into public\.user_roles/);
    assert.doesNotMatch(helper, /insert into public\.role_permissions/);
    assert.doesNotMatch(helper, /insert into public\.permissions/);
  });

  test("it is idempotent: an existing user is updated, not duplicated", () => {
    const helper = code(read(HELPER));
    assert.match(helper, /updateUserById/);
    assert.match(helper, /on conflict do nothing/);
    // Found by email, not by a pinned uuid that a second email would overwrite.
    assert.match(helper, /user\.email \?\? ""\)\.toLowerCase\(\) === email\.toLowerCase\(\)/);
  });

  test("it activates the profile, because the auth trigger leaves it pending", () => {
    const helper = code(read(HELPER));
    assert.match(helper, /set status = 'active'/);
  });

  test("it verifies the result instead of assuming it", () => {
    /*
     * A provisioning script that prints "done" without checking is how the
     * profile-status gap went unnoticed in the first place.
     */
    const helper = code(read(HELPER));
    assert.match(helper, /if \(profileStatus !== "active"\)/);
    assert.match(helper, /admin\.access/);
    assert.match(helper, /website\.manage/);
    assert.match(helper, /missing\.length > 0/);
  });

  test("it is a dev script, not application code", () => {
    // Nothing in src/ imports it, so it cannot run in a deployed app.
    const helper = HELPER.replace("scripts/", "");
    for (const dir of ["src"]) {
      assert.equal(
        existsSync(join(root, dir, helper)),
        false,
        "the helper must live only in scripts/"
      );
    }
  });
});
