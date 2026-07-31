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
  readonly nextFollowUpDue: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
  "nextFollowUpDue",
  "createdAt",
  "updatedAt",
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

export function mapLeadRowToListItem(
  row: CrmLeadListRow,
  options: {
    readonly assigneeLabel?: string;
    readonly nextFollowUpDue?: string | null;
  } = {}
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
    nextFollowUpDue: options.nextFollowUpDue ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
