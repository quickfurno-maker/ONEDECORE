/**
 * Phase 6D — security mutant tests for staff administration and attendance.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  attendanceErrorFromPostgresMessage,
  isAttendanceErrorCode,
} from "../../staff-attendance/contracts/errors.ts";
import { staffErrorFromPostgresMessage } from "../contracts/errors.ts";

const root = process.cwd();
const M23_MIGRATION = join(
  root,
  "supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql"
);

const CLIENT_BUNDLE_PATTERNS = [
  /serviceRoleKey/i,
  /createAdminClient/,
  /SUPABASE_SERVICE_ROLE/i,
  /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/i,
  /service_role/i,
];

function readClientBundleSources(): readonly string[] {
  const relativePaths = [
    "src/features/staff-admin/components/StaffCreateForm.tsx",
    "src/features/staff-admin/components/StaffDetailPanel.tsx",
    "src/features/staff-attendance/components/AttendanceTodayPanel.tsx",
    "src/features/staff-attendance/components/AttendanceCorrectionForm.tsx",
    "src/features/staff-attendance/components/AttendancePolicyForm.tsx",
    "src/app/admin/staff/page.tsx",
    "src/app/admin/staff/[id]/page.tsx",
    "src/app/admin/staff/new/page.tsx",
    "src/app/admin/attendance/page.tsx",
    "src/app/admin/attendance/team/page.tsx",
    "src/app/admin/attendance/calendar/page.tsx",
    "src/app/admin/attendance/corrections/page.tsx",
  ];

  return relativePaths.map((relativePath) =>
    readFileSync(join(root, relativePath), "utf8")
  );
}

describe("Phase 6D security — actor spoof resistance", () => {
  test("migration RPCs derive actor from staff_require_active_actor not client input", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    assert.match(sql, /private\.staff_require_active_actor\(\)/);
    assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
    for (const rpc of [
      "finalize_staff_member",
      "check_in_attendance",
      "check_out_attendance",
      "correct_attendance_day",
    ]) {
      const block = sql.slice(sql.indexOf(`function public.${rpc}`));
      assert.match(block, /v_actor := private\.staff_require_active_actor\(\)/);
    }
  });

  test("check-in RPC binds staff_id to actor not client input", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    const checkInBlock = sql.slice(
      sql.indexOf("function public.check_in_attendance"),
      sql.indexOf("function public.check_out_attendance")
    );
    assert.match(checkInBlock, /v_actor := private\.staff_require_active_actor\(\)/);
    assert.match(checkInBlock, /staff_id = v_actor/);
    assert.doesNotMatch(checkInBlock, /p_staff_id/);
  });

  test("staff server actions never accept spoofed actor identifiers", () => {
    const staffActionsSrc = readFileSync(
      join(root, "src/features/staff-admin/server/staff-actions.ts"),
      "utf8"
    );
    const attendanceActionsSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-actions.ts"),
      "utf8"
    );
    assert.doesNotMatch(staffActionsSrc, /actorId/i);
    assert.doesNotMatch(attendanceActionsSrc, /p_actor/i);
    assert.match(attendanceActionsSrc, /requireAttendanceSelfAccess/);
  });

  test("self check-in and check-out form actions do not accept staffId spoof fields", () => {
    const formSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-form-actions.ts"),
      "utf8"
    );
    const checkInBlock = formSrc.slice(
      formSrc.indexOf("export async function checkInAction"),
      formSrc.indexOf("export async function checkOutAction")
    );
    const checkOutBlock = formSrc.slice(
      formSrc.indexOf("export async function checkOutAction"),
      formSrc.indexOf("export async function correctAttendanceDayAction")
    );
    assert.doesNotMatch(checkInBlock, /staffId/);
    assert.doesNotMatch(checkOutBlock, /staffId/);
    assert.match(checkInBlock, /idempotencyKey/);
    assert.match(checkOutBlock, /idempotencyKey/);
  });
});

describe("Phase 6D security — IDOR boundaries", () => {
  test("loadMonth rejects cross-staff reads without team or all scope", () => {
    const actionsSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-actions.ts"),
      "utf8"
    );
    assert.match(actionsSrc, /staffId !== context\.userId/);
    assert.match(actionsSrc, /canReadAllAttendance/);
    assert.match(actionsSrc, /canReadTeamAttendance/);
    assert.match(actionsSrc, /ATTENDANCE_UNAUTHORIZED/);
  });

  test("staff detail route uses notFound for inaccessible profiles", () => {
    const pageSrc = readFileSync(join(root, "src/app/admin/staff/[id]/page.tsx"), "utf8");
    assert.match(pageSrc, /loadStaffDetail/);
    assert.match(pageSrc, /notFound\(/);
    assert.match(pageSrc, /requireStaffReadAccess/);
  });

  test("staff queries rely on authenticated client reads not elevated bypass", () => {
    const queriesSrc = readFileSync(
      join(root, "src/features/staff-admin/server/staff-queries.ts"),
      "utf8"
    );
    assert.match(queriesSrc, /createClient/);
    assert.match(queriesSrc, /requireStaffReadAccess/);
    assert.doesNotMatch(queriesSrc, /createAdminClient/);
    assert.doesNotMatch(queriesSrc, /service_role/i);
  });

  test("staff admin events are queried with staff_id filter only", () => {
    const queriesSrc = readFileSync(
      join(root, "src/features/staff-admin/server/staff-queries.ts"),
      "utf8"
    );
    assert.match(queriesSrc, /staff_admin_events/);
    assert.match(queriesSrc, /\.eq\("staff_id", staffId\)/);
  });
});

describe("Phase 6D security — cross-team denial", () => {
  test("correctDay enforces manager correction scope before RPC", () => {
    const actionsSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-actions.ts"),
      "utf8"
    );
    assert.match(actionsSrc, /canCorrectAllAttendance/);
    assert.match(actionsSrc, /canCorrectTeamAttendance/);
    assert.match(actionsSrc, /input\.staffId !== context\.userId/);
    assert.match(actionsSrc, /ATTENDANCE_MANAGER_SCOPE_DENIED/);
  });

  test("team load queries only direct reports for manager scope", () => {
    const actionsSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-actions.ts"),
      "utf8"
    );
    assert.match(actionsSrc, /reporting_manager_id/);
    assert.match(actionsSrc, /requireAttendanceTeamRead/);
    assert.doesNotMatch(actionsSrc, /\.from\("staff_employment_profiles"\)[\s\S]*?\.select\([\s\S]*?\)[\s\S]*?\.eq\("staff_id"/);
  });

  test("correction RPC scopes team managers to direct reports in migration", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    const correctionBlock = sql.slice(
      sql.indexOf("function public.correct_attendance_day"),
      sql.indexOf("function public.publish_attendance_policy")
    );
    assert.match(correctionBlock, /staff_direct_report_ids\(v_actor\)/);
    assert.match(correctionBlock, /ATTENDANCE_MANAGER_SCOPE_DENIED/);
  });

  test("manager scope denial maps to frozen attendance error code", () => {
    const error = attendanceErrorFromPostgresMessage("ATTENDANCE_MANAGER_SCOPE_DENIED");
    assert.equal(error.code, "ATTENDANCE_MANAGER_SCOPE_DENIED");
    assert.equal(error.httpStatus, 403);
  });
});

describe("Phase 6D security — append-only audit tables", () => {
  test("migration defines append-only triggers on audit and event tables", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    for (const table of [
      "staff_admin_events",
      "attendance_events",
      "attendance_corrections",
    ]) {
      assert.match(sql, new RegExp(`trg_${table}_no_update`));
      assert.match(sql, new RegExp(`trg_${table}_no_delete`));
      assert.match(sql, new RegExp(`before update on public\\.${table}`));
      assert.match(sql, new RegExp(`before delete on public\\.${table}`));
    }
    assert.match(sql, /private\.forbid_append_only_mutation\(\)/);
  });

  test("server modules do not mutate append-only tables directly", () => {
    for (const relativePath of [
      "src/features/staff-admin/server/staff-actions.ts",
      "src/features/staff-attendance/server/attendance-actions.ts",
      "src/features/staff-attendance/server/attendance-form-actions.ts",
    ]) {
      const src = readFileSync(join(root, relativePath), "utf8");
      assert.doesNotMatch(src, /\.update\(/);
      assert.doesNotMatch(src, /\.delete\(/);
      assert.doesNotMatch(src, /\.upsert\(/);
    }
  });

  test("staff admin events table is append-only in pgTAP contract", () => {
    const pgTapSrc = readFileSync(
      join(root, "supabase/tests/database/17_staff_attendance_leave_foundation_test.sql"),
      "utf8"
    );
    assert.match(pgTapSrc, /staff_admin_events append-only/);
    assert.match(pgTapSrc, /attendance_events append-only/);
  });
});

describe("Phase 6D security — idempotency conflict and replay", () => {
  test("attendance idempotency conflict is a frozen error code", () => {
    assert.equal(isAttendanceErrorCode("ATTENDANCE_IDEMPOTENCY_CONFLICT"), true);
    const error = attendanceErrorFromPostgresMessage("ATTENDANCE_IDEMPOTENCY_CONFLICT");
    assert.equal(error.code, "ATTENDANCE_IDEMPOTENCY_CONFLICT");
    assert.equal(error.httpStatus, 409);
  });

  test("staff finalize uses client_request_id idempotency store", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    assert.match(sql, /staff_admin_idempotency/);
    assert.match(sql, /idempotentReplay/);
    const finalizeBlock = sql.slice(
      sql.indexOf("function public.finalize_staff_member"),
      sql.indexOf("function public.reconcile_staff_invite")
    );
    assert.match(finalizeBlock, /client_request_id = p_client_request_id/);
    assert.match(finalizeBlock, /jsonb_build_object\('idempotentReplay', true\)/);
  });

  test("check-in idempotency replay returns stable payload fields", () => {
    const sql = readFileSync(M23_MIGRATION, "utf8");
    const checkInBlock = sql.slice(
      sql.indexOf("function public.check_in_attendance"),
      sql.indexOf("function public.check_out_attendance")
    );
    assert.match(checkInBlock, /idempotency_key = p_idempotency_key/);
    assert.match(checkInBlock, /'idempotentReplay', true/);
  });

  test("staff and attendance forms expose idempotency keys to server actions only", () => {
    const staffFormSrc = readFileSync(
      join(root, "src/features/staff-admin/components/StaffCreateForm.tsx"),
      "utf8"
    );
    const attendancePanelSrc = readFileSync(
      join(root, "src/features/staff-attendance/components/AttendanceTodayPanel.tsx"),
      "utf8"
    );
    assert.match(staffFormSrc, /clientRequestId/);
    assert.match(attendancePanelSrc, /idempotencyKey/);
    assert.doesNotMatch(staffFormSrc, /finalize_staff_member/);
    assert.doesNotMatch(attendancePanelSrc, /check_in_attendance/);
  });

  test("staff reconciliation not found maps without leaking actor details", () => {
    const error = staffErrorFromPostgresMessage("reconciliation request not found");
    assert.equal(error.code, "STAFF_RECONCILIATION_NOT_FOUND");
    assert.equal(error.httpStatus, 404);
    assert.doesNotMatch(error.message, /actor/i);
  });
});

describe("Phase 6D security — no service role in client bundle", () => {
  test("staff-admin and attendance client components avoid elevated Supabase keys", () => {
    for (const src of readClientBundleSources()) {
      for (const pattern of CLIENT_BUNDLE_PATTERNS) {
        assert.doesNotMatch(src, pattern);
      }
      assert.doesNotMatch(src, /createClient\(/);
    }
  });

  test("staff RPC modules use authenticated client only", () => {
    for (const relativePath of readdirSync(join(root, "src/features/staff-admin/server")).filter(
      (name) => name.endsWith(".ts") && name !== "staff-invite-adapter.ts"
    )) {
      const src = readFileSync(join(root, "src/features/staff-admin/server", relativePath), "utf8");
      assert.doesNotMatch(src, /createAdminClient/);
      assert.doesNotMatch(src, /serviceRoleKey/);
    }
  });

  test("invite adapter remains server-only and isolated from client bundles", () => {
    const adapterSrc = readFileSync(
      join(root, "src/features/staff-admin/server/staff-invite-adapter.ts"),
      "utf8"
    );
    assert.match(adapterSrc, /server-only/);
    assert.match(adapterSrc, /inviteUserByEmail/);
    assert.doesNotMatch(adapterSrc, /NEXT_PUBLIC/);
  });

  test("env example keeps service role server-scoped", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(example, /SUPABASE_SERVICE_ROLE_KEY=/);
    assert.doesNotMatch(example, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
  });
});
