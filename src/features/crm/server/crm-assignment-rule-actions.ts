"use server";

import { revalidatePath } from "next/cache";
import type { AssignmentRuleActionState } from "../contracts/assignment-rule-contracts.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_SERVICE_CODES,
  type LeadBudgetComfortCode,
  type LeadServiceCode,
} from "@/features/lead-intake/planner-allowlist";
import { requireCrmAssignmentRuleAccess } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  createLeadAssignmentRuleForCurrentUser,
  setLeadAssignmentRuleActiveForCurrentUser,
  updateLeadAssignmentRuleForCurrentUser,
} from "./crm-assignment-rule-service.ts";

function toAssignmentRuleActionState(error: unknown): AssignmentRuleActionState {
  if (error instanceof CrmError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "Assignment rule operation failed"
  );
  return {
    success: false,
    message: mapped.message,
    code: mapped.code,
  };
}

function parseNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isAllowed<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value);
}

export async function createLeadAssignmentRuleAction(
  _previousState: AssignmentRuleActionState,
  formData: FormData
): Promise<AssignmentRuleActionState> {
  await requireCrmAssignmentRuleAccess();

  const serviceRaw = parseNullableString(formData.get("serviceCode"));
  const budgetRaw = parseNullableString(formData.get("budgetComfortCode"));

  try {
    await createLeadAssignmentRuleForCurrentUser({
      sourceId: String(formData.get("sourceId") ?? ""),
      targetUserId: String(formData.get("targetUserId") ?? ""),
      priority: Number.parseInt(String(formData.get("priority") ?? ""), 10),
      serviceCode:
        serviceRaw && isAllowed(serviceRaw, LEAD_SERVICE_CODES)
          ? (serviceRaw as LeadServiceCode)
          : null,
      locality: parseNullableString(formData.get("locality")),
      budgetComfortCode:
        budgetRaw && isAllowed(budgetRaw, LEAD_BUDGET_COMFORT_CODES)
          ? (budgetRaw as LeadBudgetComfortCode)
          : null,
    });

    revalidatePath("/admin/crm/settings/assignment-rules");
    return {
      success: true,
      message: "Assignment rule created.",
    };
  } catch (error: unknown) {
    return toAssignmentRuleActionState(error);
  }
}

export async function updateLeadAssignmentRuleAction(
  _previousState: AssignmentRuleActionState,
  formData: FormData
): Promise<AssignmentRuleActionState> {
  await requireCrmAssignmentRuleAccess();

  const serviceRaw = parseNullableString(formData.get("serviceCode"));
  const budgetRaw = parseNullableString(formData.get("budgetComfortCode"));
  const priorityRaw = parseNullableString(formData.get("priority"));

  try {
    await updateLeadAssignmentRuleForCurrentUser({
      ruleId: String(formData.get("ruleId") ?? ""),
      targetUserId: parseNullableString(formData.get("targetUserId")),
      priority:
        priorityRaw == null ? null : Number.parseInt(priorityRaw, 10),
      serviceCode:
        serviceRaw && isAllowed(serviceRaw, LEAD_SERVICE_CODES)
          ? (serviceRaw as LeadServiceCode)
          : null,
      locality: parseNullableString(formData.get("locality")),
      budgetComfortCode:
        budgetRaw && isAllowed(budgetRaw, LEAD_BUDGET_COMFORT_CODES)
          ? (budgetRaw as LeadBudgetComfortCode)
          : null,
    });

    revalidatePath("/admin/crm/settings/assignment-rules");
    return {
      success: true,
      message: "Assignment rule updated.",
    };
  } catch (error: unknown) {
    return toAssignmentRuleActionState(error);
  }
}

export async function setLeadAssignmentRuleActiveAction(
  _previousState: AssignmentRuleActionState,
  formData: FormData
): Promise<AssignmentRuleActionState> {
  await requireCrmAssignmentRuleAccess();

  const ruleId = String(formData.get("ruleId") ?? "");
  const isActive = formData.get("isActive") === "true";

  try {
    await setLeadAssignmentRuleActiveForCurrentUser(ruleId, isActive);
    revalidatePath("/admin/crm/settings/assignment-rules");
    return {
      success: true,
      message: isActive ? "Assignment rule enabled." : "Assignment rule disabled.",
    };
  } catch (error: unknown) {
    return toAssignmentRuleActionState(error);
  }
}
