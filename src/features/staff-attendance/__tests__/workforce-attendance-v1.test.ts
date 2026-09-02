/**
 * Workforce V1 — attendance lifecycle contract tests.
 *
 * These pin the owner-locked business rules at the shared-contract layer, the
 * one the web UI and the future Android staff app both consume. Database-level
 * enforcement is proven separately in
 * supabase/tests/database/40_workforce_attendance_v1_lifecycle_test.sql.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  canSubmitWeeklyOff,
  computeLateEvidence,
  isBulkApprovable,
  isPayrollValid,
  isUnresolved,
  isWorkforceFinalCategory,
  isWorkforceSubmittableCategory,
  mapApprovalInboxRow,
  mapMonthlySummary,
  weeklyOffRemaining,
  workforceCreditedMinutes,
  WORKFORCE_EXCEPTION_FLAGS,
  WORKFORCE_FINAL_CATEGORIES,
  WORKFORCE_LIFECYCLE_STATES,
  WORKFORCE_SUBMITTABLE_CATEGORIES,
  WORKFORCE_TIMEZONE,
  WORKFORCE_WEEKLY_OFF_MONTHLY_CAP,
  type WorkforceApprovalInboxRow,
} from "../contracts/workforce-contracts.ts";
import {
  isWorkforceErrorCode,
  workforceErrorFromPostgresMessage,
  WORKFORCE_ERROR_CODES,
} from "../contracts/workforce-errors.ts";
import { ATTENDANCE_ERROR_CODES } from "../contracts/errors.ts";

const root = process.cwd();
const MIGRATION = join(
  root,
  "supabase/migrations/20260902160000_workforce_attendance_v1_lifecycle.sql"
);

describe("Workforce V1 — categories and credit", () => {
  test("exactly the five locked final categories exist", () => {
    assert.deepEqual(
      [...WORKFORCE_FINAL_CATEGORIES],
      ["ABSENT", "WEEKLY_OFF", "HALF_DAY_4H", "FULL_DAY_8H", "FULL_DAY_12H"]
    );
  });

  test("staff cannot submit ABSENT", () => {
    assert.equal(isWorkforceSubmittableCategory("ABSENT"), false);
    assert.equal(isWorkforceFinalCategory("ABSENT"), true);
    assert.ok(!(WORKFORCE_SUBMITTABLE_CATEGORIES as readonly string[]).includes("ABSENT"));
  });

  test("credited minutes match the locked hours", () => {
    assert.equal(workforceCreditedMinutes("ABSENT"), 0);
    assert.equal(workforceCreditedMinutes("WEEKLY_OFF"), 0);
    assert.equal(workforceCreditedMinutes("HALF_DAY_4H"), 240);
    assert.equal(workforceCreditedMinutes("FULL_DAY_8H"), 480);
    assert.equal(workforceCreditedMinutes("FULL_DAY_12H"), 720);
  });

  test("business timezone is Asia/Kolkata", () => {
    assert.equal(WORKFORCE_TIMEZONE, "Asia/Kolkata");
  });
});

describe("Workforce V1 — 09:00 start with 15-minute grace", () => {
  const officialStart = 9 * 60; // 09:00
  const grace = 15;

  const at = (hh: number, mm: number) =>
    computeLateEvidence({
      checkInMinutesFromMidnight: hh * 60 + mm,
      officialStartMinutesFromMidnight: officialStart,
      graceMinutes: grace,
    });

  test("09:00 exactly is on time with zero late minutes", () => {
    assert.deepEqual(at(9, 0), { lateMinutes: 0, isLate: false });
  });

  test("early arrival never produces negative late minutes", () => {
    assert.deepEqual(at(8, 30), { lateMinutes: 0, isLate: false });
  });

  test("09:15 is the last on-time minute", () => {
    assert.deepEqual(at(9, 15), { lateMinutes: 15, isLate: false });
  });

  test("09:16 is the first late minute and counts from 09:00", () => {
    assert.deepEqual(at(9, 16), { lateMinutes: 16, isLate: true });
  });

  test("10:00 records 60 late minutes", () => {
    assert.deepEqual(at(10, 0), { lateMinutes: 60, isLate: true });
  });

  test("a missing check-in is not late", () => {
    assert.deepEqual(
      computeLateEvidence({
        checkInMinutesFromMidnight: null,
        officialStartMinutesFromMidnight: officialStart,
        graceMinutes: grace,
      }),
      { lateMinutes: 0, isLate: false }
    );
  });
});

describe("Workforce V1 — Weekly Off monthly cap", () => {
  test("the cap is four per employee per calendar month", () => {
    assert.equal(WORKFORCE_WEEKLY_OFF_MONTHLY_CAP, 4);
  });

  test("the first four are allowed and the fifth is not", () => {
    assert.equal(canSubmitWeeklyOff(0), true);
    assert.equal(canSubmitWeeklyOff(3), true);
    assert.equal(canSubmitWeeklyOff(4), false);
    assert.equal(canSubmitWeeklyOff(5), false);
  });

  test("remaining allowance never goes negative", () => {
    assert.equal(weeklyOffRemaining(0), 4);
    assert.equal(weeklyOffRemaining(3), 1);
    assert.equal(weeklyOffRemaining(4), 0);
    assert.equal(weeklyOffRemaining(9), 0);
  });
});

describe("Workforce V1 — lifecycle", () => {
  test("the locked lifecycle states exist in order", () => {
    assert.deepEqual(
      [...WORKFORCE_LIFECYCLE_STATES],
      [
        "NOT_STARTED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "SUBMITTED",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "CORRECTION_REQUIRED",
      ]
    );
  });

  test("only APPROVED is payroll-valid", () => {
    for (const state of WORKFORCE_LIFECYCLE_STATES) {
      assert.equal(isPayrollValid(state), state === "APPROVED");
    }
  });

  test("a closed day without approval is unresolved, never auto-absent", () => {
    assert.equal(isUnresolved("PENDING_APPROVAL", "2026-09-01", "2026-09-02"), true);
    assert.equal(isUnresolved("NOT_STARTED", "2026-09-01", "2026-09-02"), true);
    assert.equal(isUnresolved("CORRECTION_REQUIRED", "2026-09-01", "2026-09-02"), true);
    // Today is still open, so it is not yet unresolved.
    assert.equal(isUnresolved("NOT_STARTED", "2026-09-02", "2026-09-02"), false);
    // Approved days are resolved.
    assert.equal(isUnresolved("APPROVED", "2026-09-01", "2026-09-02"), false);
  });
});

describe("Workforce V1 — bulk approval safety", () => {
  const baseRow: WorkforceApprovalInboxRow = {
    staffId: "s1",
    attendanceDate: "2026-09-01",
    lifecycleState: "PENDING_APPROVAL",
    submittedCategory: "FULL_DAY_8H",
    finalCategory: null,
    creditedMinutes: null,
    lateMinutes: 0,
    isLate: false,
    reviewNote: null,
    reviewedAt: null,
    employeeName: "Test Employee",
    employeeCode: "OD-001",
    inTime: "2026-09-01T03:30:00Z",
    outTime: "2026-09-01T12:30:00Z",
    elapsedMinutes: 540,
    exceptionFlags: ["UNAPPROVED"],
  };

  test("a straightforward pending row is bulk approvable", () => {
    assert.equal(isBulkApprovable(baseRow), true);
  });

  test("a merely late row is still bulk approvable", () => {
    // Lateness is evidence, not a blocker.
    assert.equal(
      isBulkApprovable({ ...baseRow, isLate: true, exceptionFlags: ["LATE", "UNAPPROVED"] }),
      true
    );
  });

  test("rows needing a human decision are excluded", () => {
    for (const flag of [
      "MISSING_CHECK_IN",
      "MISSING_CHECK_OUT",
      "VERY_SHORT_ATTENDANCE",
      "WEEKLY_OFF_QUOTA_ISSUE",
      "MANUALLY_EDITED",
      "MISSING_ATTENDANCE",
    ] as const) {
      assert.equal(
        isBulkApprovable({ ...baseRow, exceptionFlags: [flag] }),
        false,
        `${flag} must block bulk approval`
      );
    }
  });

  test("rows without a submitted category or not pending are excluded", () => {
    assert.equal(isBulkApprovable({ ...baseRow, submittedCategory: null }), false);
    assert.equal(isBulkApprovable({ ...baseRow, lifecycleState: "APPROVED" }), false);
    assert.equal(isBulkApprovable({ ...baseRow, lifecycleState: "NOT_STARTED" }), false);
  });
});

describe("Workforce V1 — row mapping", () => {
  test("approval inbox rows map defensively", () => {
    const row = mapApprovalInboxRow({
      staff_id: "s1",
      employee_name: "Test Employee",
      employee_code: "OD-002",
      attendance_date: "2026-09-01",
      in_time: null,
      out_time: null,
      elapsed_minutes: null,
      submitted_category: "FULL_DAY_12H",
      final_category: null,
      credited_minutes: null,
      late_minutes: 16,
      is_late: true,
      lifecycle_state: "PENDING_APPROVAL",
      review_note: null,
      reviewed_at: null,
      exception_flags: ["LATE", "NOT_A_REAL_FLAG"],
    });

    assert.equal(row.lifecycleState, "PENDING_APPROVAL");
    assert.equal(row.submittedCategory, "FULL_DAY_12H");
    assert.equal(row.lateMinutes, 16);
    assert.equal(row.isLate, true);
    assert.equal(row.elapsedMinutes, null);
    // Unknown flags are dropped rather than rendered.
    assert.deepEqual([...row.exceptionFlags], ["LATE"]);
  });

  test("an unknown lifecycle state degrades to NOT_STARTED", () => {
    const row = mapApprovalInboxRow({ lifecycle_state: "WAT", exception_flags: [] });
    assert.equal(row.lifecycleState, "NOT_STARTED");
  });

  test("monthly summary maps every locked counter", () => {
    const summary = mapMonthlySummary({
      staffId: "s1",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
      absentCount: 1,
      weeklyOffCount: 4,
      halfDay4hCount: 2,
      fullDay8hCount: 18,
      fullDay12hCount: 3,
      lateDayCount: 5,
      creditedMinutes: 12000,
      approvedDayCount: 28,
      weeklyOffRemaining: 0,
      unresolvedCount: 2,
    });

    assert.equal(summary.absentCount, 1);
    assert.equal(summary.weeklyOffCount, 4);
    assert.equal(summary.halfDay4hCount, 2);
    assert.equal(summary.fullDay8hCount, 18);
    assert.equal(summary.fullDay12hCount, 3);
    assert.equal(summary.lateDayCount, 5);
    assert.equal(summary.unresolvedCount, 2);
  });
});

describe("Workforce V1 — migration contract", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  test("no fixed weekly-off weekday is imposed", () => {
    // The Phase 6D non-empty requirement is relaxed so an empty array is valid.
    assert.match(sql, /drop constraint if exists chk_attendance_policies_weekly_off_days/);

    // Scope the check to the replacement constraint itself: prose elsewhere in
    // the migration legitimately quotes the old rule while explaining it.
    const added = sql.slice(
      sql.indexOf("add constraint chk_attendance_policies_weekly_off_days")
    );
    const constraintBody = added.slice(0, added.indexOf(";"));
    assert.doesNotMatch(constraintBody, /array_length/);
    assert.match(constraintBody, /weekly_off_days <@ array\[1, 2, 3, 4, 5, 6, 7\]/);
  });

  test("weekly off cap and self-approval guard are enforced in SQL", () => {
    assert.match(sql, /ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED/);
    assert.match(sql, /ATTENDANCE_SELF_APPROVAL_DENIED/);
    assert.match(sql, /workforce_weekly_off_active_count/);
  });

  test("staff submission excludes ABSENT in the database too", () => {
    assert.match(
      sql,
      /submitted_category = any \(array\[\s*'WEEKLY_OFF',\s*'HALF_DAY_4H',\s*'FULL_DAY_8H',\s*'FULL_DAY_12H'\s*\]\)/
    );
  });

  test("approved days must carry category, credit and reviewer", () => {
    assert.match(sql, /chk_attendance_submissions_approved_complete/);
    assert.match(sql, /chk_attendance_submissions_credit_matches_category/);
  });

  test("new tables are RLS + FORCE RLS and write-revoked", () => {
    assert.match(sql, /alter table public\.attendance_submissions enable row level security/);
    assert.match(sql, /alter table public\.attendance_submissions force row level security/);
    assert.match(sql, /revoke insert, update, delete on table/);
  });

  test("approval permission is added for Super Admin only", () => {
    assert.match(sql, /'attendance\.approve'/);
    assert.match(sql, /where r\.code = 'super_admin'/);
  });

  test("every exception flag surfaced by the inbox is a known flag", () => {
    for (const flag of WORKFORCE_EXCEPTION_FLAGS) {
      assert.match(sql, new RegExp(`'${flag}'`), `${flag} missing from inbox SQL`);
    }
  });
});

describe("Workforce V1 — error mapping", () => {
  test("database exception tokens map to client codes", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED", "WORKFORCE_WEEKLY_OFF_QUOTA_EXCEEDED"],
      ["ATTENDANCE_SELF_APPROVAL_DENIED", "WORKFORCE_SELF_APPROVAL_DENIED"],
      ["ATTENDANCE_APPROVAL_DENIED", "WORKFORCE_APPROVAL_DENIED"],
      ["ATTENDANCE_ALREADY_APPROVED", "WORKFORCE_ALREADY_APPROVED"],
      ["ATTENDANCE_CATEGORY_INVALID", "WORKFORCE_CATEGORY_INVALID"],
      ["ATTENDANCE_DATE_INVALID", "WORKFORCE_DATE_INVALID"],
      ["ATTENDANCE_REASON_REQUIRED", "WORKFORCE_REASON_REQUIRED"],
      ["ATTENDANCE_NOT_ELIGIBLE", "WORKFORCE_NOT_ELIGIBLE"],
    ];
    for (const [token, expected] of cases) {
      assert.equal(
        workforceErrorFromPostgresMessage(`ERROR: ${token}`).code,
        expected,
        `${token} must map to ${expected}`
      );
    }
  });

  test("approval denial is 403 and quota breach is 422", () => {
    assert.equal(
      workforceErrorFromPostgresMessage("ATTENDANCE_APPROVAL_DENIED").httpStatus,
      403
    );
    assert.equal(
      workforceErrorFromPostgresMessage("ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED").httpStatus,
      422
    );
  });

  test("an unmapped failure degrades to WORKFORCE_RPC_FAILED", () => {
    assert.equal(
      workforceErrorFromPostgresMessage("something unexpected").code,
      "WORKFORCE_RPC_FAILED"
    );
  });

  test("a bare permission denial is not silently treated as success", () => {
    assert.equal(
      workforceErrorFromPostgresMessage("42501: permission denied for table").code,
      "WORKFORCE_PERMISSION_DENIED"
    );
  });

  test("the Phase 6D frozen vocabulary is left untouched", () => {
    // Workforce V1 must not extend the Phase 6D contract-freeze list, which is
    // pinned to a historical audit document.
    for (const code of WORKFORCE_ERROR_CODES) {
      assert.equal(isWorkforceErrorCode(code), true);
      assert.ok(
        !(ATTENDANCE_ERROR_CODES as readonly string[]).includes(code),
        `${code} must not leak into the frozen Phase 6D vocabulary`
      );
    }
  });
});
