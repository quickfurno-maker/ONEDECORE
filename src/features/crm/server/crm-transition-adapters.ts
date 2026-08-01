import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import type { CrmLeadListRow } from "../contracts/lead-dtos.ts";
import type {
  ManualLeadDuplicatePreview,
  ManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

type CrmServerClient = SupabaseClient<Database>;

interface AssignLeadRpcArgs {
  readonly p_lead_id: string;
  readonly p_assignee_id: string | null;
  readonly p_reason: string | null;
  readonly p_expected_assignee: string | null;
  readonly p_expected_updated_at: string | null;
  readonly p_enforce_expected_state: boolean;
}

interface TransitionLeadStatusRpcArgs {
  readonly p_lead_id: string;
  readonly p_new_status: LeadStageCode;
  readonly p_reason: string | null;
  readonly p_closure_reason_code: string | null;
}

interface CreateLeadFollowUpRpcArgs {
  readonly p_lead_id: string;
  readonly p_due_at: string;
  readonly p_owner_id: string | null;
}

interface CompleteLeadFollowUpRpcArgs {
  readonly p_follow_up_id: string;
  readonly p_outcome: string | null;
}

interface CancelLeadFollowUpRpcArgs {
  readonly p_follow_up_id: string;
  readonly p_outcome: string | null;
}

interface UpdateLeadSourceRpcArgs {
  readonly p_source_id: string;
  readonly p_display_name: string | null;
  readonly p_description: string | null;
  readonly p_display_order: number | null;
  readonly p_is_active: boolean | null;
}

interface CheckManualLeadDuplicateRpcArgs {
  readonly p_phone: string | null;
  readonly p_email: string | null;
  readonly p_service_code: string;
  readonly p_property_code: string;
  readonly p_locality: string | null;
}

interface CreateManualLeadRpcArgs {
  readonly p_submitted_name: string;
  readonly p_phone: string | null;
  readonly p_email: string | null;
  readonly p_service_code: string;
  readonly p_property_code: string;
  readonly p_timeline_code: string;
  readonly p_primary_source_id: string;
  readonly p_locality: string | null;
  readonly p_budget_comfort_code: string | null;
  readonly p_room_codes: string[];
  readonly p_message: string | null;
  readonly p_source_detail: string | null;
  readonly p_assignee_id: string | null;
  readonly p_duplicate_override: boolean;
  readonly p_duplicate_override_reason: string | null;
}

type CrmRpcClient = CrmServerClient & {
  rpc(
    fn: "assign_lead",
    args: AssignLeadRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "transition_lead_status",
    args: TransitionLeadStatusRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "create_lead_follow_up",
    args: CreateLeadFollowUpRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "complete_lead_follow_up",
    args: CompleteLeadFollowUpRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "cancel_lead_follow_up",
    args: CancelLeadFollowUpRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "update_lead_source",
    args: UpdateLeadSourceRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "check_manual_lead_duplicate",
    args: CheckManualLeadDuplicateRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
  rpc(
    fn: "create_manual_lead",
    args: CreateManualLeadRpcArgs
  ): ReturnType<CrmServerClient["rpc"]>;
};

export interface AssignLeadInput {
  readonly leadId: string;
  readonly assigneeId: string | null;
  readonly reason?: string | null;
  readonly expectedAssigneeId?: string | null;
  readonly expectedUpdatedAt?: string | null;
  readonly enforceExpectedState?: boolean;
}

export interface TransitionLeadStatusInput {
  readonly leadId: string;
  readonly newStatus: LeadStageCode;
  readonly reason?: string | null;
  readonly closureReasonCode?: string | null;
}

export interface CreateLeadFollowUpInput {
  readonly leadId: string;
  readonly dueAt: string;
  readonly ownerId?: string | null;
}

export interface CompleteLeadFollowUpInput {
  readonly followUpId: string;
  readonly outcome?: string | null;
}

export interface CancelLeadFollowUpInput {
  readonly followUpId: string;
  readonly outcome?: string | null;
}

export interface UpdateLeadSourceInput {
  readonly sourceId: string;
  readonly displayName?: string | null;
  readonly description?: string | null;
  readonly displayOrder?: number | null;
  readonly isActive?: boolean | null;
}

function assertLeadRow(data: unknown): CrmLeadListRow {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }

  return data as CrmLeadListRow;
}

/**
 * Invokes `public.assign_lead` — assignment method is derived server-side.
 */
export async function callAssignLead(
  client: CrmServerClient,
  input: AssignLeadInput
): Promise<CrmLeadListRow> {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("assign_lead", {
    p_lead_id: input.leadId,
    p_assignee_id: input.assigneeId,
    p_reason: input.reason ?? null,
    p_expected_assignee: input.expectedAssigneeId ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_enforce_expected_state: input.enforceExpectedState ?? false,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return assertLeadRow(data);
}

/**
 * Invokes `public.transition_lead_status` — audited pipeline transitions only.
 */
export async function callTransitionLeadStatus(
  client: CrmServerClient,
  input: TransitionLeadStatusInput
): Promise<CrmLeadListRow> {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("transition_lead_status", {
    p_lead_id: input.leadId,
    p_new_status: input.newStatus,
    p_reason: input.reason ?? null,
    p_closure_reason_code: input.closureReasonCode ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return assertLeadRow(data);
}

export async function callCreateLeadFollowUp(
  client: CrmServerClient,
  input: CreateLeadFollowUpInput
) {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("create_lead_follow_up", {
    p_lead_id: input.leadId,
    p_due_at: input.dueAt,
    p_owner_id: input.ownerId ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return data;
}

export async function callCompleteLeadFollowUp(
  client: CrmServerClient,
  input: CompleteLeadFollowUpInput
) {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("complete_lead_follow_up", {
    p_follow_up_id: input.followUpId,
    p_outcome: input.outcome ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return data;
}

export async function callCancelLeadFollowUp(
  client: CrmServerClient,
  input: CancelLeadFollowUpInput
) {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("cancel_lead_follow_up", {
    p_follow_up_id: input.followUpId,
    p_outcome: input.outcome ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return data;
}

export async function callUpdateLeadSource(
  client: CrmServerClient,
  input: UpdateLeadSourceInput
) {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("update_lead_source", {
    p_source_id: input.sourceId,
    p_display_name: input.displayName ?? null,
    p_description: input.description ?? null,
    p_display_order: input.displayOrder ?? null,
    p_is_active: input.isActive ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return data;
}

function assertDuplicatePreviewRow(data: unknown): ManualLeadDuplicatePreview {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty duplicate preview result", "RPC_FAILED");
  }

  const row = data as Record<string, unknown>;
  return {
    outcomeCode: String(row.outcome_code) as ManualLeadDuplicatePreview["outcomeCode"],
    canCreate: row.can_create === true,
    canOverride: row.can_override === true,
    existingLeadId:
      typeof row.existing_lead_id === "string" ? row.existing_lead_id : null,
  };
}

export async function callCheckManualLeadDuplicate(
  client: CrmServerClient,
  input: {
    readonly phone: string | null;
    readonly email: string | null;
    readonly serviceCode: string;
    readonly propertyCode: string;
    readonly locality: string | null;
  }
): Promise<ManualLeadDuplicatePreview> {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("check_manual_lead_duplicate", {
    p_phone: input.phone,
    p_email: input.email,
    p_service_code: input.serviceCode,
    p_property_code: input.propertyCode,
    p_locality: input.locality,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "LEAD_CREATE_FAILED");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return assertDuplicatePreviewRow(row);
}

export async function callCreateManualLead(
  client: CrmServerClient,
  input: ManualLeadFormInput
): Promise<CrmLeadListRow> {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("create_manual_lead", {
    p_submitted_name: input.submittedName.trim(),
    p_phone: input.phone,
    p_email: input.email,
    p_service_code: input.serviceCode,
    p_property_code: input.propertyCode,
    p_timeline_code: input.timelineCode,
    p_primary_source_id: input.primarySourceId,
    p_locality: input.locality,
    p_budget_comfort_code: input.budgetComfortCode,
    p_room_codes: [...input.roomCodes],
    p_message: input.message,
    p_source_detail: input.sourceDetail,
    p_assignee_id: input.assigneeId,
    p_duplicate_override: input.duplicateOverride,
    p_duplicate_override_reason: input.duplicateOverrideReason,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "LEAD_CREATE_FAILED");
  }

  return assertLeadRow(data);
}
