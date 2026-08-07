/**
 * Pure PM assignment authority rules (ADR-0020 / ADR-0019).
 */

import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";
import {
  createProjectStageTransitionError,
  type ProjectStageTransitionError,
} from "../../contracts/transition.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";

export interface PmAssignmentRequest {
  readonly actorProfileId: string;
  readonly actorRole: CrmRoleCode;
  readonly targetPmProfileId: string;
  readonly staffing: ProjectStaffingSnapshot;
  readonly isReassignment: boolean;
}

export interface PmAssignmentValidationResult {
  readonly allowed: boolean;
  readonly error: ProjectStageTransitionError | null;
}

const PM_ASSIGNMENT_AUTHORITY_ROLES = new Set<CrmRoleCode>([
  "super_admin",
  "sales_manager",
]);

const PM_ASSIGNMENT_DENIED_ROLES = new Set<CrmRoleCode>([
  "sales_executive",
  "project_manager",
  "designer",
]);

export function canAuthorizePmAssignment(role: CrmRoleCode): boolean {
  return PM_ASSIGNMENT_AUTHORITY_ROLES.has(role);
}

export function isPmAssignmentDeniedRole(role: CrmRoleCode): boolean {
  return PM_ASSIGNMENT_DENIED_ROLES.has(role);
}

export function validatePmAssignmentRequest(
  request: PmAssignmentRequest
): PmAssignmentValidationResult {
  if (!request.targetPmProfileId.trim()) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Target project manager profile is required."
      ),
    };
  }

  if (isPmAssignmentDeniedRole(request.actorRole)) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Only Sales Manager or Super Admin may assign a primary project manager."
      ),
    };
  }

  if (!canAuthorizePmAssignment(request.actorRole)) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Actor is not authorized to assign a primary project manager."
      ),
    };
  }

  const hasPrimaryPm = request.staffing.primaryProjectManager !== null;

  if (hasPrimaryPm && !request.isReassignment) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_DUPLICATE_PRIMARY_PM",
        "Exactly one primary project manager is allowed. Use reassignment instead."
      ),
    };
  }

  if (
    request.isReassignment &&
    request.staffing.primaryProjectManager?.staffProfileId ===
      request.targetPmProfileId
  ) {
    return {
      allowed: true,
      error: null,
    };
  }

  return { allowed: true, error: null };
}

export interface PmReassignmentRequestValidationInput {
  readonly actorProfileId: string;
  readonly actorRole: CrmRoleCode;
  readonly staffing: ProjectStaffingSnapshot;
}

export function validatePmReassignmentRequest(
  input: PmReassignmentRequestValidationInput
): PmAssignmentValidationResult {
  if (input.actorRole !== "project_manager") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Only the assigned primary project manager may request reassignment."
      ),
    };
  }

  const primaryPm = input.staffing.primaryProjectManager;
  if (!primaryPm || primaryPm.staffProfileId !== input.actorProfileId) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Reassignment requests require the current assigned primary project manager."
      ),
    };
  }

  return { allowed: true, error: null };
}
