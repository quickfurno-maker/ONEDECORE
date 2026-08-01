"use server";

import { revalidatePath } from "next/cache";
import type { LeadAssignmentIntent } from "../contracts/assignment-contracts.ts";
import { assignLeadForCurrentUser } from "./crm-assignment-service.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

export interface LeadAssignmentActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?:
    | "AUTH_REQUIRED"
    | "PERMISSION_DENIED"
    | "LEAD_NOT_FOUND"
    | "INVALID_ASSIGNMENT"
    | "ASSIGNMENT_CONFLICT"
    | "OPEN_FOLLOW_UPS_BLOCK_ASSIGNMENT"
    | "VALIDATION_FAILED"
    | "RPC_FAILED";
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function emptyFieldErrors(): Record<string, string> {
  return {};
}

function parseIntent(value: FormDataEntryValue | null): LeadAssignmentIntent | null {
  if (value === "assign" || value === "reassign" || value === "unassign") {
    return value;
  }
  return null;
}

function parseNullableUuid(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim();
  if (raw.length === 0 || raw === "null") {
    return null;
  }
  return raw;
}

export async function assignLeadAction(
  _previousState: LeadAssignmentActionState,
  formData: FormData
): Promise<LeadAssignmentActionState> {
  const intent = parseIntent(formData.get("intent"));
  const leadId = String(formData.get("leadId") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "").trim();
  const reasonRaw = formData.get("reason");
  const reason =
    reasonRaw == null ? null : String(reasonRaw).trim().length === 0 ? null : String(reasonRaw);

  if (!intent) {
    return {
      success: false,
      message: "Invalid assignment request.",
      code: "VALIDATION_FAILED",
      fieldErrors: { intent: "Assignment intent is required." },
    };
  }

  const targetAssigneeId = parseNullableUuid(formData.get("targetAssigneeId"));
  const expectedAssigneeId = parseNullableUuid(formData.get("expectedAssigneeId"));

  try {
    await assignLeadForCurrentUser({
      leadId,
      targetAssigneeId: intent === "unassign" ? null : targetAssigneeId,
      reason,
      expectedAssigneeId,
      expectedUpdatedAt,
      intent,
    });

    revalidatePath("/admin/crm/leads");
    revalidatePath(`/admin/crm/leads/${leadId}`);

    const successMessage =
      intent === "unassign"
        ? "Lead unassigned successfully."
        : intent === "reassign"
          ? "Lead reassigned successfully."
          : "Lead assigned successfully.";

    return {
      success: true,
      message: successMessage,
    };
  } catch (error: unknown) {
    if (error instanceof CrmError) {
      const fieldErrors = emptyFieldErrors();
      if (error.code === "VALIDATION_FAILED") {
        fieldErrors.reason = error.message;
      }

      return {
        success: false,
        message: error.message,
        code:
          error.code === "INVALID_TRANSITION"
            ? "INVALID_ASSIGNMENT"
            : error.code,
        fieldErrors,
      };
    }

    const mapped = crmErrorFromPostgresMessage(
      error instanceof Error ? error.message : "CRM operation failed"
    );

    return {
      success: false,
      message: mapped.message,
      code:
        mapped.code === "INVALID_TRANSITION"
          ? "INVALID_ASSIGNMENT"
          : mapped.code,
      fieldErrors: emptyFieldErrors(),
    };
  }
}
