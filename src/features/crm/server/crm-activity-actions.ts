"use server";

import { revalidatePath } from "next/cache";
import {
  activityFieldErrorsToRecord,
  normalizeCompleteLeadActivityInput,
  normalizeCreateLeadActivityInput,
  normalizeDesignatePrimaryNextActionInput,
  normalizeRescheduleLeadActivityInput,
  normalizeTransferActivityOwnershipInput,
  validateCompleteLeadActivityInput,
  validateCreateLeadActivityInput,
  validateDesignatePrimaryNextActionInput,
  validateRescheduleLeadActivityInput,
  validateTransferActivityOwnershipInput,
  type CrmActivityActionState,
} from "../contracts/activity-contracts.ts";
import {
  completeLeadActivityForCurrentUser,
  createLeadActivityForCurrentUser,
  designatePrimaryNextActionForCurrentUser,
  rescheduleLeadActivityForCurrentUser,
  transferActivityOwnershipForCurrentUser,
} from "./crm-activity-service.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

function revalidateActivityPaths(leadId: string): void {
  revalidatePath("/admin/crm/leads");
  revalidatePath(`/admin/crm/leads/${leadId}`);
}

function toActivityActionState(error: unknown): CrmActivityActionState {
  if (error instanceof CrmError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  const message =
    error instanceof Error ? error.message : "CRM operation failed";
  if (
    message === "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE" ||
    message === "NEXT_ACTION_REQUIRED"
  ) {
    const mapped = crmErrorFromPostgresMessage(message);
    return {
      success: false,
      message: mapped.message,
      code: mapped.code,
    };
  }

  const mapped = crmErrorFromPostgresMessage(message);
  return {
    success: false,
    message: mapped.message,
    code: mapped.code === "VALIDATION_FAILED" ? mapped.code : "RPC_FAILED",
  };
}

function fieldErrorsForDbCode(code: string): Record<string, string> {
  switch (code) {
    case "ACTIVITY_TITLE_INVALID":
      return { title: "Activity title must be 1–120 characters." };
    case "ACTIVITY_TYPE_INVALID":
      return { activityType: "Activity type is invalid." };
    case "ACTIVITY_PRIORITY_INVALID":
      return { priority: "Activity priority is invalid." };
    case "ACTIVITY_DUE_REQUIRED":
    case "ACTIVITY_DUE_MUST_BE_FUTURE":
      return { dueAt: "Due date and time are invalid." };
    case "ACTIVITY_DURATION_INVALID":
      return { durationMinutes: "Duration must be between 1 and 1440 minutes." };
    case "ACTIVITY_REMINDER_INVALID":
      return { reminderAt: "Reminder must be at or before the due time." };
    case "ACTIVITY_OUTCOME_REQUIRED":
    case "ACTIVITY_OUTCOME_INVALID":
    case "ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE":
      return { outcomeCode: "Outcome is invalid." };
    case "NEXT_PRIMARY_INVALID":
    case "NEXT_ACTION_REQUIRED":
      return { resolution: "Choose a valid next action." };
    case "ON_HOLD_REVIEW_REQUIRED":
      return { onHoldReviewAt: "On-hold reason and future review time are required." };
    case "WHATSAPP_SEND_EVIDENCE_REQUIRED":
    case "WHATSAPP_SEND_EVIDENCE_INVALID":
      return {
        whatsappSendIntentId:
          "A governed WhatsApp send intent is required for this outcome.",
      };
    case "PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT":
      return {
        newOwnerId: "Primary next-action ownership follows lead assignment.",
      };
    default:
      return {};
  }
}

export async function createLeadActivityAction(
  _previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  try {
    const input = normalizeCreateLeadActivityInput({
      leadId: formData.get("leadId"),
      activityType: formData.get("activityType"),
      title: formData.get("title"),
      dueAt: formData.get("dueAt"),
      priority: formData.get("priority"),
      ownerId: formData.get("ownerId"),
      isPrimary: formData.get("isPrimary"),
      durationMinutes: formData.get("durationMinutes"),
      reminderAt: formData.get("reminderAt"),
      quotationId: formData.get("quotationId"),
    });
    const fieldErrors = validateCreateLeadActivityInput(input);
    if (fieldErrors.length > 0) {
      return {
        success: false,
        message: fieldErrors[0]?.message ?? "Validation failed.",
        code: "VALIDATION_FAILED",
        fieldErrors: activityFieldErrorsToRecord(fieldErrors),
      };
    }

    const result = await createLeadActivityForCurrentUser(input);
    revalidateActivityPaths(result.leadId);
    return {
      success: true,
      message: "Activity created.",
      activityId: result.id,
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        ...toActivityActionState(error),
        fieldErrors: fieldErrorsForDbCode(error.code),
      };
    }
    return toActivityActionState(error);
  }
}

