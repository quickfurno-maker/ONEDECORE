import type {
  CrmLeadRiskFlag,
  CrmLeadScoreBand,
} from "./lead-score-contracts.ts";
import type {
  CrmLeadQuotationState,
  CrmSiteVisitState,
} from "./lead-milestones.ts";
import type { CrmLeadSalesBucket } from "./lead-sales-bucket.ts";
import type { LeadStageCode } from "./lead-stages.ts";

/**
 * Minimal list-row shape selected by the CRM lead repository.
 * Intentionally narrower than `public.leads` to avoid over-fetching.
 */
export interface CrmLeadListRow {
  readonly id: string;
  readonly status: string;
  readonly submitted_name: string;
  readonly service_code: string;
  readonly locality: string | null;
  readonly assigned_to: string | null;
  readonly entry_method: string;
  readonly primary_source_id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly lead_sources: {
    readonly display_name: string;
  } | null;
}

/** Scoped CRM list DTO — no intake blobs, contact linkage, or audit internals. */
export interface CrmLeadListItem {
  readonly id: string;
  readonly status: LeadStageCode;
  readonly submittedName: string;
  readonly serviceCode: string;
  readonly locality: string | null;
  readonly entryMethod: string;
  readonly primarySourceLabel: string;
  readonly assignedTo: string | null;
  readonly assigneeLabel: string;
  readonly assignmentState: "assigned" | "unassigned";
  /**
   * The CANONICAL primary next action — `is_primary_next_action = true` and
   * still open.
   *
   * This replaces a generic "next open follow-up". That field selected ANY open
   * follow-up, and the ordering fed it into the urgency ladder as if it were the
   * primary action, so a lead with no primary action but some unrelated open
   * activity dodged the `no_next_action` rank and outranked leads that genuinely
   * had nothing scheduled.
   */
  readonly primaryNextActionDueAt: string | null;
  readonly primaryNextActionTitle: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * Owner-facing sales bucket, derived from (status, score band) by the ONE
   * canonical resolver. Never stored, never manually set, and never a
   * replacement for `status` — both are rendered.
   */
  readonly salesBucket: CrmLeadSalesBucket;
  readonly priorityScore: number;
  /** The internal band, kept distinct so NURTURE stays visible behind COLD. */
  readonly scoreBand: CrmLeadScoreBand;
  readonly riskFlags: readonly CrmLeadRiskFlag[];
  /** Canonical stage-entry instant; falls back to `createdAt` when no event exists. */
  readonly stageEnteredAt: string;
  readonly slaBreached: boolean;
  readonly newUncontacted: boolean;
  /**
   * Milestone facts, shown SEPARATELY from the bucket and the stage. They may
   * feed the canonical score, but they are never the bucket: a HOT and a LOST
   * lead can carry exactly the same two milestones.
   */
  readonly siteVisitState: CrmSiteVisitState;
  readonly quotationState: CrmLeadQuotationState;
}

const CRM_LEAD_LIST_ITEM_KEYS = [
  "id",
  "status",
  "submittedName",
  "serviceCode",
  "locality",
  "entryMethod",
  "primarySourceLabel",
  "assignedTo",
  "assigneeLabel",
  "assignmentState",
  "primaryNextActionDueAt",
  "primaryNextActionTitle",
  "createdAt",
  "updatedAt",
  "salesBucket",
  "priorityScore",
  "scoreBand",
  "riskFlags",
  "stageEnteredAt",
  "slaBreached",
  "newUncontacted",
  "siteVisitState",
  "quotationState",
] as const satisfies readonly (keyof CrmLeadListItem)[];

export const CRM_LEAD_LIST_ITEM_PUBLIC_KEYS: readonly (keyof CrmLeadListItem)[] =
  CRM_LEAD_LIST_ITEM_KEYS;

const FORBIDDEN_LIST_FIELDS = [
  "submitted_email",
  "submittedEmail",
  "message",
  "estimate_snapshot",
  "estimateSnapshot",
  "attribution",
  "room_codes",
  "roomCodes",
  "contact_id",
  "contactId",
  "submission_reference",
  "submissionReference",
  "evidence",
  "client_fingerprint",
  "clientFingerprint",
] as const;

export const CRM_LEAD_LIST_FORBIDDEN_FIELDS: readonly string[] = [
  ...FORBIDDEN_LIST_FIELDS,
];

export interface CrmLeadListDerivedFields {
  readonly salesBucket: CrmLeadSalesBucket;
  readonly priorityScore: number;
  readonly scoreBand: CrmLeadScoreBand;
  readonly riskFlags: readonly CrmLeadRiskFlag[];
  readonly stageEnteredAt: string;
  readonly slaBreached: boolean;
  readonly newUncontacted: boolean;
  readonly primaryNextActionDueAt: string | null;
  readonly primaryNextActionTitle: string | null;
  readonly siteVisitState: CrmSiteVisitState;
  readonly quotationState: CrmLeadQuotationState;
}

export function mapLeadRowToListItem(
  row: CrmLeadListRow,
  options: {
    readonly assigneeLabel?: string;
  } & CrmLeadListDerivedFields
): CrmLeadListItem {
  return {
    id: row.id,
    status: row.status as LeadStageCode,
    submittedName: row.submitted_name,
    serviceCode: row.service_code,
    locality: row.locality,
    entryMethod: row.entry_method,
    primarySourceLabel: row.lead_sources?.display_name ?? "Unknown source",
    assignedTo: row.assigned_to,
    assigneeLabel:
      options.assigneeLabel ??
      (row.assigned_to ? "Assigned staff" : "Unassigned"),
    assignmentState: row.assigned_to ? "assigned" : "unassigned",
    primaryNextActionDueAt: options.primaryNextActionDueAt,
    primaryNextActionTitle: options.primaryNextActionTitle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    salesBucket: options.salesBucket,
    priorityScore: options.priorityScore,
    scoreBand: options.scoreBand,
    riskFlags: options.riskFlags,
    stageEnteredAt: options.stageEnteredAt,
    slaBreached: options.slaBreached,
    newUncontacted: options.newUncontacted,
    siteVisitState: options.siteVisitState,
    quotationState: options.quotationState,
  };
}
