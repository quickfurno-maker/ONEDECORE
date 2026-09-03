/**
 * Workforce V1 — staff phone login + Super Admin credential control.
 *
 * The database contract is proved in
 * supabase/tests/database/44_staff_phone_login_credentials_test.sql. This suite
 * covers the application layer: the canonical phone contract, the login-form
 * routing, and the Auth Admin transport — the last exercised for real with an
 * injected request function rather than asserted by reading the source.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  STAFF_LOGIN_PHONE_E164_PATTERN,
  STAFF_PASSWORD_MIN_LENGTH,
  looksLikeStaffLoginPhone,
  normalizeStaffLoginPhone,
  sanitizeStaffLoginPhoneInput,
  staffLoginUsername,
  validateStaffPassword,
} from "../contracts/staff-login-phone.ts";
import {
  STAFF_ACCESS_STATE_CODES,
  STAFF_PERMISSION_CODES,
  STAFF_ROLE_PERMISSIONS,
} from "../contracts/permissions.ts";
import { INITIAL_STAFF_CREDENTIAL_FORM_STATE } from "../contracts/staff-credential-form-state.ts";
import {
  StaffIdentityConflictError,
  changeStaffAuthLoginPhone,
  issueStaffPhoneCredentials,
  reactivateStaffAuthAccess,
  resetStaffPhonePassword,
  revokeStaffAuthAccess,
  type StaffCredentialDeps,
} from "../server/staff-credential-provisioning.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips SQL comments: the migration DESCRIBES rules it must not merely mention. */
const executableSql = (rel: string) =>
  read(rel)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const MIGRATION = "supabase/migrations/20260903160000_staff_phone_login_credentials.sql";
const LOGIN_ACTION = "src/app/auth/login/actions.ts";
const LOGIN_FORM = "src/app/auth/login/login-form.tsx";
const PANEL = "src/features/staff-admin/components/StaffLoginAccessPanel.tsx";
const CREDENTIAL_ACTIONS = "src/features/staff-admin/server/staff-credential-actions.ts";

const STAFF_ID = "11111111-1111-4111-8111-111111111111";
const E164 = "+917447863402";

// -----------------------------------------------------------------------------
// Auth Admin transport double
// -----------------------------------------------------------------------------

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

describe("staff login username — the canonical phone contract", () => {
  test("the 10 digits staff type become +91XXXXXXXXXX", () => {
    const result = normalizeStaffLoginPhone("7447863402");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.e164, "+917447863402");
    assert.equal(result.ok && result.digits, "7447863402");
  });

  test("the canonical and pasted forms are accepted", () => {
    for (const raw of ["+917447863402", "917447863402"]) {
      const result = normalizeStaffLoginPhone(raw);
      assert.equal(result.ok, true, raw);
      assert.equal(result.ok && result.e164, E164);
    }
  });

  test("invalid mobile inputs are rejected, never repaired", () => {
    for (const raw of [
      "744786340", // 9 digits
      "74478634021", // 11 digits
      "5447863402", // not an Indian mobile range
      "0447863402",
      "",
      "   ",
      "74478 63402", // spaces
      "+91-7447863402", // punctuation
      "abcdefghij",
      "+447447863402", // wrong country
    ]) {
      assert.equal(normalizeStaffLoginPhone(raw).ok, false, `"${raw}" must be rejected`);
    }
    assert.equal(normalizeStaffLoginPhone(null).ok, false);
  });

  test("the stored value always matches the database check constraint", () => {
    const result = normalizeStaffLoginPhone("7447863402");
    assert.ok(result.ok && STAFF_LOGIN_PHONE_E164_PATTERN.test(result.e164));
  });

  test("the username shown to staff is derived from the canonical value", () => {
    assert.equal(staffLoginUsername(E164), "7447863402");
    assert.equal(staffLoginUsername(null), null);
    // A contact number that is not a valid login is not presented as a username.
    assert.equal(staffLoginUsername("+9174478634"), null);
  });

  test("input sanitising reuses the existing E.164 helper behaviour", () => {
    assert.equal(sanitizeStaffLoginPhoneInput("+91 74478-63402"), "7447863402");
    assert.equal(sanitizeStaffLoginPhoneInput("744786340299"), "7447863402");
  });
});

