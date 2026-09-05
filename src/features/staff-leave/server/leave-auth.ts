import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";

const LEAVE_PERMISSION_PROBE_CODES = [
  "leave.self",
  "leave.team.approve",
  "leave.manage",
  "holidays.manage",
] as const;

export type LeavePermissionCode = (typeof LEAVE_PERMISSION_PROBE_CODES)[number];

export type LeavePermissionMap = Readonly<Record<LeavePermissionCode, boolean>>;

export interface LeaveAccessContext {
  readonly userId: string;
  readonly email: string | null;
  readonly canSelfLeave: boolean;
  readonly canApproveTeamLeave: boolean;
  readonly canManageLeave: boolean;
  readonly canManageHolidays: boolean;
}

export type LeaveAccessResolution =
  | { readonly kind: "granted"; readonly context: LeaveAccessContext }
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

async function probePermission(code: LeavePermissionCode): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: code,
  });

  return !error && data === true;
}

export async function probeLeavePermissions(): Promise<LeavePermissionMap> {
  const entries = await Promise.all(
    LEAVE_PERMISSION_PROBE_CODES.map(async (code) => [code, await probePermission(code)] as const)
  );

  return Object.fromEntries(entries) as LeavePermissionMap;
}

export async function resolveLeaveAccess(): Promise<LeaveAccessResolution> {
  const staff = await getStaffClaims();
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId))) {
    return { kind: "inactive" };
  }

  const permissions = await probeLeavePermissions();
  const context: LeaveAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canSelfLeave: permissions["leave.self"],
    canApproveTeamLeave: permissions["leave.team.approve"],
    canManageLeave: permissions["leave.manage"],
    canManageHolidays: permissions["holidays.manage"],
  };

  if (
    !context.canSelfLeave &&
    !context.canApproveTeamLeave &&
    !context.canManageLeave &&
    !context.canManageHolidays
  ) {
    return { kind: "denied" };
  }

  return { kind: "granted", context };
}

export async function getLeaveAccessContext(): Promise<LeaveAccessContext | null> {
  const resolution = await resolveLeaveAccess();
  return resolution.kind === "granted" ? resolution.context : null;
}

function redirectLeaveAuthFailure(
  resolution: Exclude<LeaveAccessResolution, { kind: "granted" }>,
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

export async function requireLeaveSelfAccess(
  currentPath: string = "/admin/leave"
): Promise<LeaveAccessContext> {
  const resolution = await resolveLeaveAccess();

  if (resolution.kind !== "granted") {
    redirectLeaveAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canSelfLeave) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireLeaveTeamApproveAccess(
  currentPath: string = "/admin/leave/team"
): Promise<LeaveAccessContext> {
  const resolution = await resolveLeaveAccess();

  if (resolution.kind !== "granted") {
    redirectLeaveAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canApproveTeamLeave && !resolution.context.canManageLeave) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireLeaveManageAccess(
  currentPath: string = "/admin/leave/types"
): Promise<LeaveAccessContext> {
  const resolution = await resolveLeaveAccess();

  if (resolution.kind !== "granted") {
    redirectLeaveAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canManageLeave) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireHolidayManageAccess(
  currentPath: string = "/admin/holidays"
): Promise<LeaveAccessContext> {
  const resolution = await resolveLeaveAccess();

  if (resolution.kind !== "granted") {
    redirectLeaveAuthFailure(resolution, currentPath);
  }

  if (!resolution.context.canManageHolidays) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function hasAnyLeaveNavPermission(): Promise<boolean> {
  const resolution = await resolveLeaveAccess();
  return resolution.kind === "granted";
}
