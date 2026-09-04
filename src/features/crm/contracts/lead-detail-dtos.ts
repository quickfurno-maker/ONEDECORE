import type { LeadStageCode } from "./lead-stages.ts";
import type { CrmManualSalesTemperature } from "./lead-sales-temperature.ts";
import type { CrmLeadTimelinePage } from "./lead-timeline-contracts.ts";

export interface CrmAssigneeDirectoryEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly roleCode: string;
}

export interface CrmLeadSourceOption {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
}

export interface CrmLeadDetailOverview {
  readonly submittedName: string;
  readonly submittedEmail: string | null;
  readonly serviceCode: string;
  readonly propertyCode: string;
  readonly timelineCode: string;
  readonly roomCodes: readonly string[];
  readonly budgetComfortCode: string | null;
  readonly locality: string | null;
  readonly message: string | null;
  readonly status: LeadStageCode;
  /**
   * The stored human sales judgement (hot/warm/cold), or NULL when nobody has
   * classified this lead and the system suggestion applies.
   */
  readonly manualSalesTemperature: CrmManualSalesTemperature | null;
  readonly entryMethod: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CrmLeadDetailContactChannel {
  readonly id: string;
  readonly channelType: string;
  readonly addressNormalized: string;
  readonly isPrimary: boolean;
  readonly status: string;
}

export interface CrmLeadDetailContact {
  readonly id: string;
  readonly status: string;
  readonly displayName: string;
  readonly channels: readonly CrmLeadDetailContactChannel[];
}

export interface CrmLeadDetailSourceTouchpoint {
  readonly id: string;
  readonly sourceLabel: string;
  readonly touchpointKind: string;
  readonly occurredAt: string;
  readonly sourceDetail: string | null;
  readonly campaignReference: string | null;
}

export interface CrmLeadDetailSourcePanel {
  readonly primarySourceLabel: string;
  readonly landingPath: string | null;
  readonly plannerVersion: string | null;
  readonly attributionSummary: string | null;
  readonly touchpoints: readonly CrmLeadDetailSourceTouchpoint[];
}

export interface CrmLeadDetailAssignmentEntry {
  readonly id: string;
  readonly previousAssigneeLabel: string | null;
  readonly newAssigneeLabel: string | null;
  readonly assignmentMethod: string;
  readonly actorLabel: string;
  readonly occurredAt: string;
  readonly reason: string | null;
}

export interface CrmLeadDetailAssignmentPanel {
  readonly currentAssigneeLabel: string;
  readonly currentAssigneeId: string | null;
  readonly history: readonly CrmLeadDetailAssignmentEntry[];
}

/**
 * CRM 2D-1: per-lead SLA clock facts. Read for the command header and the
 * score's engagement/risk signals. A clock row exists for every lead
 * independently of SLA policy activation, so `firstContactAttemptAt` is always
 * meaningful while `slaDueAt` stays null until an owner configures business
 * hours — the UI must never imply SLA coverage that is not configured.
 */
export interface CrmLeadDetailSlaClock {
  readonly slaDueAt: string | null;
  readonly firstContactAttemptAt: string | null;
  readonly breachedAt: string | null;
}

export interface CrmLeadDetailNote {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly authorLabel: string;
}

export interface CrmLeadClosureReasonOption {
  readonly code: string;
  readonly displayName: string;
}

export interface CrmLeadDetailFollowUp {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly dueAt: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly activityType: string;
  readonly title: string;
  readonly priority: string;
  readonly isPrimaryNextAction: boolean;
  readonly durationMinutes: number | null;
  readonly reminderAt: string | null;
  readonly outcomeCode: string | null;
  readonly completionNote: string | null;
  readonly quotationId: string | null;
  readonly source: string;
  readonly cadenceEnrollmentId: string | null;
  readonly cadenceStepId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CrmLeadDetailConsentSummaryItem {
  readonly id: string;
  readonly purposeCode: string;
  readonly channel: string;
  readonly eventType: string;
  readonly noticeVersion: string;
  readonly copyVersion: string;
  readonly occurredAt: string;
}

export interface CrmLeadDetailStatusSummary {
  readonly onHoldReason: string | null;
  readonly onHoldSince: string | null;
  readonly onHoldPreviousStatus: LeadStageCode | null;
  readonly resumeTargetStatus: LeadStageCode | null;
  readonly closedLostReasonLabel: string | null;
  readonly closedLostNote: string | null;
}

export interface CrmLeadDetail {
  readonly id: string;
  /**
   * Server capture instant for this read. Every time-dependent derivation on
   * the page (score, risk flags, due states) threads this single value, so the
   * surfaces can never disagree and the render stays pure.
   */
  readonly capturedAt: string;
  readonly overview: CrmLeadDetailOverview;
  readonly contact: CrmLeadDetailContact;
  readonly source: CrmLeadDetailSourcePanel;
  readonly assignment: CrmLeadDetailAssignmentPanel;
  /** CRM 2D-1 unified timeline — the chronological history surface. */
  readonly timeline: CrmLeadTimelinePage;
  readonly notes: readonly CrmLeadDetailNote[];
  readonly followUps: readonly CrmLeadDetailFollowUp[];
  readonly consentSummary: readonly CrmLeadDetailConsentSummaryItem[];
  readonly statusSummary: CrmLeadDetailStatusSummary;
  readonly slaClock: CrmLeadDetailSlaClock;
}