describe("login routing — one field, two credential paths", () => {
  test("a bare 10-digit mobile is a staff login", () => {
    assert.equal(looksLikeStaffLoginPhone("7447863402"), true);
    assert.equal(looksLikeStaffLoginPhone(" 7447863402 "), true);
  });

  test("an email is never mistaken for a phone number", () => {
    for (const identifier of [
      "owner@onedecore.in",
      "7447863402@onedecore.in",
      "+917447863402",
      "744786340",
    ]) {
      assert.equal(looksLikeStaffLoginPhone(identifier), false, identifier);
    }
  });

  test("the action normalizes before calling Supabase Auth", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /looksLikeStaffLoginPhone\(identifier\)/);
    assert.match(source, /signInWithPassword\(\{\s*phone: phone\.e164/);
    // The existing email path is preserved for the Super Admin.
    assert.match(source, /signInWithPassword\(\{\s*email: identifier\.toLowerCase\(\)/);
  });

  test("every authentication failure returns the same generic message", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /const GENERIC_ERROR = "Invalid staff credentials\.";/);
    // Wrong phone, wrong password and revoked all funnel into GENERIC_ERROR.
    const returns = source.match(/return \{ error: [^}]+\}/g) ?? [];
    const distinct = new Set(returns.map((line) => line.trim()));
    assert.ok(
      [...distinct].every(
        (line) =>
          line.includes("GENERIC_ERROR") ||
          line.includes("Enter your staff login and password.")
      ),
      `unexpected error text: ${[...distinct].join(" | ")}`
    );
  });

  test("a revoked account is signed out even with a correct password", () => {
    const source = read(LOGIN_ACTION);
    assert.match(source, /loginRecord\?\.accessState === "revoked"/);
    assert.match(source, /await supabase\.auth\.signOut\(\)/);
  });

  test("first successful login is what promotes the account", () => {
    assert.match(read(LOGIN_ACTION), /rpc\("record_staff_first_login"\)/);
  });

  test("the form offers ONE identifier field, not a second username", () => {
    const form = read(LOGIN_FORM);
    assert.match(form, /name="identifier"/);
    assert.match(form, /Mobile Number or Email/);
    assert.match(form, /10-digit mobile number/);
    // A dedicated email input would be the second username field the owner ruled out.
    assert.doesNotMatch(form, /type="email"/);
  });
});

describe("password rules", () => {
  test("the owner-locked minimum is 10 characters", () => {
    assert.equal(STAFF_PASSWORD_MIN_LENGTH, 10);
    assert.equal(validateStaffPassword("Short1234", "Short1234").ok, false);
    assert.equal(validateStaffPassword("LongEnough1", "LongEnough1").ok, true);
  });

  test("confirmation must match", () => {
    const result = validateStaffPassword("LongEnough1", "LongEnough2");
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /must match/i);
  });

  test("the value is returned for Auth only, and never echoed into form state", () => {
    const result = validateStaffPassword("LongEnough1", "LongEnough1");
    assert.equal(result.ok && result.password, "LongEnough1");
    assert.equal("password" in INITIAL_STAFF_CREDENTIAL_FORM_STATE, false);
    // The form-state contract has no field a password could travel back in.
    const contract = read(
      "src/features/staff-admin/contracts/staff-credential-form-state.ts"
    );
    assert.doesNotMatch(contract, /readonly password/);
  });

  test("a password can never be read back anywhere in the UI", () => {
    assert.doesNotMatch(read(PANEL), /view password/i);
    assert.doesNotMatch(read(PANEL), /defaultValue=\{[^}]*password/i);
  });
});

