import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";

const ATTENDANCE_PERMISSION_PROBE_CODES = [
  "attendance.self",
  "attendance.team.read",
  "attendance.read.all",
  "attendance.correct.all",
  "attendance.correct.team",
  "attendance.policies.manage",
  "attendance.approve",
] as const;

export type AttendancePermissionCode = (typeof ATTENDANCE_PERMISSION_PROBE_CODES)[number];

export type AttendancePermissionMap = Readonly<Record<AttendancePermissionCode, boolean>>;

export interface AttendanceAccessContext {
  readonly userId: string;
  readonly email: string | null;
  readonly canSelfAttendance: boolean;
  readonly canReadTeamAttendance: boolean;
  readonly canReadAllAttendance: boolean;
  readonly canCorrectAllAttendance: boolean;
  readonly canCorrectTeamAttendance: boolean;
  readonly canManagePolicies: boolean;
  /** Workforce V1 final-attendance approval authority. Super Admin only. */
  readonly canApproveAttendance: boolean;
}

export type AttendanceAccessResolution =
  | { readonly kind: "granted"; readonly context: AttendanceAccessContext }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "denied" };

async function isActiveStaff(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  return profile?.status === "active";
}

async function probePermission(code: AttendancePermissionCode): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: code,
  });

  return !error && data === true;
}

export async function probeAttendancePermissions(): Promise<AttendancePermissionMap> {
  const entries = await Promise.all(
    ATTENDANCE_PERMISSION_PROBE_CODES.map(async (code) => [code, await probePermission(code)] as const)
  );

  return Object.fromEntries(entries) as AttendancePermissionMap;
}

export async function resolveAttendanceAccess(): Promise<AttendanceAccessResolution> {
  const staff = await getStaffClaims();
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId))) {
    return { kind: "inactive" };
  }

  const permissions = await probeAttendancePermissions();
  const context: AttendanceAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canSelfAttendance: permissions["attendance.self"],
    canReadTeamAttendance: permissions["attendance.team.read"],
    canReadAllAttendance: permissions["attendance.read.all"],
    canCorrectAllAttendance: permissions["attendance.correct.all"],
    canCorrectTeamAttendance: permissions["attendance.correct.team"],
    canManagePolicies: permissions["attendance.policies.manage"],
    canApproveAttendance: permissions["attendance.approve"],
  };

  if (
    !context.canSelfAttendance &&
    !context.canReadTeamAttendance &&
    !context.canReadAllAttendance &&
    !context.canManagePolicies &&
    !context.canApproveAttendance
  ) {
    return { kind: "denied" };
  }

  return { kind: "granted", context };
}

export async function getAttendanceAccessContext(): Promise<AttendanceAccessContext | null> {
  const resolution = await resolveAttendanceAccess();
  return resolution.kind === "granted" ? resolution.context : null;
}

function redirectAttendanceAuthFailure(
  resolution: Exclude<AttendanceAccessResolution, { kind: "granted" }>,
  currentPath: string
): never {
  if (resolution.kind === "unauthenticated") {
    const safeNext = getSafeAdminRedirect(currentPath);
    // The Super Admin portal: this guard only ever protects /admin.
    const loginUrl = loginPortalHref(DEFAULT_LOGIN_PORTAL, safeNext);
    redirect(loginUrl);
  }

  redirect("/auth/forbidden");
}

export async function requireAttendanceSelfAccess(
  currentPath: string = "/admin/attendance"
): Promise<AttendanceAccessContext> {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind !== "granted") {
    redirectAttendanceAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canSelfAttendance) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireAttendanceTeamRead(
  currentPath: string = "/admin/attendance/team"
): Promise<AttendanceAccessContext> {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind !== "granted") {
    redirectAttendanceAuthFailure(resolution, currentPath);
  }

  if (
    !resolution.context.canReadTeamAttendance &&
    !resolution.context.canReadAllAttendance
  ) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireAttendancePolicyManageAccess(
  currentPath: string = "/admin/attendance-policies"
): Promise<AttendanceAccessContext> {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind !== "granted") {
    redirectAttendanceAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canManagePolicies) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireAttendanceCorrectionAccess(
  currentPath: string = "/admin/attendance/corrections"
): Promise<AttendanceAccessContext> {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind !== "granted") {
    redirectAttendanceAuthFailure(resolution, currentPath);
  }

  if (
    !resolution.context.canCorrectAllAttendance &&
    !resolution.context.canCorrectTeamAttendance
  ) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireAttendanceCalendarAccess(
  currentPath: string = "/admin/attendance/calendar"
): Promise<AttendanceAccessContext> {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind !== "granted") {
    redirectAttendanceAuthFailure(resolution, currentPath);
  }

  if (
    !resolution.context.canSelfAttendance &&
    !resolution.context.canReadTeamAttendance &&
    !resolution.context.canReadAllAttendance
  ) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function hasAnyAttendanceNavPermission(): Promise<boolean> {
  const resolution = await resolveAttendanceAccess();
  return resolution.kind === "granted";
}
