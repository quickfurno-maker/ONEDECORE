import type { LeadStageCode } from "./lead-stages.ts";

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

export interface CrmLeadDetailTimelineEntry {
  readonly id: string;
  readonly kind: "activity" | "event";
  readonly title: string;
  readonly occurredAt: string;
  readonly actorLabel: string | null;
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
  readonly overview: CrmLeadDetailOverview;
  readonly contact: CrmLeadDetailContact;
  readonly source: CrmLeadDetailSourcePanel;
  readonly assignment: CrmLeadDetailAssignmentPanel;
  readonly timeline: readonly CrmLeadDetailTimelineEntry[];
  readonly notes: readonly CrmLeadDetailNote[];
  readonly followUps: readonly CrmLeadDetailFollowUp[];
  readonly consentSummary: readonly CrmLeadDetailConsentSummaryItem[];
  readonly statusSummary: CrmLeadDetailStatusSummary;
}
