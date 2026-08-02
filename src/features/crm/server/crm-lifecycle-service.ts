import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type { CrmLeadListRow } from "../contracts/lead-dtos.ts";
import {
  normalizeFollowUpOutcome,
  validateFollowUpOutcomeInput,
  validateLeadFollowUpCreateInput,
  validateLeadNoteInput,
  validateLeadStatusTransitionInput,
  type LeadFollowUpCreateInput,
  type LeadFollowUpOutcomeInput,
  type LeadNoteInput,
  type LeadStatusTransitionInput,
} from "../contracts/lifecycle-contracts.ts";
import {
  isTerminalLeadStage,
  PHASE_5B_BLOCKED_TARGET_STAGES,
  type LeadStageCode,
} from "../contracts/lead-stages.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError } from "./crm-errors.ts";
import {
  callCancelLeadFollowUp,
  callCompleteLeadFollowUp,
  callCreateLeadFollowUp,
  callTransitionLeadStatus,
} from "./crm-transition-adapters.ts";

function assertLifecycleCapability(
  context: CrmAccessContext,
  capability: keyof Pick<
    CrmAccessContext,
    "canTransitionLeads" | "canManageLeadNotes" | "canManageLeadFollowUps"
  >
): void {
  if (!context[capability]) {
    throw new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

function rejectBlockedTargetStatus(newStatus: LeadStageCode): void {
  if ((PHASE_5B_BLOCKED_TARGET_STAGES as readonly string[]).includes(newStatus)) {
    throw new CrmError({
      code: "INVALID_TRANSITION",
      message: "Lead status transition rejected",
      httpStatus: 422,
    });
  }
}

async function fetchLeadStatus(leadId: string): Promise<LeadStageCode> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "CRM operation failed",
      httpStatus: 500,
      details: error.message,
    });
  }

  if (!data) {
    throw new CrmError({
      code: "LEAD_NOT_FOUND",
      message: "Lead not found",
      httpStatus: 404,
    });
  }

  return data.status as LeadStageCode;
}

export function resolveFollowUpOwnerId(
  context: CrmAccessContext,
  requestedOwnerId: string | null | undefined
): string | null {
  if (!context.canReadBroad) {
    return context.userId;
  }

  const ownerId = requestedOwnerId?.trim();
  if (!ownerId || ownerId === "self") {
    return context.userId;
  }

  return ownerId;
}

export async function transitionLeadStatusForCurrentUser(
  input: LeadStatusTransitionInput
): Promise<CrmLeadListRow> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertLifecycleCapability(context, "canTransitionLeads");
  rejectBlockedTargetStatus(input.newStatus);

  const currentStatus = await fetchLeadStatus(input.leadId);
  const validationErrors = validateLeadStatusTransitionInput(input, currentStatus);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await createClient();
  return callTransitionLeadStatus(supabase, {
    leadId: input.leadId,
    newStatus: input.newStatus,
    reason: input.reason ?? null,
    closureReasonCode: input.closureReasonCode ?? null,
  });
}

export async function addLeadNoteForCurrentUser(
  input: LeadNoteInput
): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertLifecycleCapability(context, "canManageLeadNotes");

  const validationErrors = validateLeadNoteInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const currentStatus = await fetchLeadStatus(input.leadId);
  if (isTerminalLeadStage(currentStatus)) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: "Notes cannot be added on terminal leads.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lead_notes").insert(
    {
      lead_id: input.leadId,
      body: input.body.trim(),
    } as never
  );

  if (error) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: "Note could not be saved.",
      httpStatus: 422,
      details: error.message,
    });
  }
}

export async function createLeadFollowUpForCurrentUser(
  input: LeadFollowUpCreateInput
): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertLifecycleCapability(context, "canManageLeadFollowUps");

  const validationErrors = validateLeadFollowUpCreateInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const currentStatus = await fetchLeadStatus(input.leadId);
  if (isTerminalLeadStage(currentStatus)) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: "New follow-ups cannot be scheduled on terminal leads.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  await callCreateLeadFollowUp(supabase, {
    leadId: input.leadId,
    dueAt: new Date(input.dueAt).toISOString(),
    ownerId: resolveFollowUpOwnerId(context, input.ownerId),
  });
}

export async function completeLeadFollowUpForCurrentUser(
  input: LeadFollowUpOutcomeInput
): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertLifecycleCapability(context, "canManageLeadFollowUps");

  const validationErrors = validateFollowUpOutcomeInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await createClient();
  await callCompleteLeadFollowUp(supabase, {
    followUpId: input.followUpId,
    outcome: normalizeFollowUpOutcome(input.outcome),
  });
}

export async function cancelLeadFollowUpForCurrentUser(
  input: LeadFollowUpOutcomeInput
): Promise<void> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  assertLifecycleCapability(context, "canManageLeadFollowUps");

  const validationErrors = validateFollowUpOutcomeInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await createClient();
  await callCancelLeadFollowUp(supabase, {
    followUpId: input.followUpId,
    outcome: normalizeFollowUpOutcome(input.outcome),
  });
}
