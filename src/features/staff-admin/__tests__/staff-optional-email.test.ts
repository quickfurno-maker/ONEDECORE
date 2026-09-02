/**
 * Staff creation without an email — employment identity vs login identity.
 *
 * Database enforcement is proven in
 * supabase/tests/database/42_staff_optional_email_employment_identity_test.sql.
 * These pin the application contract: blank email validates, never invites,
 * never fabricates an address, and the PR #123 form-preservation behaviour is
 * untouched.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  normalizeStaffEmail,
  validateCreateStaffMemberInput,
  type CreateStaffMemberInput,
} from "../contracts/dto.ts";
import {
  STAFF_ACCESS_STATE_CODES,
  STAFF_ACCESS_STATE_LABELS,
  isStaffAccessStateCode,
} from "../contracts/permissions.ts";
import {
  readStaffCreateFormValues,
  toStaffCreateFieldErrors,
} from "../contracts/staff-form-state.ts";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const MIGRATION =
  "supabase/migrations/20260903120000_staff_optional_email_employment_identity.sql";
const STAFF_ACTIONS = "src/features/staff-admin/server/staff-actions.ts";
const FORM = "src/features/staff-admin/components/StaffCreateForm.tsx";

const MANAGER_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Partial<CreateStaffMemberInput> = {}): CreateStaffMemberInput {
  return {
    clientRequestId: CLIENT_REQUEST_ID,
    employeeCode: "OD-050",
    displayName: "No Email Staff",
    email: "",
    phoneE164: null,
    designation: "Executive",
    joiningDate: "2026-09-01",
    roleCode: "sales_executive",
    reportingManagerId: MANAGER_ID,
    attendanceEligible: false,
    attendancePolicyId: null,
    ...overrides,
  };
}

/** Mirrors the field-error pass the server action runs. */
function fieldErrorsFor(input: CreateStaffMemberInput) {
  return toStaffCreateFieldErrors(validateCreateStaffMemberInput(input));
}

describe("staff optional email — validation", () => {
  test("a blank email produces no error at all", () => {
    assert.deepEqual(fieldErrorsFor(baseInput({ email: "" })), {});
    assert.deepEqual(fieldErrorsFor(baseInput({ email: "   " })), {});
    assert.deepEqual(fieldErrorsFor(baseInput({ email: null })), {});
    assert.deepEqual(fieldErrorsFor(baseInput({ email: undefined })), {});
  });

  test("a valid email still validates", () => {
    assert.deepEqual(fieldErrorsFor(baseInput({ email: "person@onedecore.in" })), {});
  });

  test("an invalid NON-BLANK email flags only the email field", () => {
    const errors = fieldErrorsFor(baseInput({ email: "not-an-email" }));
    assert.deepEqual(Object.keys(errors), ["email"]);
    assert.match(errors.email ?? "", /valid address/i);
  });

  test("phone is NOT made mandatory as a substitute for email", () => {
    // Blank email and blank phone together must still be valid.
    assert.deepEqual(fieldErrorsFor(baseInput({ email: "", phoneE164: null })), {});
    assert.deepEqual(fieldErrorsFor(baseInput({ email: "", phoneE164: "" })), {});
  });

  test("normalizeStaffEmail returns null for blank and never invents a value", () => {
    assert.equal(normalizeStaffEmail(""), null);
    assert.equal(normalizeStaffEmail("   "), null);
    assert.equal(normalizeStaffEmail(null), null);
    assert.equal(normalizeStaffEmail(undefined), null);
    assert.equal(normalizeStaffEmail("  Person@OneDecore.IN "), "person@onedecore.in");
  });

  test("other field rules are unchanged by making email optional", () => {
    assert.deepEqual(
      Object.keys(fieldErrorsFor(baseInput({ email: "", employeeCode: "@@" }))),
      ["employeeCode"]
    );
    assert.deepEqual(
      Object.keys(fieldErrorsFor(baseInput({ email: "", reportingManagerId: null }))),
      ["reportingManagerId"]
    );
    assert.deepEqual(
      Object.keys(
        fieldErrorsFor(baseInput({ email: "", attendanceEligible: true, attendancePolicyId: null }))
      ),
      ["attendancePolicyId"]
    );
  });
});

