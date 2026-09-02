/**
 * Phase 6D-D — attendance UI route gates, mobile card states, and state patterns.
 */

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  mapAttendanceDayRowToToday,
  type AttendanceToday,
} from "../contracts/dto.ts";
import type { AttendanceAccessContext } from "../server/attendance-auth.ts";

const root = process.cwd();

function fileExists(relativePath: string): boolean {
  try {
    return statSync(join(root, relativePath)).isFile();
  } catch {
    return false;
  }
}

function attendanceAuthContext(
  overrides: Partial<AttendanceAccessContext> & Pick<AttendanceAccessContext, "userId">
): AttendanceAccessContext {
  return {
    email: null,
    canSelfAttendance: false,
    canReadTeamAttendance: false,
    canReadAllAttendance: false,
    canCorrectAllAttendance: false,
    canCorrectTeamAttendance: false,
    canManagePolicies: false,
    canApproveAttendance: false,
    ...overrides,
  };
}

function hasAttendanceWorkspaceAccess(context: AttendanceAccessContext): boolean {
  return (
    context.canSelfAttendance ||
    context.canReadTeamAttendance ||
    context.canReadAllAttendance ||
    context.canManagePolicies
  );
}

function canOpenAttendanceTeam(context: AttendanceAccessContext): boolean {
  return context.canReadTeamAttendance || context.canReadAllAttendance;
}

function canOpenAttendanceCorrections(context: AttendanceAccessContext): boolean {
  return context.canCorrectAllAttendance || context.canCorrectTeamAttendance;
}

const sampleDayRow = {
  staff_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  attendance_date: "2026-08-09",
  primary_status: "present" as const,
  first_check_in_at: "2026-08-09T03:30:00.000Z",
  last_check_out_at: null,
  worked_minutes: 120,
  is_late: true,
  is_early_checkout: false,
  is_missing_checkout: false,
  has_manual_adjustment: false,
  open_session: true,
};

describe("Phase 6D-D mock attendance auth probes", () => {
  test("self-only staff has workspace access without team nav", () => {
    const context = attendanceAuthContext({
      userId: "exec-a",
      canSelfAttendance: true,
    });
    assert.equal(hasAttendanceWorkspaceAccess(context), true);
    assert.equal(canOpenAttendanceTeam(context), false);
    assert.equal(canOpenAttendanceCorrections(context), false);
  });

  test("team manager can read team but not policies without manage grant", () => {
    const context = attendanceAuthContext({
      userId: "mgr-a",
      canReadTeamAttendance: true,
      canCorrectTeamAttendance: true,
    });
    assert.equal(hasAttendanceWorkspaceAccess(context), true);
    assert.equal(canOpenAttendanceTeam(context), true);
    assert.equal(canOpenAttendanceCorrections(context), true);
    assert.equal(context.canManagePolicies, false);
  });

  test("denied when no attendance permissions are granted", () => {
    const context = attendanceAuthContext({ userId: "reader" });
    assert.equal(hasAttendanceWorkspaceAccess(context), false);
  });

  test("attendance-auth uses getStaffClaims aligned session path", () => {
    const authSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-auth.ts"),
      "utf8"
    );
    assert.match(authSrc, /getStaffClaims/);
    assert.match(authSrc, /probeAttendancePermissions/);
    assert.doesNotMatch(authSrc, /getUser\(/);
  });
});

