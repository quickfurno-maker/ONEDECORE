/**
 * Phase 6D-B — attendance runtime contracts and mapper tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ATTENDANCE_ERROR_CODES,
  attendanceErrorFromPostgresMessage,
  isAttendanceErrorCode,
} from "../contracts/errors.ts";
import {
  aggregateAttendanceMonthTotals,
  isAttendanceCorrectionType,
  isAttendanceLocationCategory,
  isAttendancePrimaryStatus,
  mapAttendanceCheckRpcResult,
  mapAttendanceCorrectionRpcResult,
  mapAttendanceDayRowToSummary,
  mapAttendanceDayRowToToday,
  monthDateRange,
  resolveAttendanceBusinessDate,
  roundAttendanceCoordinate,
} from "../contracts/dto.ts";

const root = process.cwd();

describe("Phase 6D-B attendance runtime", () => {
  test("ATTENDANCE_ERROR_CODES matches contract freeze vocabulary", () => {
    const contract = readFileSync(
      join(root, "docs/audits/phase-6d-implementation-contract-freeze.md"),
      "utf8"
    );

    for (const code of ATTENDANCE_ERROR_CODES) {
      assert.match(contract, new RegExp(`\`${code}\``));
      assert.equal(isAttendanceErrorCode(code), true);
    }
  });

  test("attendanceErrorFromPostgresMessage maps frozen RPC tokens", () => {
    assert.equal(
      attendanceErrorFromPostgresMessage("ATTENDANCE_ALREADY_CHECKED_IN").code,
      "ATTENDANCE_ALREADY_CHECKED_IN"
    );
    assert.equal(
      attendanceErrorFromPostgresMessage("ATTENDANCE_MANAGER_SCOPE_DENIED").code,
      "ATTENDANCE_MANAGER_SCOPE_DENIED"
    );
    assert.equal(
      attendanceErrorFromPostgresMessage("permission denied for table attendance_days").code,
      "ATTENDANCE_UNAUTHORIZED"
    );
  });

  test("resolveAttendanceBusinessDate uses Asia/Kolkata calendar date", () => {
    const date = resolveAttendanceBusinessDate(new Date("2026-08-09T20:30:00.000Z"));
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("roundAttendanceCoordinate caps precision to three decimals", () => {
    assert.equal(roundAttendanceCoordinate(18.5203849), 18.52);
    assert.equal(roundAttendanceCoordinate(null), null);
  });

  test("mapAttendanceDayRowToToday derives absent default when no row exists", () => {
    const today = mapAttendanceDayRowToToday(null, "2026-08-09");
    assert.equal(today.attendanceDate, "2026-08-09");
    assert.equal(today.primaryStatus, "absent");
    assert.equal(today.openSession, false);
    assert.equal(today.workedMinutesSoFar, 0);
  });

  test("mapAttendanceDayRowToSummary preserves flags and event count", () => {
    const summary = mapAttendanceDayRowToSummary(
      {
        staff_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        attendance_date: "2026-08-09",
        primary_status: "present",
        first_check_in_at: "2026-08-09T03:30:00.000Z",
        last_check_out_at: "2026-08-09T12:30:00.000Z",
        worked_minutes: 480,
        is_late: true,
        is_early_checkout: false,
        is_missing_checkout: false,
        has_manual_adjustment: false,
        open_session: false,
      },
      2
    );

    assert.equal(summary.primaryStatus, "present");
    assert.equal(summary.eventCount, 2);
    assert.equal(summary.isLate, true);
  });

  test("aggregateAttendanceMonthTotals computes operational totals only", () => {
    const totals = aggregateAttendanceMonthTotals([
      mapAttendanceDayRowToSummary(
        {
          staff_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          attendance_date: "2026-08-01",
          primary_status: "present",
          first_check_in_at: null,
          last_check_out_at: null,
          worked_minutes: 480,
          is_late: true,
          is_early_checkout: true,
          is_missing_checkout: false,
          has_manual_adjustment: false,
          open_session: false,
        },
        2
      ),
      mapAttendanceDayRowToSummary(
        {
          staff_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          attendance_date: "2026-08-02",
          primary_status: "leave",
          first_check_in_at: null,
          last_check_out_at: null,
          worked_minutes: 0,
          is_late: false,
          is_early_checkout: false,
          is_missing_checkout: true,
          has_manual_adjustment: false,
          open_session: false,
        },
        0
      ),
    ]);

    assert.deepEqual(totals, {
      presentDays: 1,
      absentDays: 0,
      leaveDays: 1,
      halfDays: 0,
      lateCount: 1,
      earlyCheckoutCount: 1,
      missingCheckoutCount: 1,
      workedMinutes: 480,
    });
  });

  test("mapAttendanceCheckRpcResult normalizes RPC payload", () => {
    const result = mapAttendanceCheckRpcResult({
      staffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attendanceDate: "2026-08-09",
      primaryStatus: "present",
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      openSession: true,
      idempotentReplay: true,
      occurredAt: "2026-08-09T03:30:00.000Z",
    });

    assert.equal(result.idempotentReplay, true);
    assert.equal(result.openSession, true);
    assert.equal(result.primaryStatus, "present");
  });

  test("mapAttendanceCorrectionRpcResult normalizes correction payload", () => {
    const result = mapAttendanceCorrectionRpcResult({
      correctionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      staffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attendanceDate: "2026-08-09",
      primaryStatus: "half_day",
    });

    assert.equal(result.primaryStatus, "half_day");
  });

  test("frozen enums reject unknown values", () => {
    assert.equal(isAttendancePrimaryStatus("present"), true);
    assert.equal(isAttendancePrimaryStatus("pto"), false);
    assert.equal(isAttendanceLocationCategory("office"), true);
    assert.equal(isAttendanceLocationCategory("home"), false);
    assert.equal(isAttendanceCorrectionType("void_open_session"), true);
    assert.equal(isAttendanceCorrectionType("delete_day"), false);
  });

  test("monthDateRange returns inclusive calendar bounds", () => {
    assert.deepEqual(monthDateRange(2026, 8), {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
  });

  test("migration exposes attendance RPC names used by server actions", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql"),
      "utf8"
    );

    for (const rpc of [
      "check_in_attendance",
      "check_out_attendance",
      "correct_attendance_day",
      "publish_attendance_policy",
      "set_current_attendance_policy",
    ]) {
      assert.match(migration, new RegExp(`function public\\.${rpc}\\(`));
    }
  });
});
