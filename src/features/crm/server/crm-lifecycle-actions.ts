"use server";

import { revalidatePath } from "next/cache";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import type { LifecycleActionState } from "../contracts/lifecycle-contracts.ts";
import {
  lifecycleFieldErrorsToRecord,
  validateLeadFollowUpCreateInput,
  validateLeadNoteInput,
  validateLeadStatusTransitionInput,
  validateFollowUpOutcomeInput,
} from "../contracts/lifecycle-contracts.ts";
import {
  addLeadNoteForCurrentUser,
  cancelLeadFollowUpForCurrentUser,
  completeLeadFollowUpForCurrentUser,
  createLeadFollowUpForCurrentUser,
  transitionLeadStatusForCurrentUser,
} from "./crm-lifecycle-service.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { createClient } from "@/lib/supabase/server";

function parseNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toLifecycleActionState(error: unknown): LifecycleActionState {
  if (error instanceof CrmError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "CRM operation failed"
  );
  return {
    success: false,
    message: mapped.message,
    code: mapped.code,
  };
}

async function fetchLeadStatusForAction(leadId: string): Promise<LeadStageCode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();

  return (data?.status ?? "new") as LeadStageCode;
}

export async function transitionLeadStatusAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const newStatus = String(formData.get("newStatus") ?? "").trim() as LeadStageCode;
  const reason = parseNullableString(formData.get("reason"));
  const closureReasonCode = parseNullableString(formData.get("closureReasonCode"));

  const currentStatus = await fetchLeadStatusForAction(leadId);
  const fieldErrors = validateLeadStatusTransitionInput(
    { leadId, newStatus, reason, closureReasonCode },
    currentStatus
  );

  if (fieldErrors.length > 0) {
    return {
      success: false,
      message: fieldErrors[0]?.message ?? "Validation failed.",
      code: "VALIDATION_FAILED",
      fieldErrors: lifecycleFieldErrorsToRecord(fieldErrors),
    };
  }

  try {
    await transitionLeadStatusForCurrentUser({
      leadId,
      newStatus,
      reason,
      closureReasonCode,
    });

    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);

    return {
      success: true,
      message: "Lead status updated successfully.",
    };
  } catch (error: unknown) {
    return toLifecycleActionState(error);
  }
}

export async function addLeadNoteAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  const fieldErrors = validateLeadNoteInput({ leadId, body });
  if (fieldErrors.length > 0) {
    return {
      success: false,
      message: fieldErrors[0]?.message ?? "Validation failed.",
      code: "VALIDATION_FAILED",
      fieldErrors: lifecycleFieldErrorsToRecord(fieldErrors),
    };
  }

  try {
    await addLeadNoteForCurrentUser({ leadId, body });
    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);
    return {
      success: true,
      message: "Note added successfully.",
    };
  } catch (error: unknown) {
    return toLifecycleActionState(error);
  }
}

export async function createLeadFollowUpAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const ownerId = parseNullableString(formData.get("ownerId"));

  const fieldErrors = validateLeadFollowUpCreateInput({ leadId, dueAt, ownerId });
  if (fieldErrors.length > 0) {
    return {
      success: false,
      message: fieldErrors[0]?.message ?? "Validation failed.",
      code: "VALIDATION_FAILED",
      fieldErrors: lifecycleFieldErrorsToRecord(fieldErrors),
    };
  }

  try {
    const context = await getCrmAccessContext();
    await createLeadFollowUpForCurrentUser({
      leadId,
      dueAt,
      ownerId: context?.canReadBroad ? ownerId : null,
    });

    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);
    return {
      success: true,
      message: "Follow-up scheduled successfully.",
    };
  } catch (error: unknown) {
    return toLifecycleActionState(error);
  }
}

export async function completeLeadFollowUpAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const followUpId = String(formData.get("followUpId") ?? "").trim();
  const outcome = parseNullableString(formData.get("outcome"));

  const fieldErrors = validateFollowUpOutcomeInput({ followUpId, outcome });
  if (fieldErrors.length > 0) {
    return {
      success: false,
      message: fieldErrors[0]?.message ?? "Validation failed.",
      code: "VALIDATION_FAILED",
      fieldErrors: lifecycleFieldErrorsToRecord(fieldErrors),
    };
  }

  try {
    await completeLeadFollowUpForCurrentUser({ followUpId, outcome });
    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);
    return {
      success: true,
      message: "Follow-up completed successfully.",
    };
  } catch (error: unknown) {
    return toLifecycleActionState(error);
  }
}

export async function cancelLeadFollowUpAction(
  _previousState: LifecycleActionState,
  formData: FormData
): Promise<LifecycleActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const followUpId = String(formData.get("followUpId") ?? "").trim();
  const outcome = parseNullableString(formData.get("outcome"));

  const fieldErrors = validateFollowUpOutcomeInput({ followUpId, outcome });
  if (fieldErrors.length > 0) {
    return {
      success: false,
      message: fieldErrors[0]?.message ?? "Validation failed.",
      code: "VALIDATION_FAILED",
      fieldErrors: lifecycleFieldErrorsToRecord(fieldErrors),
    };
  }

  try {
    await cancelLeadFollowUpForCurrentUser({ followUpId, outcome });
    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);
    return {
      success: true,
      message: "Follow-up cancelled successfully.",
    };
  } catch (error: unknown) {
    return toLifecycleActionState(error);
  }
}
