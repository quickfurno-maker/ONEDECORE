import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";

export interface ProjectPermissionProbeResult {
  readonly canReadProjects: boolean;
  /**
   * Sales-status visibility: project identity, client, stage, PM and dates.
   *
   * Its own permission rather than a narrowed reading of `projects.read`,
   * because `projects.read` is what carries the project workspace with it. A
   * Sales Manager holds THIS and not that, and the difference has to survive
   * the next feature that wants "read access to projects".
   */
  readonly canReadProjectsHighLevel: boolean;
  readonly canAssignPm: boolean;
  readonly canAcceptHandover: boolean;
  readonly canReadDesign: boolean;
  readonly canStaffDesigners: boolean;
  readonly canReadExecution: boolean;
  readonly canCancelExecution: boolean;
  readonly isSuperAdmin: boolean;
  readonly isSalesManager: boolean;
  readonly isSalesExecutive: boolean;
  readonly isProjectManager: boolean;
  readonly isDesigner: boolean;
}

export async function probeProjectPermissions(): Promise<ProjectPermissionProbeResult> {
  const supabase = await createClient();
  const [
    readRes,
    highLevelRes,
    assignRes,
    acceptRes,
    designRead,
    designStaff,
    executionRead,
    executionCancel,
    sa,
    sm,
    se,
    pm,
    designer,
  ] =
    await Promise.all([
      supabase.rpc("authorize", { requested_permission: "projects.read" }),
      supabase.rpc("authorize", { requested_permission: "projects.read_high_level" }),
      supabase.rpc("authorize", { requested_permission: "projects.assign_pm" }),
      supabase.rpc("authorize", { requested_permission: "projects.accept_handover" }),
      supabase.rpc("authorize", { requested_permission: "project_design.read" }),
      supabase.rpc("authorize", { requested_permission: "project_design.staff" }),
      supabase.rpc("authorize", { requested_permission: "project_execution.read" }),
      supabase.rpc("authorize", { requested_permission: "project_execution.cancel" }),
      supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
      supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
      supabase.rpc("has_active_role", { p_role_code: "sales_executive" }),
      supabase.rpc("has_active_role", { p_role_code: "project_manager" }),
      supabase.rpc("has_active_role", { p_role_code: "designer" }),
    ]);

  return {
    canReadProjects: !readRes.error && readRes.data === true,
    canReadProjectsHighLevel: !highLevelRes.error && highLevelRes.data === true,
    canAssignPm: !assignRes.error && assignRes.data === true,
    canAcceptHandover: !acceptRes.error && acceptRes.data === true,
    canReadDesign: !designRead.error && designRead.data === true,
    canStaffDesigners: !designStaff.error && designStaff.data === true,
    canReadExecution: !executionRead.error && executionRead.data === true,
    canCancelExecution: !executionCancel.error && executionCancel.data === true,
    isSuperAdmin: !sa.error && sa.data === true,
    isSalesManager: !sm.error && sm.data === true,
    isSalesExecutive: !se.error && se.data === true,
    isProjectManager: !pm.error && pm.data === true,
    isDesigner: !designer.error && designer.data === true,
  };
}

export async function hasAnyProjectReadPermission(): Promise<boolean> {
  const permissions = await probeProjectPermissions();
  // High-level status counts: a Sales Manager holding only that still needs the
  // Projects entry in the workspace, and the page itself decides what to show.
  return (
    permissions.canReadProjects ||
    permissions.canReadProjectsHighLevel ||
    permissions.canReadDesign
  );
}

export function resolveCrmRoleFromProjectProbe(
  probe: ProjectPermissionProbeResult
): CrmRoleCode | null {
  if (probe.isSuperAdmin) return "super_admin";
  if (probe.isSalesManager) return "sales_manager";
  if (probe.isProjectManager) return "project_manager";
  if (probe.isSalesExecutive) return "sales_executive";
  if (probe.isDesigner) return "designer";
  return null;
}
