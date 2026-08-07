/**
 * Phase 8 migration-independent — project staffing assignment contracts.
 */

export const PROJECT_ASSIGNMENT_ROLES = [
  "primary_project_manager",
  "lead_designer",
  "supporting_designer",
] as const;

export type ProjectAssignmentRole = (typeof PROJECT_ASSIGNMENT_ROLES)[number];

export interface ProjectStaffAssignment {
  readonly staffProfileId: string;
  readonly displayName: string;
  readonly role: ProjectAssignmentRole;
  readonly assignedAt: string;
  readonly assignedByProfileId: string;
}

export interface ProjectStaffingSnapshot {
  readonly primaryProjectManager: ProjectStaffAssignment | null;
  readonly leadDesigner: ProjectStaffAssignment | null;
  readonly supportingDesigners: readonly ProjectStaffAssignment[];
}

export function countPrimaryProjectManagers(
  staffing: ProjectStaffingSnapshot
): number {
  return staffing.primaryProjectManager ? 1 : 0;
}

export function countLeadDesigners(staffing: ProjectStaffingSnapshot): number {
  return staffing.leadDesigner ? 1 : 0;
}
