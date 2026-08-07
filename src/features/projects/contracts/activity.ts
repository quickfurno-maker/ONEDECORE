/**
 * Phase 8 migration-independent — project activity view contracts.
 */

export const PROJECT_ACTIVITY_KINDS = [
  "handover_state_changed",
  "pm_assigned",
  "pm_handover_accepted",
  "designer_assigned",
  "design_stage_changed",
  "execution_stage_changed",
  "hold_entered",
  "hold_resumed",
  "project_cancelled",
  "snag_recorded",
  "snag_resolved",
] as const;

export type ProjectActivityKind = (typeof PROJECT_ACTIVITY_KINDS)[number];

export interface ProjectActivityView {
  readonly activityId: string;
  readonly projectReference: string;
  readonly kind: ProjectActivityKind;
  readonly summary: string;
  readonly actorDisplayName: string | null;
  readonly occurredAt: string;
}