describe("staff optional email — PR #123 form preservation still holds", () => {
  test("an invalid email preserves every other entered value", () => {
    const formData = new FormData();
    for (const [key, value] of Object.entries({
      clientRequestId: CLIENT_REQUEST_ID,
      employeeCode: "OD-051",
      displayName: "Priya Nair",
      email: "broken-email",
      phoneE164: "+919876543210",
      designation: "Sales Executive",
      joiningDate: "2026-09-01",
      roleCode: "sales_executive",
      reportingManagerId: MANAGER_ID,
    })) {
      formData.set(key, value);
    }

    const values = readStaffCreateFormValues(formData);
    const errors = fieldErrorsFor({
      clientRequestId: CLIENT_REQUEST_ID,
      employeeCode: values.employeeCode,
      displayName: values.displayName,
      email: values.email,
      phoneE164: values.phoneE164 || null,
      designation: values.designation,
      joiningDate: values.joiningDate,
      roleCode: values.roleCode as CreateStaffMemberInput["roleCode"],
      reportingManagerId: values.reportingManagerId || null,
      attendanceEligible: values.attendanceEligible,
      attendancePolicyId: values.attendancePolicyId || null,
    });

    assert.deepEqual(Object.keys(errors), ["email"]);
    assert.equal(values.employeeCode, "OD-051");
    assert.equal(values.displayName, "Priya Nair");
    assert.equal(values.phoneE164, "+919876543210");
    assert.equal(values.designation, "Sales Executive");
    assert.equal(values.reportingManagerId, MANAGER_ID);
    // The rejected value is echoed so it can be corrected in place.
    assert.equal(values.email, "broken-email");
  });

  test("a blank email round-trips as blank, never as a placeholder", () => {
    const formData = new FormData();
    formData.set("employeeCode", "OD-052");
    formData.set("email", "");
    const values = readStaffCreateFormValues(formData);
    assert.equal(values.email, "");
  });
});

describe("staff optional email — access state vocabulary", () => {
  test("the three login states exist and are labelled", () => {
    assert.deepEqual(
      [...STAFF_ACCESS_STATE_CODES],
      ["not_activated", "invited", "active"]
    );
    assert.equal(STAFF_ACCESS_STATE_LABELS.not_activated, "Not activated");
    assert.equal(isStaffAccessStateCode("not_activated"), true);
    assert.equal(isStaffAccessStateCode("nonsense"), false);
  });
});

describe("staff optional email — server behaviour", () => {
  const source = read(STAFF_ACTIONS);

  test("a blank email takes the no-invite path and never calls the invite adapter", () => {
    const branchStart = source.indexOf("if (email === null)");
    assert.ok(branchStart > 0, "blank-email branch must exist");

    // Slice to the NEXT saga reference after the branch: the RPC name also
    // appears earlier in the client type declaration.
    const branchEnd = source.indexOf("prepare_staff_invite_saga", branchStart);
    assert.ok(branchEnd > branchStart, "invite path must follow the branch");

    const noEmailBranch = source.slice(branchStart, branchEnd);
    assert.match(noEmailBranch, /create_staff_member_without_invite/);
    // The invite adapter must not be reachable from the blank-email branch.
    assert.doesNotMatch(noEmailBranch, /inviteStaffMemberByEmail/);
    // And the branch returns, so control never falls through to the saga.
    assert.match(noEmailBranch, /return mapCreateStaffMemberRpcResult\(/);
  });

  test("the existing invite path is unchanged for a supplied email", () => {
    assert.match(source, /prepare_staff_invite_saga/);
    assert.match(source, /inviteStaffMemberByEmail\(\{ email, displayName \}\)/);
    assert.match(source, /record_staff_invite_auth_success/);
    assert.match(source, /reconcile_staff_invite|reconcileStaffInvite/);
  });

  test("no placeholder address is ever synthesised", () => {
    // Strip comments: the code legitimately DESCRIBES the rule in prose.
    const executable = source
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(" ");

    for (const forbidden of [
      /@example\.(invalid|com|test)/,
      /noreply@/i,
      /no-?email@/i,
      /placeholder/i,
      /\$\{[^}]*\}@/,
    ]) {
      assert.doesNotMatch(executable, forbidden);
    }
  });
});

describe("staff optional email — UI", () => {
  const form = read(FORM);

  test("the label says optional and the field is not required", () => {
    assert.match(form, /Work email \(optional\)/);
    const emailBlock = form.slice(
      form.indexOf('name="email"'),
      form.indexOf("FieldError id={emailErrorId}")
    );
    assert.doesNotMatch(emailBlock, /\brequired\b/);
  });

  test("blank email explains that access can be added later", () => {
    assert.match(form, /You can add app\/login access later\./);
  });

  test("employment status and app access are shown as separate facts", () => {
    const detail = read("src/features/staff-admin/components/StaffDetailPanel.tsx");
    const table = read("src/features/staff-admin/components/StaffDirectoryTable.tsx");
    assert.match(detail, /StaffAccessStateBadge/);
    assert.match(detail, /Employment/);
    assert.match(table, /App access/);
    assert.match(table, /Employment/);
    const badge = read("src/features/staff-admin/components/StaffStatusBadge.tsx");
    assert.match(badge, /App access: \{STAFF_ACCESS_STATE_LABELS\[accessState\]\}/);
  });
});

