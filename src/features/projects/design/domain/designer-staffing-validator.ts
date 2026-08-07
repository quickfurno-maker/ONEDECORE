/**
 * Phase 8B — designer staffing invariants (ADR-0020 / ADR-0019).
 */

import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";
import {
  countLeadDesigners,
  type ProjectStaffAssignment,
  type ProjectStaffingSnapshot,
} from "../../contracts/assignment.ts";
import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";

const DESIGNER_ASSIGNMENT_AUTHORITY = new Set<CrmRoleCode>([
  "super_admin",
  "sales_manager",
]);

export type DesignerStaffingAction =
  | "assign_lead"
  | "assign_supporting"
  | "reassign_lead"
  | "remove_lead"
  | "remove_supporting";

export interface DesignerStaffingValidationResult {
  readonly ok: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export interface DesignerAssignmentChange {
  readonly action: DesignerStaffingAction;
  readonly actorRole: CrmRoleCode;
  readonly actorProfileId: string;
  readonly targetProfileId: string;
  readonly currentStaffing: ProjectStaffingSnapshot;
}

function duplicateProfileError(message: string): DesignerStaffingValidationResult {
  return {
    ok: false,
    error: createProjectStageTransitionError("PROJECT_INVALID_TRANSITION", message),
  };
}

function unauthorizedError(): DesignerStaffingValidationResult {
  return {
    ok: false,
    error: createProjectStageTransitionError(
      "PROJECT_UNAUTHORIZED",
      "Only Sales Manager or Super Admin may assign or reassign designers."
    ),
  };
}

function collectAssignedProfileIds(
  staffing: ProjectStaffingSnapshot
): Set<string> {
  const ids = new Set<string>();
  if (staffing.leadDesigner) {
    ids.add(staffing.leadDesigner.staffProfileId);
  }
  for (const designer of staffing.supportingDesigners) {
    ids.add(designer.staffProfileId);
  }
  return ids;
}

export function validateDesignerStaffingSnapshot(
  staffing: ProjectStaffingSnapshot
): DesignerStaffingValidationResult {
  if (countLeadDesigners(staffing) > 1) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_DUPLICATE_LEAD_DESIGNER",
        "Exactly one lead designer is permitted per project."
      ),
    };
  }

  const leadId = staffing.leadDesigner?.staffProfileId;
  if (leadId) {
    const duplicateLeadInSupporting = staffing.supportingDesigners.some(
      (designer) => designer.staffProfileId === leadId
    );
    if (duplicateLeadInSupporting) {
      return duplicateProfileError(
        "Lead designer cannot also appear as a supporting designer."
      );
    }
  }

  const supportingIds = staffing.supportingDesigners.map(
    (designer) => designer.staffProfileId
  );
  const uniqueSupporting = new Set(supportingIds);
  if (uniqueSupporting.size !== supportingIds.length) {
    return duplicateProfileError(
      "Supporting designer assignments must be unique."
    );
  }

  return { ok: true, error: null };
}

export function validateDesignerAssignmentAuthority(
  actorRole: CrmRoleCode
): DesignerStaffingValidationResult {
  if (!DESIGNER_ASSIGNMENT_AUTHORITY.has(actorRole)) {
    return unauthorizedError();
  }
  return { ok: true, error: null };
}

export function validateDesignerAssignmentChange(
  change: DesignerAssignmentChange
): DesignerStaffingValidationResult {
  const authority = validateDesignerAssignmentAuthority(change.actorRole);
  if (!authority.ok) {
    return authority;
  }

  if (change.actorRole === "designer") {
    return unauthorizedError();
  }

  if (change.actorRole === "project_manager") {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Project managers may request designer assignment but cannot execute it."
      ),
    };
  }

  const assignedIds = collectAssignedProfileIds(change.currentStaffing);

  if (change.action === "assign_lead" || change.action === "reassign_lead") {
    if (
      change.action === "assign_lead" &&
      change.currentStaffing.leadDesigner !== null
    ) {
      return {
        ok: false,
        error: createProjectStageTransitionError(
          "PROJECT_DUPLICATE_LEAD_DESIGNER",
          "A lead designer is already assigned. Use reassignment instead."
        ),
      };
    }
    if (assignedIds.has(change.targetProfileId)) {
      return duplicateProfileError(
        "Target designer is already assigned to this project."
      );
    }
  }

  if (change.action === "assign_supporting") {
    if (assignedIds.has(change.targetProfileId)) {
      return duplicateProfileError(
        "Target designer is already assigned to this project."
      );
    }
  }

  if (change.action === "remove_lead" && !change.currentStaffing.leadDesigner) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "No lead designer is assigned to remove."
      ),
    };
  }

  if (
    change.action === "remove_supporting" &&
    !change.currentStaffing.supportingDesigners.some(
      (designer) => designer.staffProfileId === change.targetProfileId
    )
  ) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Target supporting designer is not assigned."
      ),
    };
  }

  return { ok: true, error: null };
}

export function applyDesignerAssignmentChange(
  change: DesignerAssignmentChange,
  assignment: Omit<ProjectStaffAssignment, "role">
): ProjectStaffingSnapshot | DesignerStaffingValidationResult {
  const validation = validateDesignerAssignmentChange(change);
  if (!validation.ok) {
    return validation;
  }

  const base = change.currentStaffing;

  switch (change.action) {
    case "assign_lead":
    case "reassign_lead":
      return {
        ...base,
        leadDesigner: { ...assignment, role: "lead_designer" },
      };
    case "assign_supporting":
      return {
        ...base,
        supportingDesigners: [
          ...base.supportingDesigners,
          { ...assignment, role: "supporting_designer" },
        ],
      };
    case "remove_lead":
      return { ...base, leadDesigner: null };
    case "remove_supporting":
      return {
        ...base,
        supportingDesigners: base.supportingDesigners.filter(
          (designer) => designer.staffProfileId !== change.targetProfileId
        ),
      };
    default: {
      const _exhaustive: never = change.action;
      return _exhaustive;
    }
  }
}
