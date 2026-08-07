/**
 * Phase 8 migration-independent — project permission capabilities (ADR-0019/0020).
 * Pure resolver only; formal RLS enforcement deferred.
 */

import type { CrmRoleCode } from "../../crm/contracts/permissions.ts";

export interface ProjectActorContext {
  readonly profileId: string;
  readonly role: CrmRoleCode;
  readonly isAssignedPrimaryPm: boolean;
  readonly isAssignedLeadDesigner: boolean;
  readonly isAssignedSupportingDesigner: boolean;
  readonly isOwningSalesExecutive: boolean;
}

export interface ProjectPermissionCapabilities {
  readonly canAssignProjectManager: boolean;
  readonly canReassignProjectManager: boolean;
  readonly canRequestPmReassignment: boolean;
  readonly canAcceptPmHandover: boolean;
  readonly canAssignDesigners: boolean;
  readonly canReassignDesigners: boolean;
  readonly canRequestDesignerAssignment: boolean;
  readonly canUpdateExecutionStages: boolean;
  readonly canReadHighLevelStatus: boolean;
  readonly canReadFullProjectWorkspace: boolean;
  readonly canUpdateDesignWorkflow: boolean;
  readonly canApproveProductionReady: boolean;
}

const PM_ASSIGNMENT_ROLES = new Set<CrmRoleCode>(["super_admin", "sales_manager"]);
const DESIGNER_ASSIGNMENT_ROLES = new Set<CrmRoleCode>(["super_admin", "sales_manager"]);

export function resolveProjectPermissionCapabilities(
  actor: ProjectActorContext
): ProjectPermissionCapabilities {
  const isPmAssignmentAuthority = PM_ASSIGNMENT_ROLES.has(actor.role);
  const isDesignerAssignmentAuthority = DESIGNER_ASSIGNMENT_ROLES.has(actor.role);
  const isProjectManager = actor.role === "project_manager";
  const isDesigner = actor.role === "designer";
  const isSalesExecutive = actor.role === "sales_executive";

  return {
    canAssignProjectManager: isPmAssignmentAuthority,
    canReassignProjectManager: isPmAssignmentAuthority,
    canRequestPmReassignment: isProjectManager && actor.isAssignedPrimaryPm,
    canAcceptPmHandover: isProjectManager && actor.isAssignedPrimaryPm,
    canAssignDesigners: isDesignerAssignmentAuthority,
    canReassignDesigners: isDesignerAssignmentAuthority,
    canRequestDesignerAssignment: isProjectManager && actor.isAssignedPrimaryPm,
    canUpdateExecutionStages: isProjectManager && actor.isAssignedPrimaryPm,
    canReadHighLevelStatus:
      actor.role === "super_admin" ||
      actor.role === "sales_manager" ||
      (isSalesExecutive && actor.isOwningSalesExecutive) ||
      (isProjectManager && actor.isAssignedPrimaryPm) ||
      (isDesigner &&
        (actor.isAssignedLeadDesigner || actor.isAssignedSupportingDesigner)),
    canReadFullProjectWorkspace:
      actor.role === "super_admin" ||
      actor.role === "sales_manager" ||
      (isProjectManager && actor.isAssignedPrimaryPm) ||
      (isDesigner &&
        (actor.isAssignedLeadDesigner || actor.isAssignedSupportingDesigner)),
    canUpdateDesignWorkflow:
      isDesigner &&
      (actor.isAssignedLeadDesigner || actor.isAssignedSupportingDesigner),
    canApproveProductionReady: isDesigner && actor.isAssignedLeadDesigner,
  };
}