describe("staff optional email — migration contract", () => {
  const sql = read(MIGRATION);

  test("employment identity is decoupled from the login identity", () => {
    assert.match(sql, /drop constraint if exists profiles_id_fkey/);
    // Roles follow the employment identity.
    assert.match(sql, /foreign key \(user_id\) references public\.profiles \(id\)/);
  });

  test("profiles.id is never reassigned", () => {
    // The whole design depends on profiles.id staying stable: 130 FKs point at it.
    assert.doesNotMatch(sql, /update public\.profiles[\s\S]{0,120}set id/);
    assert.doesNotMatch(sql, /alter table public\.profiles[\s\S]{0,80}rename column id/);
  });

  test("app access state is explicit and constrained", () => {
    assert.match(sql, /access_state text not null default 'not_activated'/);
    assert.match(sql, /'not_activated', 'invited', 'active'/);
  });

  test("existing staff are backfilled rather than reset", () => {
    assert.match(sql, /update public\.staff_employment_profiles sep/);
    assert.match(sql, /exists \(select 1 from auth\.users u where u\.id = sep\.staff_id\)/);
  });

  test("the no-invite path validates exactly like the invite path", () => {
    assert.match(sql, /ATTENDANCE_POLICY_MISSING/);
    assert.match(sql, /sales_executive requires reporting manager/);
    assert.match(sql, /employee_code already exists/);
    assert.match(sql, /invalid role for staff assignment/);
    assert.match(sql, /reporting manager must be active/);
    assert.match(sql, /assert_no_reporting_cycle/);
  });

  test("authority is unchanged and fail-closed", () => {
    assert.match(sql, /public\.authorize\('staff\.manage'\)/);
    assert.match(sql, /ATTENDANCE_UNAUTHORIZED/);
    // No policy or authorize() rewrite is attempted.
    assert.doesNotMatch(sql, /create policy/);
    assert.doesNotMatch(sql, /create or replace function public\.authorize/);
  });

  test("no placeholder email is generated in SQL either", () => {
    const executable = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join(" ");
    assert.doesNotMatch(executable, /@example\./);
    assert.doesNotMatch(executable, /noreply/i);
    assert.doesNotMatch(executable, /placeholder/i);
  });

  test("activation converges the two identities without changing the employment id", () => {
    assert.match(sql, /attach_staff_app_access/);
    assert.match(sql, /confirm_staff_app_access/);
    assert.match(sql, /STAFF_ACCESS_NOT_PROVISIONED/);
    assert.match(sql, /STAFF_ACCESS_ALREADY_ACTIVE/);
  });
});

