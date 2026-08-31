import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type {
  CrmCadenceEnrollmentStatus,
  CrmCadenceStopReason,
  CrmCadenceStepInput,
  CrmCadenceTemplateStatus,
} from "../contracts/cadence-contracts.ts";
import { cadenceStepInputsToRpcPayload } from "../contracts/cadence-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

type CrmServerClient = SupabaseClient<Database>;
type CadenceTemplateRow =
  Database["public"]["Tables"]["crm_cadence_templates"]["Row"];
type CadenceEnrollmentRow =
  Database["public"]["Tables"]["crm_lead_cadence_enrollments"]["Row"];

export interface CadenceTemplateMutationResult {
  readonly id: string;
  readonly name: string;
  readonly status: CrmCadenceTemplateStatus;
}

export interface CadenceEnrollmentMutationResult {
  readonly id: string;
  readonly leadId: string;
  readonly templateId: string;
  readonly status: CrmCadenceEnrollmentStatus;
  readonly currentStepOrder: number | null;
  readonly stopReason: CrmCadenceStopReason | null;
}

function assertTemplateRow(data: unknown): CadenceTemplateRow {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  const row = data as CadenceTemplateRow;
  if (!row.id || !row.status) {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  return row;
}

function assertEnrollmentRow(data: unknown): CadenceEnrollmentRow {
  if (!data || typeof data !== "object") {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  const row = data as CadenceEnrollmentRow;
  if (!row.id || !row.lead_id) {
    throw crmErrorFromPostgresMessage("Empty RPC result", "RPC_FAILED");
  }
  return row;
}

function mapTemplate(row: CadenceTemplateRow): CadenceTemplateMutationResult {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CrmCadenceTemplateStatus,
  };
}

function mapEnrollment(
  row: CadenceEnrollmentRow
): CadenceEnrollmentMutationResult {
  return {
    id: row.id,
    leadId: row.lead_id,
    templateId: row.template_id,
    status: row.status as CrmCadenceEnrollmentStatus,
    currentStepOrder: row.current_step_order,
    stopReason: row.stop_reason as CrmCadenceStopReason | null,
  };
}

export async function callCreateCadenceTemplate(
  client: CrmServerClient,
  input: { readonly name: string; readonly description: string | null }
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("create_cadence_template", {
    p_name: input.name,
    p_description: input.description ?? undefined,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callUpdateCadenceTemplate(
  client: CrmServerClient,
  input: {
    readonly templateId: string;
    readonly name: string;
    readonly description: string | null;
  }
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("update_cadence_template", {
    p_template_id: input.templateId,
    p_name: input.name,
    p_description: input.description ?? undefined,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callReplaceCadenceTemplateSteps(
  client: CrmServerClient,
  input: {
    readonly templateId: string;
    readonly steps: readonly CrmCadenceStepInput[];
  }
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("replace_cadence_template_steps", {
    p_template_id: input.templateId,
    p_steps: cadenceStepInputsToRpcPayload(
      input.steps
    ) as unknown as Database["public"]["Functions"]["replace_cadence_template_steps"]["Args"]["p_steps"],
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callPublishCadenceTemplate(
  client: CrmServerClient,
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("publish_cadence_template", {
    p_template_id: templateId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callArchiveCadenceTemplate(
  client: CrmServerClient,
  templateId: string
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("archive_cadence_template", {
    p_template_id: templateId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callDuplicateCadenceTemplate(
  client: CrmServerClient,
  input: { readonly templateId: string; readonly name: string }
): Promise<CadenceTemplateMutationResult> {
  const { data, error } = await client.rpc("duplicate_cadence_template", {
    p_template_id: input.templateId,
    p_name: input.name,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapTemplate(assertTemplateRow(data));
}

export async function callEnrollLeadInCadence(
  client: CrmServerClient,
  input: { readonly leadId: string; readonly templateId: string }
): Promise<CadenceEnrollmentMutationResult> {
  const { data, error } = await client.rpc("enroll_lead_in_cadence", {
    p_lead_id: input.leadId,
    p_template_id: input.templateId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapEnrollment(assertEnrollmentRow(data));
}

export async function callPauseLeadCadence(
  client: CrmServerClient,
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  const { data, error } = await client.rpc("pause_lead_cadence", {
    p_enrollment_id: enrollmentId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapEnrollment(assertEnrollmentRow(data));
}

export async function callResumeLeadCadence(
  client: CrmServerClient,
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  const { data, error } = await client.rpc("resume_lead_cadence", {
    p_enrollment_id: enrollmentId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapEnrollment(assertEnrollmentRow(data));
}

export async function callCancelLeadCadence(
  client: CrmServerClient,
  enrollmentId: string
): Promise<CadenceEnrollmentMutationResult> {
  const { data, error } = await client.rpc("cancel_lead_cadence", {
    p_enrollment_id: enrollmentId,
  });
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }
  return mapEnrollment(assertEnrollmentRow(data));
}