describe("Auth Admin transport — issuance", () => {
  test("creates the identity with the EXISTING staff UUID", async () => {
    const { deps: d, calls } = deps((call) =>
      call.method === "GET"
        ? { status: 404 }
        : { status: 200, body: { id: STAFF_ID, phone: "917447863402" } }
    );

    const result = await issueStaffPhoneCredentials(
      { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
      d
    );

    assert.equal(result.identityCreated, true);
    const create = calls.find((c) => c.method === "POST");
    assert.equal(create?.body?.id, STAFF_ID, "the employment UUID must be reused");
    assert.equal(create?.body?.phone, E164);
    assert.equal(create?.body?.phone_confirm, true, "admin-issued numbers are confirmed");
    assert.equal(create?.body?.password, "LongEnough1");
    // No email alias is ever fabricated for a phone login.
    assert.equal("email" in (create?.body ?? {}), false);
  });

  test("an existing matching identity is reused, never duplicated", async () => {
    // GoTrue stores the phone WITHOUT the "+", so the comparison must normalise.
    const { deps: d, calls } = deps((call) =>
      call.method === "GET"
        ? { status: 200, body: { id: STAFF_ID, phone: "917447863402" } }
        : { status: 200, body: { id: STAFF_ID } }
    );

    const result = await issueStaffPhoneCredentials(
      { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
      d
    );

    assert.equal(result.identityCreated, false, "retry must not create a second user");
    assert.equal(calls.some((c) => c.method === "POST"), false);
    const update = calls.find((c) => c.method === "PUT");
    assert.equal(update?.body?.password, "LongEnough1");
  });

  test("an identity on a different number is a hard conflict", async () => {
    const { deps: d } = deps(() => ({
      status: 200,
      body: { id: STAFF_ID, phone: "919812345678" },
    }));

    await assert.rejects(
      () =>
        issueStaffPhoneCredentials(
          { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
          d
        ),
      StaffIdentityConflictError
    );
  });

  test("a provider that ignores the requested id fails closed", async () => {
    const { deps: d } = deps((call) =>
      call.method === "GET"
        ? { status: 404 }
        : { status: 200, body: { id: "99999999-9999-4999-8999-999999999999" } }
    );

    await assert.rejects(
      () =>
        issueStaffPhoneCredentials(
          { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
          d
        ),
      StaffIdentityConflictError
    );
  });

  test("a lookup failure that is not 404 is surfaced, not swallowed", async () => {
    const { deps: d } = deps(() => ({ status: 500, body: { msg: "boom" } }));
    await assert.rejects(
      () =>
        issueStaffPhoneCredentials(
          { staffId: STAFF_ID, loginPhoneE164: E164, password: "LongEnough1", displayName: "A" },
          d
        ),
      /Auth identity lookup failed/
    );
  });
});

describe("Auth Admin transport — reset, revoke, phone change", () => {
  test("reset changes only the password", async () => {
    const { deps: d, calls } = deps(() => ({
      status: 200,
      body: { id: STAFF_ID, phone: "917447863402" },
    }));

    await resetStaffPhonePassword({ staffId: STAFF_ID, password: "LongEnough2" }, d);

    const update = calls.find((c) => c.method === "PUT");
    assert.deepEqual(Object.keys(update?.body ?? {}), ["password"]);
    assert.equal(update?.path.endsWith(STAFF_ID), true, "acts on the same UUID");
  });

  test("revocation bans the identity, since GoTrue exposes no session endpoint", async () => {
    const { deps: d, calls } = deps(() => ({ status: 200, body: { id: STAFF_ID } }));

    const result = await revokeStaffAuthAccess({ staffId: STAFF_ID }, d);

    assert.equal(result.banned, true);
    const ban = calls.find((c) => c.method === "PUT");
    assert.equal(typeof ban?.body?.ban_duration, "string");
    // Verified on a live stack: these endpoints answer 404 and must not be used.
    assert.equal(
      calls.some((c) => /\/sessions$|\/logout$/.test(c.path)),
      false
    );
  });

  test("revoking a staff member with no Auth identity is not an error", async () => {
    const { deps: d } = deps(() => ({ status: 404 }));
    const result = await revokeStaffAuthAccess({ staffId: STAFF_ID }, d);
    assert.equal(result.banned, false);
  });

  test("changing the login phone re-points the identity and drops sessions", async () => {
    const { deps: d, calls } = deps(() => ({
      status: 200,
      body: { id: STAFF_ID, phone: "919812345678" },
    }));

    await changeStaffAuthLoginPhone(
      { staffId: STAFF_ID, loginPhoneE164: "+919812345678" },
      d
    );

    const puts = calls.filter((c) => c.method === "PUT");
    assert.equal(puts[0]?.body?.phone, "+919812345678");
    assert.equal(puts[0]?.body?.phone_confirm, true);
    // Ban then unban: a session opened under the old number cannot be refreshed.
    assert.equal(typeof puts[1]?.body?.ban_duration, "string");
    assert.equal(puts[2]?.body?.ban_duration, "none");
    // The UUID never moves.
    assert.ok(calls.every((c) => c.path.includes(STAFF_ID)));
  });
});

describe("authorization — credential control is Super Admin only", () => {
  test("the permission exists and only super_admin holds it", () => {
    assert.ok(STAFF_PERMISSION_CODES.includes("staff.credentials.manage"));
    assert.ok(STAFF_ROLE_PERMISSIONS.super_admin.includes("staff.credentials.manage"));
    for (const role of ["sales_manager", "sales_executive", "project_manager", "designer"] as const) {
      assert.equal(
        STAFF_ROLE_PERMISSIONS[role].includes("staff.credentials.manage"),
        false,
        `${role} must not administer credentials`
      );
    }
  });

  test("the migration grants it to super_admin only", () => {
    const sql = executableSql(MIGRATION);
    assert.match(sql, /'staff\.credentials\.manage'/);
    assert.match(sql, /where r\.code = 'super_admin'/);
  });

  test("every credential operation routes through one authority gate", () => {
    const source = read(CREDENTIAL_ACTIONS);
    // All five operations funnel through runCredentialOperation, which calls the
    // gate before anything else, so none can be added later that skips it.
    for (const op of [
      "issueStaffCredentials",
      "resetStaffPassword",
      "revokeStaffAccess",
      "reactivateStaffAccess",
      "changeStaffLoginPhone",
    ]) {
      const block = source.slice(source.indexOf(`export async function ${op}`));
      assert.match(block.slice(0, 900), /runCredentialOperation\(\{/, op);
    }
    const runner = source.slice(source.indexOf("async function runCredentialOperation"));
    assert.match(runner.slice(0, 700), /await requireCredentialAdmin\(\)/);
  });

  test("the database is the real gate, not the server action", () => {
    const sql = executableSql(MIGRATION);
    for (const fn of [
      "begin_staff_credential_operation",
      "complete_staff_credential_operation",
      "fail_staff_credential_operation",
      "get_staff_credential_operation",
    ]) {
      const block = sql.slice(sql.indexOf(`function public.${fn}`));
      assert.match(
        block.slice(0, 900),
        /private\.staff_require_credential_admin\(\)/,
        `${fn} must gate on the credential admin`
      );
    }
  });
});

describe("state machine and revocation enforcement", () => {
  test("the four owner-locked states, and no legacy fifth", () => {
    assert.deepEqual(
      [...STAFF_ACCESS_STATE_CODES],
      ["not_activated", "credentials_ready", "active", "revoked"]
    );
  });

  test("an ineligible access state denies every permission at the chokepoint", () => {
    const sql = executableSql(MIGRATION);
    const block = sql.slice(sql.indexOf("function private.has_permission"));
    assert.match(block.slice(0, 1200), /private\.staff_access_denied\(v_user_id\)/);
    assert.match(block.slice(0, 1200), /return false;/);

    // The gate is "state is active", not "state is revoked": that is what closes
    // the window where an Auth identity exists but issuance never finished.
    const gate = sql.slice(sql.indexOf("function private.staff_access_denied"));
    assert.match(gate.slice(0, 700), /sep\.access_state <> 'active'/);
  });

  test("the profiles.status = 'active' hardening is preserved", () => {
    // Reproduced from 20260725020833; losing it would let a suspended profile
    // regain every permission.
    const sql = executableSql(MIGRATION);
    const block = sql.slice(sql.indexOf("function private.has_permission"));
    assert.match(block.slice(0, 1600), /join public\.profiles prof on prof\.id = ur\.user_id/);
    assert.match(block.slice(0, 1600), /prof\.status = 'active'/);
  });

  test("self-service staff RPCs also refuse a revoked actor", () => {
    const sql = executableSql(MIGRATION);
    const block = sql.slice(sql.indexOf("function private.staff_require_active_actor"));
    assert.match(block.slice(0, 1200), /STAFF_ACCESS_REVOKED/);
  });

  test("the reconciler can never resurrect a revoked account", () => {
    const sql = executableSql(MIGRATION);
    const block = sql.slice(sql.indexOf("function public.sync_staff_access_states"));
    assert.match(block.slice(0, 1200), /when sep\.access_state = 'revoked' then 'revoked'/);
  });

  test("issuing credentials never activates the account", () => {
    const sql = executableSql(MIGRATION);
    const complete = sql.slice(
      sql.indexOf("function public.complete_staff_credential_operation")
    );
    const issueBranch = complete.slice(
      complete.indexOf("if v_op.operation = 'issue' then"),
      complete.indexOf("elsif v_op.operation = 'password_reset'")
    );
    assert.match(issueBranch, /access_state = 'credentials_ready'/);
    assert.doesNotMatch(issueBranch, /access_state = 'active'/);
  });

  test("only a genuine sign-in promotes to active", () => {
    const sql = executableSql(MIGRATION);
    const block = sql.slice(sql.indexOf("function public.record_staff_first_login"));
    assert.match(block, /last_sign_in_at is not null/);
    // Signing in must never launder a revocation.
    assert.match(block, /if v_sep\.access_state = 'revoked' then/);
  });
});

describe("employment and login cannot drift", () => {
  test("an ordinary employment edit cannot move a credentialed phone", () => {
    const sql = executableSql(MIGRATION);
    assert.match(sql, /before update of phone_e164 on public\.profiles/);
    assert.match(sql, /STAFF_LOGIN_PHONE_LOCKED/);
  });

  test("only the sanctioned RPCs may set the drift flag", () => {
    const sql = executableSql(MIGRATION);
    const flagged = sql.match(/set_config\('onedecore\.login_phone_change', 'on', true\)/g) ?? [];
    // Only the finalize step of change_phone. Issuance no longer writes the
    // employment phone at all: it READS it as the authoritative username.
    assert.equal(flagged.length, 1, "change_phone finalize only");
  });

  test("the login phone is a separate column from contact data", () => {
    const sql = executableSql(MIGRATION);
    assert.match(sql, /add column if not exists login_phone_e164 text/);
    assert.match(sql, /uq_staff_employment_profiles_login_phone/);
  });
});

describe("no secret ever reaches storage, audit, or logs", () => {
  test("the migration stores timestamps only", () => {
    const sql = executableSql(MIGRATION);
    assert.doesNotMatch(sql, /password_hash|encrypted_password|p_password/);
  });

  test("credential RPCs take no password parameter", () => {
    const sql = executableSql(MIGRATION);
    for (const fn of [
      "issue_staff_credentials",
      "record_staff_password_reset",
      "change_staff_login_phone",
    ]) {
      // The PARAMETER LIST only — record_staff_password_reset legitimately has
      // the word in its own name.
      const start = sql.indexOf(`function public.${fn}(`);
      const open = sql.indexOf("(", start);
      const params = sql.slice(open + 1, sql.indexOf(")", open));
      assert.doesNotMatch(params, /password/i, `${fn} must not accept a password`);
    }
  });

  test("diagnostics are scrubbed before they can escape", () => {
    const source = read(CREDENTIAL_ACTIONS);
    assert.match(source, /function scrubSecret/);
    assert.match(source, /\[redacted\]/);
    // The single failure path scrubs before anything reaches the ledger.
    const runner = source.slice(source.indexOf("async function runCredentialOperation"));
    const failBranch = runner.slice(runner.indexOf("catch (authError)"));
    assert.match(failBranch, /scrubSecret\(/);
    assert.ok(
      failBranch.indexOf("scrubSecret(") <
        failBranch.indexOf("fail_staff_credential_operation"),
      "the diagnostic must be scrubbed BEFORE it is written to the ledger"
    );
  });

  test("the service-role key stays in the single audited adapter", () => {
    const provisioning = read(
      "src/features/staff-admin/server/staff-credential-provisioning.ts"
    );
    assert.doesNotMatch(provisioning, /serviceRoleKey/);
    assert.doesNotMatch(provisioning, /createAdminClient/);
    assert.match(read(CREDENTIAL_ACTIONS), /staff-invite-adapter/);
  });
});

describe("the future OTP reset needs no schema replacement", () => {
  test("the confirmed canonical phone is already the identity", () => {
    const provisioning = read(
      "src/features/staff-admin/server/staff-credential-provisioning.ts"
    );
    // phone_confirm is what a later signInWithOtp({ phone }) requires.
    assert.match(provisioning, /phone_confirm: true/);
  });

  test("there is no second username field to migrate away from", () => {
    const sql = executableSql(MIGRATION);
    assert.doesNotMatch(sql, /login_id|login_code|username text/);
    assert.doesNotMatch(read(LOGIN_FORM), /name="staffLoginId"/);
  });
});

describe("prepare / Auth / finalize — no split-brain", () => {
  test("nothing is published until the Auth step has succeeded", () => {
    const source = read(CREDENTIAL_ACTIONS);
    const runner = source.slice(source.indexOf("async function runCredentialOperation"));
    const beginAt = runner.indexOf("begin_staff_credential_operation");
    const authAt = runner.indexOf("await input.authStep(");
    const completeAt = runner.indexOf("complete_staff_credential_operation");
    assert.ok(beginAt < authAt, "begin runs before the Auth call");
    assert.ok(authAt < completeAt, "the Auth call runs before anything is published");
  });

  test("an Auth failure records a retryable operation and publishes nothing", () => {
    const source = read(CREDENTIAL_ACTIONS);
    const runner = source.slice(source.indexOf("async function runCredentialOperation"));
    const failBranch = runner.slice(
      runner.indexOf("catch (authError)"),
      runner.indexOf("complete_staff_credential_operation")
    );
    assert.match(failBranch, /fail_staff_credential_operation/);
    assert.doesNotMatch(failBranch, /complete_staff_credential_operation/);
  });

  test("issuance takes NO phone from the caller", () => {
    // The form action must not read one, and the action signature must not
    // accept one, so a tampered submission cannot choose the login number.
    const formActions = read(
      "src/features/staff-admin/server/staff-credential-form-actions.ts"
    );
    const issueBlock = formActions.slice(
      formActions.indexOf("export async function issueStaffCredentialsAction"),
      formActions.indexOf("export async function resetStaffPasswordAction")
    );
    assert.doesNotMatch(issueBlock, /loginPhone/);

    const source = read(CREDENTIAL_ACTIONS);
    const signature = source.slice(
      source.indexOf("export async function issueStaffCredentials("),
      source.indexOf("}): Promise<StaffCredentialResult> {", source.indexOf("export async function issueStaffCredentials("))
    );
    assert.doesNotMatch(signature, /phone/i);
  });

  test("the database derives the issuance phone from the staff record", () => {
    const sql = executableSql(MIGRATION);
    const begin = sql.slice(sql.indexOf("function public.begin_staff_credential_operation"));
    const issueBranch = begin.slice(
      begin.indexOf("if p_operation = 'issue' then"),
      begin.indexOf("elsif p_operation = 'change_phone'")
    );
    assert.match(issueBranch, /staff_normalize_login_phone\(v_profile\.phone_e164\)/);
    // p_phone is deliberately not consulted for issuance.
    assert.doesNotMatch(issueBranch, /p_phone/);
    assert.match(issueBranch, /STAFF_LOGIN_PHONE_MISSING/);
  });

  test("the issue form shows a read-only Staff Login ID", () => {
    const panel = read(PANEL);
    assert.match(panel, /Staff Login ID/);
    assert.match(panel, /employmentUsername/);
    // No editable login-number input on the issuance form.
    const issueForm = panel.slice(
      panel.indexOf("{!hasCredentials && employmentUsername !== null ?"),
      panel.indexOf("{pendingPhoneChange ? (")
    );
    assert.doesNotMatch(issueForm, /name="loginPhone"/);
    // And a missing number is an instruction, not a free-text field.
    assert.match(panel, /no valid 10-digit mobile number/);
  });

  test("an unfinished operation is surfaced for retry", () => {
    assert.match(read(PANEL), /pendingOperation/);
    assert.match(read(PANEL), /did not finish/);
  });

  test("the operation ledger is private and holds no secret", () => {
    const sql = executableSql(MIGRATION);
    // COLUMN DEFINITIONS only: `password_reset` is a legitimate operation NAME
    // in the check constraint below, not stored secret material. The column-level
    // proof is re-run against information_schema in the pgTAP suite.
    const tableStart = sql.indexOf(
      "create table if not exists private.staff_credential_operations"
    );
    const columns = sql.slice(tableStart, sql.indexOf("constraint chk_", tableStart));
    assert.doesNotMatch(columns, /password|hash|secret|token/i);
    assert.match(sql, /revoke all on table private\.staff_credential_operations/);
  });
});

describe("session invalidation is checked, not assumed", () => {
  test("a failed ban fails the phone change instead of reporting success", async () => {
    // phone update succeeds, ban fails.
    const { deps: d, calls } = deps((call) => {
      if (call.method === "GET") {
        return { status: 200, body: { id: STAFF_ID, phone: "917447863402" } };
      }
      if (call.body && "phone" in call.body) {
        return { status: 200, body: { id: STAFF_ID, phone: "919812345678" } };
      }
      if (call.body && call.body.ban_duration !== "none") {
        return { status: 500, body: { msg: "ban refused" } };
      }
      return { status: 200, body: { id: STAFF_ID } };
    });

    await assert.rejects(
      () =>
        changeStaffAuthLoginPhone(
          { staffId: STAFF_ID, loginPhoneE164: "+919812345678" },
          d
        ),
      /sessions could not be invalidated/
    );

    // It must NOT have carried on to re-enable the account as if all was well.
    assert.equal(
      calls.some((c) => c.body?.ban_duration === "none"),
      false,
      "a failed ban must stop the operation, not proceed to unban"
    );
  });
});

describe("serialization and unresolved-operation recovery", () => {
  test("one live operation per employee, whatever its kind", () => {
    const sql = executableSql(MIGRATION);
    assert.match(
      sql,
      /create unique index if not exists uq_staff_credential_operations_pending\s+on private\.staff_credential_operations \(staff_id\)\s+where status = 'pending'/
    );
  });

  test("a different unresolved operation is refused deterministically", () => {
    const sql = executableSql(MIGRATION);
    const begin = sql.slice(sql.indexOf("function public.begin_staff_credential_operation"));
    assert.match(begin, /if found and v_op\.operation <> p_operation then/);
    assert.match(begin, /STAFF_CREDENTIAL_OPERATION_BLOCKED/);

    // The refusal is evaluated BEFORE the per-operation preconditions, so a
    // blocked reactivate reports the block rather than a misleading state error.
    assert.ok(
      begin.indexOf("STAFF_CREDENTIAL_OPERATION_BLOCKED") <
        begin.indexOf("if p_operation = 'issue' then")
    );
  });

  test("change_phone closes access BEFORE Auth is touched", () => {
    const sql = executableSql(MIGRATION);
    const begin = sql.slice(sql.indexOf("function public.begin_staff_credential_operation"));
    assert.match(begin, /if p_operation in \('revoke', 'change_phone'\)/);
    // So safety does not depend on the fail RPC landing afterwards.
    const fail = sql.slice(sql.indexOf("function public.fail_staff_credential_operation"));
    assert.doesNotMatch(fail, /set access_state = 'revoked'/);
  });

  test("finalize restores the access the begin step closed", () => {
    const sql = executableSql(MIGRATION);
    const complete = sql.slice(
      sql.indexOf("function public.complete_staff_credential_operation")
    );
    const branch = complete.slice(complete.indexOf("elsif v_op.operation = 'change_phone'"));
    assert.match(branch, /access_state = coalesce\(v_op\.previous_access_state, access_state\)/);
  });

  test("the UI offers Retry pending phone change and hides Reactivate", () => {
    const panel = read(PANEL);
    assert.match(panel, /pendingPhoneChange/);
    assert.match(panel, /Retry pending phone change/);
    // Ordinary reactivation is gated on there being no unresolved phone change.
    assert.match(panel, /\{isRevoked && !pendingPhoneChange \? \(/);
    // And the server refuses it regardless of what is rendered.
    assert.match(read(PANEL), /Reactivation\s*\n?\s*is unavailable until this resolves/);
  });
});

describe("issuance stays fail-closed while unfinished", () => {
  test("record_staff_first_login promotes ONLY credentials_ready", () => {
    const sql = executableSql(MIGRATION);
    const fn = sql.slice(sql.indexOf("function public.record_staff_first_login"));
    assert.match(fn, /if v_sep\.access_state <> 'credentials_ready' then/);
    assert.match(fn, /if v_sep\.access_state = 'revoked' then/);
    assert.match(fn, /last_sign_in_at is not null/);
  });

  test("the RLS helpers gate on eligibility, not just revocation", () => {
    const sql = executableSql(MIGRATION);
    for (const helper of [
      "staff_can_view_employment",
      "staff_can_view_attendance",
      "salary_can_view",
    ]) {
      const block = sql.slice(sql.indexOf(`function private.${helper}`));
      assert.match(block.slice(0, 400), /not private\.staff_access_denied\(/, helper);
    }
    // And the two policies that carry the self branch inline.
    assert.match(sql, /create policy leave_requests_select[\s\S]*?staff_access_denied/);
    assert.match(sql, /create policy profiles_select_policy[\s\S]*?staff_access_denied/);
  });
});

describe("reactivation cannot succeed without an Auth identity", () => {
  test("a 404 on lookup is a hard conflict, not a silent success", async () => {
    const { deps: d, calls } = deps(() => ({ status: 404 }));

    await assert.rejects(
      () => reactivateStaffAuthAccess({ staffId: STAFF_ID }, d),
      StaffIdentityConflictError
    );

    // It must not have attempted to lift a ban on a user that does not exist,
    // which is what would have let the DB revocation be cleared.
    assert.equal(calls.some((c) => c.method === "PUT"), false);
  });

  test("an existing identity is re-enabled normally", async () => {
    const { deps: d, calls } = deps(() => ({ status: 200, body: { id: STAFF_ID } }));
    await reactivateStaffAuthAccess({ staffId: STAFF_ID }, d);
    assert.equal(calls.find((c) => c.method === "PUT")?.body?.ban_duration, "none");
  });
});

describe("the failure record is itself verified", () => {
  test("a failed fail-RPC is surfaced, not assumed to have worked", () => {
    const source = read(CREDENTIAL_ACTIONS);
    const runner = source.slice(source.indexOf("async function runCredentialOperation"));
    assert.match(runner, /const \{ error: failError \} = await rpc\.rpc\(\s*"fail_staff_credential_operation"/);
    assert.match(runner, /if \(failError\)/);
    assert.match(runner, /the failure could not be recorded/);
  });
});

describe("strict phone contract matches the database exactly", () => {
  test("punctuation and text are rejected in BOTH layers", () => {
    for (const raw of ["74478 63402", "+91-7447863402", "abc7447863402", "(744) 786-3402"]) {
      assert.equal(normalizeStaffLoginPhone(raw).ok, false, raw);
    }
    // The SQL contract is the same two patterns, with no punctuation stripping.
    const sql = executableSql(MIGRATION);
    const fn = sql.slice(sql.indexOf("function private.staff_normalize_login_phone"));
    assert.doesNotMatch(fn.slice(0, 900), /regexp_replace/);
    assert.match(fn, /\^\[6-9\]\[0-9\]\{9\}\$/);
  });
});