describe("PR127 corrections", () => {
  const sql = read(MIGRATION);
  const actions = read(STAFF_ACTIONS);

  test("CORRECTION 1: access_state is derived on insert, so the invite path cannot regress", () => {
    // M23's finalize function inserts staff_employment_profiles WITHOUT
    // access_state. Relying on the column default alone would mark every newly
    // invited staff member "not_activated".
    assert.match(sql, /create trigger trg_staff_employment_profiles_derive_access_state/);
    assert.match(sql, /before insert on public\.staff_employment_profiles/);
    assert.match(sql, /private\.staff_derive_access_state/);

    // The rule is identical in the trigger and in the backfill.
    const rule = /last_sign_in_at is not null[\s\S]{0,120}'active'[\s\S]{0,160}'invited'[\s\S]{0,80}'not_activated'/;
    const occurrences = sql.split("last_sign_in_at is not null").length - 1;
    assert.ok(occurrences >= 2, "backfill and trigger must share the rule");
    assert.match(sql, rule);
  });

  test("CORRECTION 2: idempotency is a keyed ledger, not an audit-log scan", () => {
    assert.match(sql, /create table private\.staff_direct_create_requests/);
    assert.match(sql, /client_request_id uuid primary key/);
    assert.match(sql, /request_digest text not null/);
    assert.match(sql, /STAFF_IDEMPOTENCY_CONFLICT/);
    assert.match(sql, /when unique_violation then/);

    // The weak guard is gone: idempotency must not be inferred from events.
    assert.doesNotMatch(
      sql,
      /from public\.staff_admin_events[\s\S]{0,200}details ->> 'clientRequestId'/
    );
  });

  test("CORRECTION 2: replay returns the persisted result, not a hardcoded state", () => {
    assert.match(sql, /update private\.staff_direct_create_requests[\s\S]{0,120}set staff_id = v_staff_id, result = v_result/);
    assert.match(sql, /coalesce\(v_request\.result, '\{\}'::jsonb\)/);
    // accessState on the happy path is read back from the row, not literal.
    assert.match(
      sql,
      /'accessState', \(\s*select sep\.access_state from public\.staff_employment_profiles sep/
    );
  });

  test("CORRECTION 3: app-access attachment is implemented end to end", () => {
    // Server action exists and provisions the login identity.
    assert.match(actions, /export async function attachStaffAppAccess/);
    assert.match(actions, /attach_staff_app_access/);
    assert.match(actions, /provisionStaffLoginIdentity/);

    // Form action + UI surface.
    const formActions = read("src/features/staff-admin/server/staff-form-actions.ts");
    assert.match(formActions, /attachStaffAppAccessAction/);
    const panel = read("src/features/staff-admin/components/StaffDetailPanel.tsx");
    assert.match(panel, /attachStaffAppAccessAction/);
    assert.match(panel, /Activate app access/);
    assert.match(panel, /staff\.accessState === "not_activated"/);
  });

  test("CORRECTION 3: the login identity must reuse the employment id", () => {
    const contract = read("src/features/staff-admin/contracts/staff-invite.ts");
    // A mismatch is a hard failure, never a silently-created second identity.
    assert.match(contract, /result\.userId !== input\.staffId/);
    assert.match(contract, /did not honour the requested user id/);

    // The REST call moved into staff-login-provisioning.ts so the delivery step
    // could be unit tested with an injected fetch.
    const rest = read("src/features/staff-admin/server/staff-login-provisioning.ts");
    assert.match(rest, /id: input\.staffId/);
    assert.match(rest, /AUTH_ADMIN_USERS_PATH/);
  });

  test("CORRECTION 3: attachment still generates no placeholder address", () => {
    const adapter = read("src/features/staff-admin/server/staff-invite-adapter.ts");
    const executable = adapter
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(" ");
    assert.doesNotMatch(executable, /@example\./);
    assert.doesNotMatch(executable, /noreply/i);
    assert.doesNotMatch(executable, /placeholder/i);
  });
});

describe("PR127 final corrections", () => {
  const sql = read(MIGRATION);
  const actions = read(STAFF_ACTIONS);

  test("FINAL 1: delivery is a real send, not link generation", () => {
    const adapter = read("src/features/staff-admin/server/staff-invite-adapter.ts");
    const executable = adapter
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(" ");
    assert.doesNotMatch(executable, /generateLink/);

    const rest = read("src/features/staff-admin/server/staff-login-provisioning.ts");
    assert.match(rest, /AUTH_RECOVER_PATH = "\/auth\/v1\/recover"/);
    assert.match(rest, /deliveryInvoked/);
  });

  test("FINAL 2: active requires genuine sign-in evidence", () => {
    // confirm refuses without last_sign_in_at.
    assert.match(sql, /STAFF_ACCESS_NOT_ACTIVATED/);
    const confirmFn = sql.slice(
      sql.indexOf("function public.confirm_staff_app_access"),
      sql.indexOf("function public.sync_staff_access_states")
    );
    assert.match(confirmFn, /last_sign_in_at is not null/);

    // And a synchroniser exists so a later sign-in is reflected.
    assert.match(sql, /create or replace function public\.sync_staff_access_states/);
  });

  test("FINAL 2: the synchroniser mirrors Auth and never invents activation", () => {
    const syncFn = sql.slice(sql.indexOf("function public.sync_staff_access_states"));
    assert.match(syncFn, /last_sign_in_at is not null[\s\S]{0,80}'active'/);
    assert.match(syncFn, /'not_activated'/);
    // It is read-gated, not open.
    assert.match(syncFn, /public\.authorize\('staff\.read'\)/);
  });

  test("FINAL 2: staff read paths reconcile before returning rows", () => {
    const queries = read("src/features/staff-admin/server/staff-queries.ts");
    assert.match(queries, /syncStaffAccessStates\(supabase, null\)/);
    assert.match(queries, /syncStaffAccessStates\(supabase, staffId\)/);
    // The list select must actually carry access_state, or it silently falls back.
    const listSelect = queries.slice(
      queries.indexOf("export async function loadStaffList"),
      queries.indexOf("export async function loadStaffDetail")
    );
    assert.match(listSelect, /access_state/);
  });

  test("FINAL 3: failure wording does not claim the record is unchanged", () => {
    assert.doesNotMatch(actions, /The record is unchanged/);
    assert.match(actions, /marked invited but activation did not finish/);
    assert.match(actions, /retry/i);
  });
});
