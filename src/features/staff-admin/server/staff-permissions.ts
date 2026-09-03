import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffPermissionCode } from "../contracts/permissions.ts";

export type StaffPermissionProbeResult = Readonly<
  Record<StaffPermissionCode, boolean>
>;

const STAFF_PERMISSION_PROBE_CODES = [
  "staff.manage",
  "staff.read",
  "attendance.self",
  "attendance.team.read",
  "attendance.read.all",
  "attendance.correct.all",
  "attendance.correct.team",
  "leave.self",
  "leave.team.approve",
  "leave.manage",
  "holidays.manage",
  "attendance.policies.manage",
  "staff.credentials.manage",
] as const satisfies readonly StaffPermissionCode[];

/**
 * Probes Phase 6D staff-related permissions for the authenticated session.
 */
export async function probeStaffPermissions(): Promise<StaffPermissionProbeResult> {
  const supabase = await createClient();
  const entries = await Promise.all(
    STAFF_PERMISSION_PROBE_CODES.map(async (code) => {
      const { data, error } = await supabase.rpc("authorize", {
        requested_permission: code,
      });

      return [code, !error && data === true] as const;
    })
  );

  return Object.fromEntries(entries) as StaffPermissionProbeResult;
}

export async function probeCanManageStaff(): Promise<boolean> {
  const permissions = await probeStaffPermissions();
  return permissions["staff.manage"];
}

/**
 * Super-Admin-only credential administration.
 *
 * Probed separately from `staff.manage` so a future grant of staff.manage to
 * another role cannot silently hand out credential control as well.
 */
export async function probeCanManageStaffCredentials(): Promise<boolean> {
  const permissions = await probeStaffPermissions();
  return permissions["staff.credentials.manage"];
}

export async function probeCanReadStaff(): Promise<boolean> {
  const permissions = await probeStaffPermissions();
  return permissions["staff.read"];
}

export async function hasAnyStaffReadPermission(): Promise<boolean> {
  return probeCanReadStaff();
}

export async function hasAnyStaffManagePermission(): Promise<boolean> {
  return probeCanManageStaff();
}

export async function hasAnyStaffNavPermission(): Promise<boolean> {
  const permissions = await probeStaffPermissions();
  return permissions["staff.read"] || permissions["staff.manage"];
}
