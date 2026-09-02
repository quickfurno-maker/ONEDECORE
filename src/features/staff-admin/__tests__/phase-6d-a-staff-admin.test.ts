/**
 * Phase 6D-A — staff administration contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  mapCreateStaffMemberRpcResult,
  validateCreateStaffMemberInput,
} from "../contracts/dto.ts";
import { STAFF_ERROR_CODES, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import {
  STAFF_ASSIGNABLE_ROLE_CODES,
  STAFF_PERMISSION_CODES,
  STAFF_ROLE_PERMISSIONS,
} from "../contracts/permissions.ts";
import {
  runStaffInvite,
  setStaffInviteAdapterForTests,
} from "../contracts/staff-invite.ts";

const root = process.cwd();
const M23_MIGRATION = join(
  root,
  "supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql"
);

const CLIENT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const MANAGER_ID = "22222222-2222-4222-8222-222222222222";
const POLICY_ID = "33333333-3333-4333-8333-333333333333";

function validCreateInput() {
  return {
    clientRequestId: CLIENT_REQUEST_ID,
    employeeCode: "OD-001",
    displayName: "Test Staff",
    email: "staff@example.com",
    phoneE164: "+919876543210",
    designation: "Sales Executive",
    joiningDate: "2026-08-01",
    roleCode: "sales_executive" as const,
    reportingManagerId: MANAGER_ID,
    attendanceEligible: true,
    attendancePolicyId: POLICY_ID,
  };
}

describe("Phase 6D-A migration contract", () => {
  test("migration defines staff permissions and durable invite saga RPCs", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");

    for (const code of STAFF_PERMISSION_CODES) {
      assert.match(sql, new RegExp(code.replaceAll(".", "\\.")));
    }

    assert.match(sql, /create_staff_member/);
    assert.match(sql, /prepare_staff_invite_saga/);
    assert.match(sql, /record_staff_invite_auth_success/);
    assert.match(sql, /reconcile_staff_invite/);
    assert.match(sql, /resend_staff_invite/);
    assert.match(sql, /private\.staff_invite_saga_requests/);
    assert.doesNotMatch(sql, /public\.staff_admin_idempotency/);
    assert.match(sql, /set_staff_profile_status/);
    assert.match(sql, /set_staff_reporting_manager/);
    assert.match(sql, /update_staff_employment/);
    assert.match(sql, /staff_employment_profiles/);
    assert.match(sql, /staff_admin_events/);
  });

  test("assignable roles match create_staff_member allowlist", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    for (const role of STAFF_ASSIGNABLE_ROLE_CODES) {
      assert.match(sql, new RegExp(`'${role}'`));
    }
  });

  test("private saga ledger is not granted to authenticated", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    assert.match(
      sql,
      /revoke all on table private\.staff_invite_saga_requests from public, anon, authenticated/
    );
  });
});

describe("Phase 6D-A permission constants", () => {
  test("role matrix matches contract freeze intent", () => {
    assert.equal(STAFF_ROLE_PERMISSIONS.super_admin.includes("staff.manage"), true);
    assert.equal(STAFF_ROLE_PERMISSIONS.sales_manager.includes("staff.read"), true);
    assert.equal(STAFF_ROLE_PERMISSIONS.sales_manager.includes("staff.manage"), false);
    assert.equal(STAFF_ROLE_PERMISSIONS.sales_executive.includes("attendance.self"), true);
    assert.equal(STAFF_ROLE_PERMISSIONS.project_manager.length, 0);
  });
});

describe("Phase 6D-A create staff validation", () => {
  test("accepts valid sales executive input", () => {
    const errors = validateCreateStaffMemberInput(validCreateInput());
    assert.equal(errors.length, 0);
  });

  test("requires reporting manager for sales executive", () => {
    const errors = validateCreateStaffMemberInput({
      ...validCreateInput(),
      reportingManagerId: null,
    });
    assert.ok(errors.some((entry) => entry.field === "reportingManagerId"));
  });

  test("requires attendance policy when attendance eligible", () => {
    const errors = validateCreateStaffMemberInput({
      ...validCreateInput(),
      attendancePolicyId: null,
    });
    assert.ok(errors.some((entry) => entry.field === "attendancePolicyId"));
  });

  test("rejects invalid employee code", () => {
    const errors = validateCreateStaffMemberInput({
      ...validCreateInput(),
      employeeCode: "bad code",
    });
    assert.ok(errors.some((entry) => entry.field === "employeeCode"));
  });

  test("rejects invalid email", () => {
    const errors = validateCreateStaffMemberInput({
      ...validCreateInput(),
      email: "not-an-email",
    });
    assert.ok(errors.some((entry) => entry.field === "email"));
  });
});

describe("Phase 6D-A invite adapter", () => {
  test("supports test override without service role", async () => {
    setStaffInviteAdapterForTests(async (input) => ({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: input.email,
    }));

    const result = await runStaffInvite(
      {
        email: "invite@example.com",
        displayName: "Invite Test",
      },
      async () => ({
        userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        email: "should-not-run@example.com",
      })
    );

    assert.equal(result.userId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(result.email, "invite@example.com");

    setStaffInviteAdapterForTests(null);
  });
});

describe("Phase 6D-A RPC result mapping", () => {
  test("maps create_staff_member payload to CreateStaffMemberResult", () => {
    const mapped = mapCreateStaffMemberRpcResult({
      staffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      employeeCode: "OD-001",
      profileStatus: "pending",
      invitationState: "completed",
      reconciliationState: "none",
      idempotentReplay: false,
    });

    assert.equal(mapped.staffId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(mapped.invitationState, "completed");
    assert.equal(mapped.reconciliationState, "none");
    assert.equal(mapped.idempotentReplay, false);
  });

  test("maps idempotent replay flag", () => {
    const mapped = mapCreateStaffMemberRpcResult({
      staffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      employeeCode: "OD-001",
      profileStatus: "pending",
      invitationState: "completed",
      reconciliationState: "none",
      idempotentReplay: true,
    });

    assert.equal(mapped.idempotentReplay, true);
  });
});

describe("Phase 6D-A staff error vocabulary", () => {
  test("error codes are normalized", () => {
    assert.equal(STAFF_ERROR_CODES.includes("STAFF_UNAUTHORIZED"), true);
    assert.equal(STAFF_ERROR_CODES.includes("STAFF_INVITE_FAILED"), true);
    assert.equal(STAFF_ERROR_CODES.includes("STAFF_RECONCILIATION_REQUIRED"), true);
    assert.equal(STAFF_ERROR_CODES.includes("STAFF_IDEMPOTENCY_CONFLICT"), true);
  });

  test("maps migration employee code conflict", () => {
    const error = staffErrorFromPostgresMessage("employee_code already exists");
    assert.equal(error.code, "STAFF_EMPLOYEE_CODE_CONFLICT");
    assert.equal(error.httpStatus, 409);
  });

  test("maps idempotency conflict", () => {
    const error = staffErrorFromPostgresMessage("STAFF_IDEMPOTENCY_CONFLICT");
    assert.equal(error.code, "STAFF_IDEMPOTENCY_CONFLICT");
    assert.equal(error.httpStatus, 409);
  });

  test("maps reconciliation not found", () => {
    const error = staffErrorFromPostgresMessage("reconciliation request not found");
    assert.equal(error.code, "STAFF_RECONCILIATION_NOT_FOUND");
    assert.equal(error.httpStatus, 404);
  });

  test("maps disabled to active denial", () => {
    const error = staffErrorFromPostgresMessage(
      "disabled to active denied in V1; use rehire path"
    );
    assert.equal(error.code, "STAFF_STATUS_TRANSITION_DENIED");
  });
});

describe("Phase 6D-A server module boundaries", () => {
  test("staff actions use durable saga order before Auth invite", () => {
    const src = readFileSync(
      join(root, "src/features/staff-admin/server/staff-actions.ts"),
      "utf8"
    );
    const createBlock = src.slice(
      src.indexOf("export async function createStaffMember"),
      src.indexOf("export async function reconcileStaffInvite")
    );
    assert.match(createBlock, /prepare_staff_invite_saga/);
    assert.match(createBlock, /record_staff_invite_auth_success/);
    assert.match(createBlock, /create_staff_member/);
    assert.ok(
      createBlock.indexOf("prepare_staff_invite_saga") <
        createBlock.indexOf("inviteStaffMemberByEmail")
    );
    // Match the exact RPC invocation: "create_staff_member" is also a prefix of
    // "create_staff_member_without_invite", which the blank-email path calls
    // earlier in the same function.
    assert.ok(
      createBlock.indexOf("record_staff_invite_auth_success") <
        createBlock.indexOf('rpc("create_staff_member"')
    );
    assert.doesNotMatch(src, /serviceRoleKey/);
    assert.doesNotMatch(src, /createAdminClient/);
  });

  test("invite adapter is server-only and mockable", () => {
    const adapterSrc = readFileSync(
      join(root, "src/features/staff-admin/server/staff-invite-adapter.ts"),
      "utf8"
    );
    const contractSrc = readFileSync(
      join(root, "src/features/staff-admin/contracts/staff-invite.ts"),
      "utf8"
    );
    assert.match(adapterSrc, /server-only/);
    assert.match(adapterSrc, /inviteUserByEmail/);
    assert.match(contractSrc, /setStaffInviteAdapterForTests/);
    assert.match(contractSrc, /runStaffInvite/);
  });
});

describe("Phase 6D-A invite saga orchestration contract", () => {
  test("createStaffMember source never calls Auth before prepare", () => {
    const src = readFileSync(
      join(root, "src/features/staff-admin/server/staff-actions.ts"),
      "utf8"
    );
    const createBlock = src.slice(
      src.indexOf("export async function createStaffMember"),
      src.indexOf("export async function reconcileStaffInvite")
    );
    const prepareIndex = createBlock.indexOf("prepare_staff_invite_saga");
    const inviteIndex = createBlock.indexOf("inviteStaffMemberByEmail");
    assert.ok(prepareIndex >= 0);
    assert.ok(inviteIndex >= 0);
    assert.ok(prepareIndex < inviteIndex);
  });

  test("failed finalize returns reconciliation_required without deleting auth marker", () => {
    const src = readFileSync(
      join(root, "src/features/staff-admin/server/staff-actions.ts"),
      "utf8"
    );
    assert.match(src, /reconciliationState: "auth_created_db_pending"/);
    assert.match(src, /invitationState: "reconciliation_required"/);
  });
});
