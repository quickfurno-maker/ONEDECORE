import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";
import { authorizeMany } from "@/server/auth/authorize-many";

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
  /*
   * Two round trips, not 13.
   *
   * `authorize_many` loops over `public.authorize`, so the access rules are
   * unchanged; only the number of times this page asks them has. The role
   * checks stay individual — `has_active_role` is about a thirtieth of the
   * managed authorization traffic, and a second batch endpoint for it would
   * be machinery bought for very little — but they no longer wait for the
   * permissions, because neither read depends on the other.
   */
  const [answers, [
    sa,
    sm,
    se,
    pm,
    designer,
  ]] = await Promise.all([
    authorizeMany(
      [
        "projects.read",
        "projects.read_high_level",
        "projects.assign_pm",
        "projects.accept_handover",
        "project_design.read",
        "project_design.staff",
        "project_execution.read",
        "project_execution.cancel",
      ] as const,
      supabase
    ),
    Promise.all([
      supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
      supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
      supabase.rpc("has_active_role", { p_role_code: "sales_executive" }),
      supabase.rpc("has_active_role", { p_role_code: "project_manager" }),
      supabase.rpc("has_active_role", { p_role_code: "designer" }),
    ]),
  ]);
  return {
    canReadProjects: answers["projects.read"],
    canReadProjectsHighLevel: answers["projects.read_high_level"],
    canAssignPm: answers["projects.assign_pm"],
    canAcceptHandover: answers["projects.accept_handover"],
    canReadDesign: answers["project_design.read"],
    canStaffDesigners: answers["project_design.staff"],
    canReadExecution: answers["project_execution.read"],
    canCancelExecution: answers["project_execution.cancel"],
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
