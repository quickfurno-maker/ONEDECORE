/**
 * Phase 6D-C — leave and holiday runtime contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  LEAVE_ERROR_CODES,
  isLeaveErrorCode,
  leaveErrorFromPostgresMessage,
} from "../contracts/errors.ts";
import {
  formatLeaveDateRange,
  isLeaveHalfDayPart,
  isLeaveRequestStatus,
  mapHolidayMutationRpcResult,
  mapHolidayRowToSummary,
  mapLeaveMutationRpcResult,
  mapLeaveRequestRowToDetail,
  mapLeaveRequestRowToSummary,
} from "../contracts/dto.ts";

const root = process.cwd();

const sampleLeaveRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  staff_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  leave_type_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  start_date: "2026-08-12",
  end_date: "2026-08-14",
  half_day_part: null,
  reason: "Family event",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  created_at: "2026-08-09T10:00:00.000Z",
  updated_at: "2026-08-09T10:00:00.000Z",
  leave_types: { display_name: "Casual Leave" },
} as const;

describe("Phase 6D-C leave and holiday runtime", () => {
  test("LEAVE_ERROR_CODES matches contract freeze vocabulary", () => {
    const contract = readFileSync(
      join(root, "docs/audits/phase-6d-implementation-contract-freeze.md"),
      "utf8"
    );

    for (const code of LEAVE_ERROR_CODES) {
      assert.match(contract, new RegExp(code));
      assert.equal(isLeaveErrorCode(code), true);
    }
  });

  test("leaveErrorFromPostgresMessage maps frozen RPC tokens", () => {
    assert.equal(leaveErrorFromPostgresMessage("LEAVE_OVERLAP").code, "LEAVE_OVERLAP");
    assert.equal(
      leaveErrorFromPostgresMessage("LEAVE_SELF_APPROVAL_DENIED").code,
      "LEAVE_SELF_APPROVAL_DENIED"
    );
    assert.equal(
      leaveErrorFromPostgresMessage("permission denied for leave request").code,
      "LEAVE_UNAUTHORIZED"
    );
  });

  test("mapLeaveRequestRowToSummary exposes stable list shape", () => {
    const summary = mapLeaveRequestRowToSummary(sampleLeaveRow);
    assert.equal(summary.typeName, "Casual Leave");
    assert.equal(summary.range, "2026-08-12 – 2026-08-14");
    assert.equal(summary.status, "pending");
    assert.equal(summary.halfDayPart, null);
  });

  test("mapLeaveRequestRowToDetail extends summary with audit fields", () => {
    const detail = mapLeaveRequestRowToDetail(sampleLeaveRow);
    assert.equal(detail.staffId, sampleLeaveRow.staff_id);
    assert.equal(detail.leaveTypeId, sampleLeaveRow.leave_type_id);
    assert.equal(detail.createdAt, sampleLeaveRow.created_at);
  });

  test("formatLeaveDateRange collapses single-day requests", () => {
    assert.equal(formatLeaveDateRange("2026-08-12", "2026-08-12"), "2026-08-12");
  });

  test("mapLeaveMutationRpcResult normalizes RPC payload", () => {
    const result = mapLeaveMutationRpcResult({
      requestId: sampleLeaveRow.id,
      status: "approved",
    });
    assert.equal(result.requestId, sampleLeaveRow.id);
    assert.equal(result.status, "approved");
  });

  test("mapHolidayRowToSummary and mutation mapper stay stable", () => {
    const summary = mapHolidayRowToSummary({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      holiday_date: "2026-08-15",
      name: "Independence Day",
      is_active: true,
    });
    assert.equal(summary.name, "Independence Day");
    assert.equal(summary.isActive, true);

    const archived = mapHolidayMutationRpcResult({
      holidayId: summary.id,
      isActive: false,
    });
    assert.equal(archived.holidayId, summary.id);
    assert.equal(archived.isActive, false);
  });

  test("frozen leave enums reject unknown values", () => {
    assert.equal(isLeaveRequestStatus("approved"), true);
    assert.equal(isLeaveRequestStatus("draft"), false);
    assert.equal(isLeaveHalfDayPart("am"), true);
    assert.equal(isLeaveHalfDayPart("full"), false);
  });

  test("migration exposes leave and holiday RPC names used by server actions", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260810140000_staff_attendance_leave_foundation.sql"),
      "utf8"
    );

    for (const rpc of [
      "create_leave_request",
      "cancel_leave_request",
      "approve_leave_request",
      "reject_leave_request",
      "create_holiday",
      "archive_holiday",
    ]) {
      assert.match(migration, new RegExp(`function public\\.${rpc}\\(`));
    }
  });
});
