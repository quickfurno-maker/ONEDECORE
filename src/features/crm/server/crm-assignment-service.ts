import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeAssignmentReason,
  validateLeadAssignmentInput,
  type LeadAssignmentInput,
} from "../contracts/assignment-contracts.ts";
import type { CrmLeadListRow } from "../contracts/lead-dtos.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError } from "./crm-errors.ts";
import { callAssignLead } from "./crm-transition-adapters.ts";
import { probeCanAssignLeads } from "./crm-permissions.ts";

export async function assignLeadForCurrentUser(
  input: LeadAssignmentInput
): Promise<CrmLeadListRow> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!context.canAssignLeads) {
    throw new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  const validationErrors = validateLeadAssignmentInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const supabase = await createClient();

  return callAssignLead(supabase, {
    leadId: input.leadId,
    assigneeId: input.targetAssigneeId,
    reason: normalizeAssignmentReason(input.reason),
    expectedAssigneeId: input.expectedAssigneeId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    enforceExpectedState: true,
  });
}

export async function resolveCanAssignLeadsForCurrentUser(): Promise<boolean> {
  const context = await getCrmAccessContext();
  if (!context) {
    return false;
  }

  return context.canAssignLeads;
}

export async function refreshCanAssignLeadsPermission(): Promise<boolean> {
  return probeCanAssignLeads();
}
