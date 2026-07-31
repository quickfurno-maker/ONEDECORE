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
  readonly created_at: string;
  readonly updated_at: string;
}

/** Scoped CRM list DTO — no intake blobs, contact linkage, or audit internals. */
export interface CrmLeadListItem {
  readonly id: string;
  readonly status: LeadStageCode;
  readonly submittedName: string;
  readonly serviceCode: string;
  readonly locality: string | null;
  readonly assignedTo: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const CRM_LEAD_LIST_ITEM_KEYS = [
  "id",
  "status",
  "submittedName",
  "serviceCode",
  "locality",
  "assignedTo",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof CrmLeadListItem)[];

export const CRM_LEAD_LIST_ITEM_PUBLIC_KEYS: readonly (keyof CrmLeadListItem)[] =
  CRM_LEAD_LIST_ITEM_KEYS;

export function mapLeadRowToListItem(row: CrmLeadListRow): CrmLeadListItem {
  return {
    id: row.id,
    status: row.status as LeadStageCode,
    submittedName: row.submitted_name,
    serviceCode: row.service_code,
    locality: row.locality,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
