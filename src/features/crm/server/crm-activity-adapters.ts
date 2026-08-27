import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import {
  completeInputToRpcArgs,
  type CompleteLeadActivityInput,
  type CreateLeadActivityInput,
  type CrmActivityMutationResult,
  type DesignatePrimaryNextActionInput,
  type RescheduleLeadActivityInput,
  type TransferActivityOwnershipInput,
} from "../contracts/activity-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

type CrmServerClient = SupabaseClient<Database>;
type LeadFollowUpRow = Database["public"]["Tables"]["lead_follow_ups"]["Row"];
type CreateLeadActivityArgs = Database["public"]["Functions"]["create_lead_activity"]["Args"];
type RescheduleLeadActivityArgs =
  Database["public"]["Functions"]["reschedule_lead_activity"]["Args"];
type TransferActivityOwnershipArgs =
  Database["public"]["Functions"]["transfer_activity_ownership"]["Args"];
type DesignatePrimaryNextActionArgs =
  Database["public"]["Functions"]["designate_primary_next_action"]["Args"];
type CompleteLeadActivityArgs =
  Database["public"]["Functions"]["complete_lead_activity"]["Args"];

function assertActivityRow(data: unknown): LeadFollowUpRow {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  const row = data as LeadFollowUpRow;
  if (!row.id || !row.lead_id) {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  return row;
}

export function mapLeadFollowUpRowToMutationResult(
  row: LeadFollowUpRow
): CrmActivityMutationResult {
  return {
    id: row.id,
    leadId: row.lead_id,
    status: row.status,
    dueAt: row.due_at,
    ownerId: row.owner_id,
    activityType: row.activity_type,
    title: row.title,
    priority: row.priority,
    isPrimaryNextAction: row.is_primary_next_action,
    outcomeCode: row.outcome_code,
  };
}

export async function callCreateLeadActivity(
  client: CrmServerClient,
  input: CreateLeadActivityInput
): Promise<CrmActivityMutationResult> {
  const args: CreateLeadActivityArgs = {
    p_lead_id: input.leadId,
    p_activity_type: input.activityType,
    p_title: input.title,
    p_due_at: input.dueAt,
    p_priority: input.priority,
    p_owner_id: input.ownerId ?? undefined,
    p_is_primary: input.isPrimary,
    p_duration_minutes: input.durationMinutes ?? undefined,
    p_reminder_at: input.reminderAt ?? undefined,
    p_quotation_id: input.quotationId ?? undefined,
  };

  const { data, error } = await client.rpc("create_lead_activity", args);
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapLeadFollowUpRowToMutationResult(assertActivityRow(data));
}

export async function callRescheduleLeadActivity(
  client: CrmServerClient,
  input: RescheduleLeadActivityInput
): Promise<CrmActivityMutationResult> {
  const args: RescheduleLeadActivityArgs = {
    p_activity_id: input.activityId,
    p_due_at: input.dueAt,
    p_reminder_at: input.reminderAt ?? undefined,
    p_clear_reminder: input.clearReminder,
  };

  const { data, error } = await client.rpc("reschedule_lead_activity", args);
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapLeadFollowUpRowToMutationResult(assertActivityRow(data));
}

export async function callTransferActivityOwnership(
  client: CrmServerClient,
  input: TransferActivityOwnershipInput
): Promise<CrmActivityMutationResult> {
  const args: TransferActivityOwnershipArgs = {
    p_activity_id: input.activityId,
    p_new_owner_id: input.newOwnerId,
  };

  const { data, error } = await client.rpc("transfer_activity_ownership", args);
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapLeadFollowUpRowToMutationResult(assertActivityRow(data));
}

export async function callDesignatePrimaryNextAction(
  client: CrmServerClient,
  input: DesignatePrimaryNextActionInput
): Promise<CrmActivityMutationResult> {
  const args: DesignatePrimaryNextActionArgs = {
    p_activity_id: input.activityId,
  };

  const { data, error } = await client.rpc(
    "designate_primary_next_action",
    args
  );
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapLeadFollowUpRowToMutationResult(assertActivityRow(data));
}

export async function callCompleteLeadActivity(
  client: CrmServerClient,
  input: CompleteLeadActivityInput
): Promise<CrmActivityMutationResult> {
  const mapped = completeInputToRpcArgs(input);
  if (mapped.p_resolution === "CLOSED_WON") {
    throw crmErrorFromPostgresMessage(
      "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE"
    );
  }

  // Send all 16 keys; null irrelevant resolution fields (DB defaults).
  const args = {
    p_activity_id: mapped.p_activity_id,
    p_outcome_code: mapped.p_outcome_code,
    p_completion_note: mapped.p_completion_note,
    p_resolution: mapped.p_resolution,
    p_next_activity_type: mapped.p_next_activity_type,
    p_next_title: mapped.p_next_title,
    p_next_due_at: mapped.p_next_due_at,
    p_next_priority: mapped.p_next_priority,
    p_next_duration_minutes: mapped.p_next_duration_minutes,
    p_next_reminder_at: mapped.p_next_reminder_at,
    p_next_quotation_id: mapped.p_next_quotation_id,
    p_on_hold_reason: mapped.p_on_hold_reason,
    p_on_hold_review_at: mapped.p_on_hold_review_at,
    p_closed_lost_reason: mapped.p_closed_lost_reason,
    p_closure_reason_code: mapped.p_closure_reason_code,
    p_whatsapp_send_intent_id: mapped.p_whatsapp_send_intent_id,
  } as CompleteLeadActivityArgs;

  const { data, error } = await client.rpc("complete_lead_activity", args);
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapLeadFollowUpRowToMutationResult(assertActivityRow(data));
}
