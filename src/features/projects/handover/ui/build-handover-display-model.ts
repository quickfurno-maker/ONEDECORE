/**
 * Maps handover domain state to UI display model.
 */

import type { ProjectCommercialSnapshotView } from "../../contracts/commercial.ts";
import type { ProjectHandoverState } from "../../contracts/lifecycle.ts";
import type { ProjectPermissionCapabilities } from "../../contracts/permissions.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { ProjectSummary } from "../../contracts/summary.ts";
import { isHandoverExecutionEligible } from "../../contracts/lifecycle.ts";
import { resolveProjectPermissionCapabilities } from "../../contracts/permissions.ts";
import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";

export interface HandoverDisplayModel {
  readonly summary: ProjectSummary;
  readonly handoverState: ProjectHandoverState;
  readonly handoverStateLabel: string;
  readonly statusBanner: string | null;
  readonly isExecutionEligible: boolean;
  readonly commercial: ProjectCommercialSnapshotView;
  readonly staffing: ProjectStaffingSnapshot;
  readonly capabilities: ProjectPermissionCapabilities;
  readonly primaryPmDisplayName: string | null;
  readonly canShowAssignPm: boolean;
  readonly canShowReassignPm: boolean;
  readonly canShowAcceptHandover: boolean;
  readonly canShowRequestReassignment: boolean;
}

export function buildHandoverDisplayModel(args: {
  summary: ProjectSummary;
  handoverState: ProjectHandoverState;
  commercial: ProjectCommercialSnapshotView;
  staffing: ProjectStaffingSnapshot;
  actor: {
    profileId: string;
    role: CrmRoleCode;
    isOwningSalesExecutive: boolean;
  };
}): HandoverDisplayModel {
  const isAssignedPrimaryPm =
    args.staffing.primaryProjectManager?.staffProfileId === args.actor.profileId;

  const capabilities = resolveProjectPermissionCapabilities({
    profileId: args.actor.profileId,
    role: args.actor.role,
    isAssignedPrimaryPm,
    isAssignedLeadDesigner: false,
    isAssignedSupportingDesigner: false,
    isOwningSalesExecutive: args.actor.isOwningSalesExecutive,
  });

  const handoverStateLabel = handoverStateToLabel(args.handoverState);
  const statusBanner = lifecycleBanner(args.handoverState);

  const hasPrimaryPm = args.staffing.primaryProjectManager !== null;

  return {
    summary: args.summary,
    handoverState: args.handoverState,
    handoverStateLabel,
    statusBanner,
    isExecutionEligible: isHandoverExecutionEligible(args.handoverState),
    commercial: args.commercial,
    staffing: args.staffing,
    capabilities,
    primaryPmDisplayName: args.staffing.primaryProjectManager?.displayName ?? null,
    canShowAssignPm:
      capabilities.canAssignProjectManager &&
      args.handoverState === "awaiting_project_manager_assignment",
    canShowReassignPm:
      capabilities.canReassignProjectManager &&
      hasPrimaryPm &&
      args.handoverState !== "handover_accepted",
    canShowAcceptHandover:
      capabilities.canAcceptPmHandover &&
      args.handoverState === "awaiting_project_manager_acceptance",
    canShowRequestReassignment:
      capabilities.canRequestPmReassignment &&
      hasPrimaryPm &&
      args.handoverState !== "handover_accepted",
  };
}

function handoverStateToLabel(state: ProjectHandoverState): string {
  switch (state) {
    case "awaiting_project_manager_assignment":
      return "Awaiting Project Manager Assignment";
    case "awaiting_project_manager_acceptance":
      return "Awaiting Project Manager Acceptance";
    case "handover_accepted":
      return "Handover Accepted";
    default:
      return state;
  }
}

function lifecycleBanner(state: ProjectHandoverState): string | null {
  switch (state) {
    case "awaiting_project_manager_assignment":
      return "Assign a primary project manager to begin handover.";
    case "awaiting_project_manager_acceptance":
      return "Assigned PM must review commercial summary and accept handover.";
    case "handover_accepted":
      return "Handover accepted — execution stages may become active.";
    default:
      return null;
  }
}
