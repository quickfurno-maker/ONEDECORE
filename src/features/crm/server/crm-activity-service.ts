import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  type CompleteLeadActivityInput,
  type CreateLeadActivityInput,
  type CrmActivityMutationResult,
  type CrmActivityOutcomeOption,
  type DesignatePrimaryNextActionInput,
  type RescheduleLeadActivityInput,
  type TransferActivityOwnershipInput,
  validateCompleteLeadActivityInput,
  validateCreateLeadActivityInput,
  validateDesignatePrimaryNextActionInput,
  validateRescheduleLeadActivityInput,
  validateTransferActivityOwnershipInput,
} from "../contracts/activity-contracts.ts";
import {
  callCompleteLeadActivity,
  callCreateLeadActivity,
  callDesignatePrimaryNextAction,
  callRescheduleLeadActivity,
  callTransferActivityOwnership,
} from "./crm-activity-adapters.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

function requireActivityMutationContext(): Promise<CrmAccessContext> {
  return getCrmAccessContext().then((context) => {
    if (!context) {
      throw new CrmError({
        code: "AUTH_REQUIRED",
        message: "Authentication required",
        httpStatus: 401,
      });
    }
    if (!context.canManageLeadFollowUps) {
      throw new CrmError({
        code: "PERMISSION_DENIED",
        message: "Permission denied",
        httpStatus: 403,
      });
    }
    return context;
  });
}

function throwValidation(errors: readonly { field: string; message: string }[]) {
  throw new CrmError({
    code: "VALIDATION_FAILED",
    message: errors[0]?.message ?? "Validation failed",
    httpStatus: 422,
    details: errors.map((entry) => entry.message).join("; "),
  });
}

function resolveActivityOwnerId(
  context: CrmAccessContext,
  requestedOwnerId: string | null
): string | null {
  if (!context.canReadBroad) {
    return context.userId;
  }
  if (!requestedOwnerId || requestedOwnerId === "self") {
    return context.userId;
  }
  return requestedOwnerId;
}

export async function createLeadActivityForCurrentUser(
  input: CreateLeadActivityInput
): Promise<CrmActivityMutationResult> {
  const context = await requireActivityMutationContext();
  const validationErrors = validateCreateLeadActivityInput(input);
  if (validationErrors.length > 0) {
    throwValidation(validationErrors);
  }

  const supabase = await createClient();
  return callCreateLeadActivity(supabase, {
    ...input,
    ownerId: resolveActivityOwnerId(context, input.ownerId),
  });
}

export async function rescheduleLeadActivityForCurrentUser(
  input: RescheduleLeadActivityInput
): Promise<CrmActivityMutationResult> {
  await requireActivityMutationContext();
  const validationErrors = validateRescheduleLeadActivityInput(input);
  if (validationErrors.length > 0) {
    throwValidation(validationErrors);
  }

  const supabase = await createClient();
  return callRescheduleLeadActivity(supabase, input);
}

export async function transferActivityOwnershipForCurrentUser(
  input: TransferActivityOwnershipInput
): Promise<CrmActivityMutationResult> {
  await requireActivityMutationContext();
  const validationErrors = validateTransferActivityOwnershipInput(input);
  if (validationErrors.length > 0) {
    throwValidation(validationErrors);
  }

  const supabase = await createClient();
  return callTransferActivityOwnership(supabase, input);
}

export async function designatePrimaryNextActionForCurrentUser(
  input: DesignatePrimaryNextActionInput
): Promise<CrmActivityMutationResult> {
  await requireActivityMutationContext();
  const validationErrors = validateDesignatePrimaryNextActionInput(input);
  if (validationErrors.length > 0) {
    throwValidation(validationErrors);
  }

  const supabase = await createClient();
  return callDesignatePrimaryNextAction(supabase, input);
}

export async function completeLeadActivityForCurrentUser(
  input: CompleteLeadActivityInput
): Promise<CrmActivityMutationResult> {
  await requireActivityMutationContext();
  const validationErrors = validateCompleteLeadActivityInput(input);
  if (validationErrors.length > 0) {
    throwValidation(validationErrors);
  }

  const supabase = await createClient();
  return callCompleteLeadActivity(supabase, input);
}

export async function listActivityOutcomeOptionsForCurrentUser(): Promise<
  readonly CrmActivityOutcomeOption[]
> {
  await requireActivityMutationContext();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_activity_outcome_codes")
    .select(
      "code, display_name, activity_types, closes_contact_attempt, display_order"
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data ?? []).map((row) => ({
    code: row.code,
    displayName: row.display_name,
    activityTypes: row.activity_types ?? [],
    closesContactAttempt: row.closes_contact_attempt,
    displayOrder: row.display_order,
  }));
}