describe("Phase 6D-D attendance route gates", () => {
  const requiredRoutes = [
    "src/app/admin/attendance/layout.tsx",
    "src/app/admin/attendance/page.tsx",
    "src/app/admin/attendance/loading.tsx",
    "src/app/admin/attendance/error.tsx",
    "src/app/admin/attendance/team/page.tsx",
    "src/app/admin/attendance/team/loading.tsx",
    "src/app/admin/attendance/team/error.tsx",
    "src/app/admin/attendance/calendar/page.tsx",
    "src/app/admin/attendance/calendar/loading.tsx",
    "src/app/admin/attendance/calendar/error.tsx",
    "src/app/admin/attendance/corrections/page.tsx",
    "src/app/admin/attendance/corrections/loading.tsx",
    "src/app/admin/attendance/corrections/error.tsx",
  ];

  for (const route of requiredRoutes) {
    test(`route file exists: ${route}`, () => {
      assert.ok(fileExists(route));
    });
  }

  test("attendance routes are force-dynamic", () => {
    for (const route of [
      "src/app/admin/attendance/layout.tsx",
      "src/app/admin/attendance/page.tsx",
      "src/app/admin/attendance/team/page.tsx",
      "src/app/admin/attendance/calendar/page.tsx",
      "src/app/admin/attendance/corrections/page.tsx",
    ]) {
      const src = readFileSync(join(root, route), "utf8");
      assert.match(src, /force-dynamic/);
    }
  });

  test("attendance layout gates unauthenticated inactive and denied access", () => {
    const layoutSrc = readFileSync(
      join(root, "src/app/admin/attendance/layout.tsx"),
      "utf8"
    );
    assert.match(layoutSrc, /resolveAttendanceAccess/);
    assert.match(layoutSrc, /redirect\("\/auth\/login/);
    assert.match(layoutSrc, /redirect\("\/auth\/forbidden"\)/);
    assert.match(layoutSrc, /AttendanceAccessDenied/);
    assert.match(layoutSrc, /showTeam=\{context\.canReadTeamAttendance/);
  });

  test("today page requires self attendance access", () => {
    const pageSrc = readFileSync(join(root, "src/app/admin/attendance/page.tsx"), "utf8");
    assert.match(pageSrc, /requireAttendanceSelfAccess/);
    assert.match(pageSrc, /AttendanceTodayPanel/);
  });

  test("team page requires team read access", () => {
    const pageSrc = readFileSync(join(root, "src/app/admin/attendance/team/page.tsx"), "utf8");
    assert.match(pageSrc, /requireAttendanceTeamRead/);
  });

  test("corrections page requires correction access", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/attendance/corrections/page.tsx"),
      "utf8"
    );
    assert.match(pageSrc, /requireAttendanceCorrectionAccess/);
  });

  test("admin layout gates attendance nav link by permission probe", () => {
    const layoutSrc = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
    assert.match(layoutSrc, /hasAnyAttendanceNavPermission/);
    assert.match(layoutSrc, /\/admin\/attendance/);
  });
});

describe("Phase 6D-D mobile today card states", () => {
  test("absent default when no attendance day row exists", () => {
    const today = mapAttendanceDayRowToToday(null, "2026-08-09");
    assert.equal(today.primaryStatus, "absent");
    assert.equal(today.openSession, false);
    assert.equal(today.workedMinutesSoFar, 0);
  });

  test("open session maps check-out oriented state", () => {
    const today = mapAttendanceDayRowToToday(sampleDayRow, "2026-08-09");
    assert.equal(today.openSession, true);
    assert.equal(today.primaryStatus, "present");
    assert.equal(today.isLate, true);
    assert.equal(today.firstCheckInAt, sampleDayRow.first_check_in_at);
  });

  test("closed session maps worked minutes and flags", () => {
    const today = mapAttendanceDayRowToToday(
      {
        ...sampleDayRow,
        open_session: false,
        last_check_out_at: "2026-08-09T12:30:00.000Z",
        worked_minutes: 480,
        is_missing_checkout: true,
        has_manual_adjustment: true,
      },
      "2026-08-09"
    );
    assert.equal(today.openSession, false);
    assert.equal(today.workedMinutesSoFar, 480);
    assert.equal(today.isMissingCheckout, true);
    assert.equal(today.hasManualAdjustment, true);
  });

  test("today card branches on openSession for mobile actions", () => {
    const cardSrc = readFileSync(
      join(root, "src/features/staff-attendance/components/AttendanceTodayCard.tsx"),
      "utf8"
    );
    assert.match(cardSrc, /today\.openSession \? checkOutAction : checkInAction/);
    assert.match(cardSrc, /Open session/);
    assert.match(cardSrc, /No open session/);
    assert.match(cardSrc, /grid-cols-2/);
  });

  test("today panel wires server form actions with idempotency key", () => {
    const panelSrc = readFileSync(
      join(root, "src/features/staff-attendance/components/AttendanceTodayPanel.tsx"),
      "utf8"
    );
    assert.match(panelSrc, /checkInAction/);
    assert.match(panelSrc, /checkOutAction/);
    assert.match(panelSrc, /idempotencyKey/);
    assert.match(panelSrc, /min-h-11/);
    assert.match(panelSrc, /role=\{state\.success \? "status" : "alert"\}/);
    assert.doesNotMatch(panelSrc, /supabase/i);
  });
});

describe("Phase 6D-D loading empty error unauthorized patterns", () => {
  test("loading route renders attendance skeleton", () => {
    const loadingSrc = readFileSync(
      join(root, "src/app/admin/attendance/loading.tsx"),
      "utf8"
    );
    const skeletonSrc = readFileSync(
      join(
        root,
        "src/features/staff-attendance/components/states/AttendanceLoadingSkeleton.tsx"
      ),
      "utf8"
    );
    assert.match(loadingSrc, /AttendanceLoadingSkeleton/);
    assert.match(skeletonSrc, /aria-hidden="true"/);
    assert.match(skeletonSrc, /animate-pulse/);
  });

  test("team table renders empty state when no direct reports", () => {
    const tableSrc = readFileSync(
      join(root, "src/features/staff-attendance/components/AttendanceTeamTable.tsx"),
      "utf8"
    );
    assert.match(tableSrc, /rows\.length === 0/);
    assert.match(tableSrc, /No direct reports/);
  });

  test("route error boundary is alert-safe and redacts digest only", () => {
    const errorSrc = readFileSync(join(root, "src/app/admin/attendance/error.tsx"), "utf8");
    assert.match(errorSrc, /role="alert"/);
    assert.match(errorSrc, /ATTENDANCE_ROUTE_ERROR/);
    assert.match(errorSrc, /digest/);
    assert.doesNotMatch(errorSrc, /error\.message/);
  });

  test("access denied state explains permission gap without mutation affordances", () => {
    const deniedSrc = readFileSync(
      join(
        root,
        "src/features/staff-attendance/components/states/AttendanceAccessDenied.tsx"
      ),
      "utf8"
    );
    assert.match(deniedSrc, /attendance-access-denied-heading/);
    assert.match(deniedSrc, /attendance self, team read, or policy manage/);
    assert.doesNotMatch(deniedSrc, /type="submit"/i);
  });

  test("attendance nav hides privileged routes without capability flags", () => {
    const navSrc = readFileSync(
      join(root, "src/features/staff-attendance/components/shell/AttendanceNav.tsx"),
      "utf8"
    );
    assert.match(navSrc, /showTeam/);
    assert.match(navSrc, /showCorrections/);
    assert.match(navSrc, /showPolicies/);
    assert.match(navSrc, /aria-label="Attendance workspace"/);
  });
});

describe("Phase 6D-D attendance UI regression guards", () => {
  test("today DTO shape matches panel prop contract", () => {
    const today: AttendanceToday = mapAttendanceDayRowToToday(sampleDayRow, "2026-08-09");
    assert.equal(typeof today.attendanceDate, "string");
    assert.equal(typeof today.openSession, "boolean");
    assert.equal(typeof today.workedMinutesSoFar, "number");
  });

  test("self attendance RPCs avoid service role and spoofed staff identifiers", () => {
    const actionsSrc = readFileSync(
      join(root, "src/features/staff-attendance/server/attendance-actions.ts"),
      "utf8"
    );
    const checkInBlock = actionsSrc.slice(
      actionsSrc.indexOf("export async function checkIn"),
      actionsSrc.indexOf("export async function checkOut")
    );
    const checkOutBlock = actionsSrc.slice(
      actionsSrc.indexOf("export async function checkOut"),
      actionsSrc.indexOf("export async function loadToday")
    );
    assert.match(actionsSrc, /createClient/);
    assert.match(checkInBlock, /check_in_attendance/);
    assert.match(checkOutBlock, /check_out_attendance/);
    assert.doesNotMatch(actionsSrc, /service_role/i);
    assert.doesNotMatch(checkInBlock, /p_staff_id/);
    assert.doesNotMatch(checkOutBlock, /p_staff_id/);
  });
});
