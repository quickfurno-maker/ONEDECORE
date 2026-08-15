import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";

export interface ProjectPermissionProbeResult {
  readonly canReadProjects: boolean;
  readonly canAssignPm: boolean;
  readonly canAcceptHandover: boolean;
  readonly isSuperAdmin: boolean;
  readonly isSalesManager: boolean;
  readonly isSalesExecutive: boolean;
  readonly isProjectManager: boolean;
  readonly isDesigner: boolean;
}

export async function probeProjectPermissions(): Promise<ProjectPermissionProbeResult> {
  const supabase = await createClient();
  const [readRes, assignRes, acceptRes, sa, sm, se, pm, designer] = await Promise.all([
    supabase.rpc("authorize", { requested_permission: "projects.read" }),
    supabase.rpc("authorize", { requested_permission: "projects.assign_pm" }),
    supabase.rpc("authorize", { requested_permission: "projects.accept_handover" }),
    supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
    supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
    supabase.rpc("has_active_role", { p_role_code: "sales_executive" }),
    supabase.rpc("has_active_role", { p_role_code: "project_manager" }),
    supabase.rpc("has_active_role", { p_role_code: "designer" }),
  ]);

  return {
    canReadProjects: !readRes.error && readRes.data === true,
    canAssignPm: !assignRes.error && assignRes.data === true,
    canAcceptHandover: !acceptRes.error && acceptRes.data === true,
    isSuperAdmin: !sa.error && sa.data === true,
    isSalesManager: !sm.error && sm.data === true,
    isSalesExecutive: !se.error && se.data === true,
    isProjectManager: !pm.error && pm.data === true,
    isDesigner: !designer.error && designer.data === true,
  };
}

export async function hasAnyProjectReadPermission(): Promise<boolean> {
  const permissions = await probeProjectPermissions();
  return permissions.canReadProjects;
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
