/**
 * Workforce V1 — attendance UI contract tests.
 *
 * Structural assertions over the staff and Super Admin surfaces. They pin the
 * rules that must survive a refactor: staff never type authoritative
 * timestamps, only Super Admin sees approval controls, and bulk approval cannot
 * quietly widen past the rows that are safe to approve.
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  isBulkApprovable,
  monthBounds,
  formatMinutes,
  WORKFORCE_EXCEPTION_FLAGS,
  WORKFORCE_SUBMITTABLE_CATEGORIES,
  type WorkforceApprovalInboxRow,
} from "../contracts/workforce-contracts.ts";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const SUBMISSION_PANEL =
  "src/features/staff-attendance/components/AttendanceSubmissionPanel.tsx";
const APPROVAL_INBOX =
  "src/features/staff-attendance/components/AttendanceApprovalInbox.tsx";
const SUMMARY_CARD =
  "src/features/staff-attendance/components/WorkforceMonthlySummaryCard.tsx";
const FORM_ACTIONS =
  "src/features/staff-attendance/server/workforce-form-actions.ts";
const APPROVALS_PAGE = "src/app/admin/attendance/approvals/page.tsx";
const TODAY_PAGE = "src/app/admin/attendance/page.tsx";
const NAV = "src/features/staff-attendance/components/shell/AttendanceNav.tsx";
const LAYOUT = "src/app/admin/attendance/layout.tsx";

describe("Workforce UI — routes exist", () => {
  test("approvals route ships with loading and error states", () => {
    for (const file of [
      APPROVALS_PAGE,
      "src/app/admin/attendance/approvals/loading.tsx",
      "src/app/admin/attendance/approvals/error.tsx",
    ]) {
      assert.ok(existsSync(join(root, file)), `${file} must exist`);
    }
  });
});

describe("Workforce UI — staff surface", () => {
  const panel = read(SUBMISSION_PANEL);

  test("offers exactly the canonical submittable categories", () => {
    // The panel renders from the shared constant rather than a hand-written
    // list, so the set can never drift from the contract (and therefore from
    // the database check constraint).
    assert.match(panel, /WORKFORCE_SUBMITTABLE_CATEGORIES\.map/);
    assert.equal(WORKFORCE_SUBMITTABLE_CATEGORIES.length, 4);
    assert.ok(
      !(WORKFORCE_SUBMITTABLE_CATEGORIES as readonly string[]).includes("ABSENT")
    );

    // ABSENT must never appear as a self-service submit value.
    assert.doesNotMatch(panel, /value="ABSENT"/);
    assert.doesNotMatch(panel, /name="category"[^>]*value="ABSENT"/);
  });

  test("staff cannot type an authoritative check-in or check-out time", () => {
    // No date/time/datetime input anywhere on the staff submission surface.
    assert.doesNotMatch(panel, /type="datetime-local"/);
    assert.doesNotMatch(panel, /type="time"/);
    assert.doesNotMatch(panel, /name="checkInAt"/);
    assert.doesNotMatch(panel, /name="checkOutAt"/);
    assert.doesNotMatch(panel, /name="occurredAt"/);
  });

  test("weekly off quota is shown prominently as used and remaining", () => {
    assert.match(panel, /WeeklyOffQuotaIndicator/);
    assert.match(panel, /used\} of \{WORKFORCE_WEEKLY_OFF_MONTHLY_CAP\} used/);
    assert.match(panel, /remaining\} remaining/);
    // And the control is disabled once the allowance is gone.
    assert.match(panel, /weeklyOffBlocked/);
  });

  test("an approved day is not re-submittable from the staff surface", () => {
    assert.match(panel, /isApproved/);
    assert.match(panel, /approved and final/i);
  });

  test("correction request is available and explains the boundary", () => {
    assert.match(panel, /requestAttendanceCorrectionAction/);
    assert.match(panel, /cannot edit recorded times yourself/i);
  });

  test("today page shows submission, quota, monthly summary and history", () => {
    const page = read(TODAY_PAGE);
    assert.match(page, /AttendanceSubmissionPanel/);
    assert.match(page, /WorkforceMonthlySummaryCard/);
    assert.match(page, /WorkforceSubmissionHistory/);
    assert.match(page, /loadMonthlyAttendanceSummary/);
  });

  test("monthly summary reports approved-only counts and unresolved separately", () => {
    const card = read(SUMMARY_CARD);
    assert.match(card, /approved days only/);
    assert.match(card, /Unresolved/);
    assert.match(card, /not counted as Absent/i);
    for (const key of [
      "fullDay8hCount",
      "fullDay12hCount",
      "halfDay4hCount",
      "weeklyOffCount",
      "absentCount",
      "lateDayCount",
    ]) {
      assert.match(card, new RegExp(key));
    }
  });
});

describe("Workforce UI — Super Admin surface", () => {
  const inbox = read(APPROVAL_INBOX);

  test("inbox shows every column the owner specified", () => {
    for (const column of [
      "Employee",
      "Date",
      "In",
      "Out",
      "Elapsed",
      "Submitted",
      "Final",
      "Late",
      "Flags",
      "State",
      "Actions",
    ]) {
      assert.match(inbox, new RegExp(`>${column}<`), `column ${column} missing`);
    }
  });

  test("all four decision actions plus bulk are present", () => {
    assert.match(inbox, /approveAttendanceDayAction/);
    assert.match(inbox, /rejectAttendanceDayAction/);
    assert.match(inbox, /returnAttendanceForCorrectionAction/);
    assert.match(inbox, /approveSelectedAttendanceAction/);
    assert.match(inbox, /Edit \+ Approve/);
  });

  test("every exception flag is filterable", () => {
    assert.match(inbox, /WORKFORCE_EXCEPTION_FLAGS\.map/);
    for (const flag of WORKFORCE_EXCEPTION_FLAGS) {
      assert.match(inbox, new RegExp(flag), `flag ${flag} missing from inbox`);
    }
  });

  test("times render in Asia/Kolkata", () => {
    assert.match(inbox, /timeZone: "Asia\/Kolkata"/);
  });

  test("decision forms are not nested inside the bulk form", () => {
    // Nested <form> is invalid HTML; the checkboxes associate by id instead.
    assert.match(inbox, /form=\{bulkFormId\}/);
    assert.match(inbox, /<form id=\{bulkFormId\}/);
  });

  test("approvals page is Super Admin gated", () => {
    const page = read(APPROVALS_PAGE);
    assert.match(page, /canApproveAttendance/);
    assert.match(page, /redirect\("\/auth\/forbidden"\)/);
  });

  test("nav only reveals approvals to approvers", () => {
    assert.match(read(NAV), /showApprovals/);
    assert.match(read(LAYOUT), /showApprovals=\{context\.canApproveAttendance\}/);
  });
});

describe("Workforce UI — bulk approval safety", () => {
  const actions = read(FORM_ACTIONS);

  test("bulk approval reuses the single-row RPC per row", () => {
    assert.match(actions, /for \(const selection of selections\)/);
    assert.match(actions, /await approveAttendanceDay\(/);
    // No dedicated "bulk" RPC that could skip per-row validation.
    assert.doesNotMatch(actions, /bulk_approve/);
  });

  test("failures are reported rather than silently swallowed", () => {
    assert.match(actions, /failures\.push/);
    assert.match(actions, /could not be approved/);
  });

  test("only straightforward pending rows are selectable", () => {
    const base: WorkforceApprovalInboxRow = {
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
      employeeName: "E",
      employeeCode: "OD-1",
      inTime: null,
      outTime: null,
      elapsedMinutes: 480,
      exceptionFlags: ["UNAPPROVED"],
    };
    assert.equal(isBulkApprovable(base), true);
    assert.equal(
      isBulkApprovable({ ...base, exceptionFlags: ["WEEKLY_OFF_QUOTA_ISSUE"] }),
      false
    );
  });
});

describe("Workforce UI — shared helpers", () => {
  test("month bounds cover the whole calendar month", () => {
    assert.deepEqual(monthBounds("2026-09-02"), {
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    });
    assert.deepEqual(monthBounds("2026-02-15"), {
      monthStart: "2026-02-01",
      monthEnd: "2026-02-28",
    });
    // Leap year still resolves correctly.
    assert.deepEqual(monthBounds("2028-02-10"), {
      monthStart: "2028-02-01",
      monthEnd: "2028-02-29",
    });
  });

  test("minutes format as hours and minutes, with an em dash for unknown", () => {
    assert.equal(formatMinutes(480), "8h 0m");
    assert.equal(formatMinutes(245), "4h 5m");
    assert.equal(formatMinutes(0), "0h 0m");
    assert.equal(formatMinutes(null), "—");
  });
});