export async function rescheduleLeadActivityAction(
  _previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  try {
    const input = normalizeRescheduleLeadActivityInput({
      activityId: formData.get("activityId"),
      dueAt: formData.get("dueAt"),
      reminderAt: formData.get("reminderAt"),
      clearReminder: formData.get("clearReminder"),
    });
    const fieldErrors = validateRescheduleLeadActivityInput(input);
    if (fieldErrors.length > 0) {
      return {
        success: false,
        message: fieldErrors[0]?.message ?? "Validation failed.",
        code: "VALIDATION_FAILED",
        fieldErrors: activityFieldErrorsToRecord(fieldErrors),
      };
    }

    const result = await rescheduleLeadActivityForCurrentUser(input);
    revalidateActivityPaths(result.leadId);
    return {
      success: true,
      message: "Activity rescheduled.",
      activityId: result.id,
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        ...toActivityActionState(error),
        fieldErrors: fieldErrorsForDbCode(error.code),
      };
    }
    return toActivityActionState(error);
  }
}

export async function transferActivityOwnershipAction(
  _previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  try {
    const input = normalizeTransferActivityOwnershipInput({
      activityId: formData.get("activityId"),
      newOwnerId: formData.get("newOwnerId"),
    });
    const fieldErrors = validateTransferActivityOwnershipInput(input);
    if (fieldErrors.length > 0) {
      return {
        success: false,
        message: fieldErrors[0]?.message ?? "Validation failed.",
        code: "VALIDATION_FAILED",
        fieldErrors: activityFieldErrorsToRecord(fieldErrors),
      };
    }

    const result = await transferActivityOwnershipForCurrentUser(input);
    revalidateActivityPaths(result.leadId);
    return {
      success: true,
      message: "Activity owner updated.",
      activityId: result.id,
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        ...toActivityActionState(error),
        fieldErrors: fieldErrorsForDbCode(error.code),
      };
    }
    return toActivityActionState(error);
  }
}

export async function designatePrimaryNextActionAction(
  _previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  try {
    const input = normalizeDesignatePrimaryNextActionInput({
      activityId: formData.get("activityId"),
    });
    const fieldErrors = validateDesignatePrimaryNextActionInput(input);
    if (fieldErrors.length > 0) {
      return {
        success: false,
        message: fieldErrors[0]?.message ?? "Validation failed.",
        code: "VALIDATION_FAILED",
        fieldErrors: activityFieldErrorsToRecord(fieldErrors),
      };
    }

    const result = await designatePrimaryNextActionForCurrentUser(input);
    revalidateActivityPaths(result.leadId);
    return {
      success: true,
      message: "Primary next action updated.",
      activityId: result.id,
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    return toActivityActionState(error);
  }
}

export async function completeLeadActivityAction(
  _previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  try {
    const input = normalizeCompleteLeadActivityInput({
      activityId: formData.get("activityId"),
      outcomeCode: formData.get("outcomeCode"),
      completionNote: formData.get("completionNote"),
      whatsappSendIntentId: formData.get("whatsappSendIntentId"),
      resolution: formData.get("resolution"),
      nextActivityType: formData.get("nextActivityType"),
      nextTitle: formData.get("nextTitle"),
      nextDueAt: formData.get("nextDueAt"),
      nextPriority: formData.get("nextPriority"),
      nextDurationMinutes: formData.get("nextDurationMinutes"),
      nextReminderAt: formData.get("nextReminderAt"),
      nextQuotationId: formData.get("nextQuotationId"),
      onHoldReason: formData.get("onHoldReason"),
      onHoldReviewAt: formData.get("onHoldReviewAt"),
      closedLostReason: formData.get("closedLostReason"),
      closureReasonCode: formData.get("closureReasonCode"),
    });
    const fieldErrors = validateCompleteLeadActivityInput(input);
    if (fieldErrors.length > 0) {
      return {
        success: false,
        message: fieldErrors[0]?.message ?? "Validation failed.",
        code: "VALIDATION_FAILED",
        fieldErrors: activityFieldErrorsToRecord(fieldErrors),
      };
    }

    const result = await completeLeadActivityForCurrentUser(input);
    revalidateActivityPaths(result.leadId);

    let message = "Activity completed.";
    if (input.resolution === "ON_HOLD") {
      message = "Activity completed and lead placed on hold.";
    } else if (input.resolution === "CLOSED_LOST") {
      message = "Activity completed and lead closed lost.";
    }

    return {
      success: true,
      message,
      activityId: result.id,
      leadId: result.leadId,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      return {
        ...toActivityActionState(error),
        fieldErrors: fieldErrorsForDbCode(error.code),
      };
    }
    return toActivityActionState(error);
  }
}
