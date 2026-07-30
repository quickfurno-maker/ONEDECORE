import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { CrmAssignmentMethod } from "../contracts/permissions.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import type { CrmLeadListRow } from "../contracts/lead-dtos.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

type CrmServerClient = SupabaseClient<Database>;

interface AssignLeadRpcArgs {
  readonly p_lead_id: string;
  readonly p_assignee_id: string | null;
  readonly p_method: CrmAssignmentMethod;
  readonly p_reason: string | null;
}

interface TransitionLeadStatusRpcArgs {
  readonly p_lead_id: string;
  readonly p_new_status: LeadStageCode;
  readonly p_reason: string | null;
  readonly p_closure_reason_code: string | null;
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
};

export interface AssignLeadInput {
  readonly leadId: string;
  readonly assigneeId: string | null;
  readonly method?: CrmAssignmentMethod;
  readonly reason?: string | null;
}

export interface TransitionLeadStatusInput {
  readonly leadId: string;
  readonly newStatus: LeadStageCode;
  readonly reason?: string | null;
  readonly closureReasonCode?: string | null;
}

function assertLeadRow(data: unknown): CrmLeadListRow {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }

  return data as CrmLeadListRow;
}

/**
 * Invokes `public.assign_lead` — the only supported path for ownership changes.
 */
export async function callAssignLead(
  client: CrmServerClient,
  input: AssignLeadInput
): Promise<CrmLeadListRow> {
  const rpcClient = client as CrmRpcClient;
  const { data, error } = await rpcClient.rpc("assign_lead", {
    p_lead_id: input.leadId,
    p_assignee_id: input.assigneeId,
    p_method: input.method ?? "manual",
    p_reason: input.reason ?? null,
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
