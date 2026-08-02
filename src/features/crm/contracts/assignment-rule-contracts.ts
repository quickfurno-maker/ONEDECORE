/**
 * Phase 5D — source-based lead assignment rule contracts.
 */

import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_SERVICE_CODES,
  type LeadBudgetComfortCode,
  type LeadServiceCode,
} from "../../lead-intake/planner-allowlist.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LeadAssignmentRuleSummary {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceDisplayName: string | null;
  readonly serviceCode: LeadServiceCode | null;
  readonly localityNormalized: string | null;
  readonly budgetComfortCode: LeadBudgetComfortCode | null;
  readonly targetUserId: string;
  readonly targetDisplayName: string | null;
  readonly priority: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateLeadAssignmentRuleInput {
  readonly sourceId: string;
  readonly targetUserId: string;
  readonly priority: number;
  readonly serviceCode?: LeadServiceCode | string | null;
  readonly locality?: string | null;
  readonly budgetComfortCode?: LeadBudgetComfortCode | string | null;
}

export interface UpdateLeadAssignmentRuleInput {
  readonly ruleId: string;
  readonly targetUserId?: string | null;
  readonly priority?: number | null;
  readonly serviceCode?: LeadServiceCode | null;
  readonly locality?: string | null;
  readonly budgetComfortCode?: LeadBudgetComfortCode | null;
}

export interface AssignmentRuleActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export interface AssignmentRuleValidationError {
  readonly field: string;
  readonly message: string;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isAllowed<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function validateCreateLeadAssignmentRuleInput(
  input: CreateLeadAssignmentRuleInput
): readonly AssignmentRuleValidationError[] {
  const errors: AssignmentRuleValidationError[] = [];

  if (!isUuid(input.sourceId)) {
    errors.push({ field: "sourceId", message: "A valid lead source is required." });
  }

  if (!isUuid(input.targetUserId)) {
    errors.push({ field: "targetUserId", message: "A valid assignee is required." });
  }

  if (!Number.isInteger(input.priority) || input.priority <= 0) {
    errors.push({ field: "priority", message: "Priority must be a positive integer." });
  }

  if (
    input.serviceCode != null &&
    !isAllowed(input.serviceCode, LEAD_SERVICE_CODES)
  ) {
    errors.push({ field: "serviceCode", message: "Invalid service code." });
  }

  if (
    input.budgetComfortCode != null &&
    !isAllowed(input.budgetComfortCode, LEAD_BUDGET_COMFORT_CODES)
  ) {
    errors.push({ field: "budgetComfortCode", message: "Invalid budget code." });
  }

  const locality = normalizeOptionalText(input.locality);
  if (locality != null && locality.length > 120) {
    errors.push({ field: "locality", message: "Locality must be at most 120 characters." });
  }

  return errors;
}

export function validateAssignmentRuleInput(
  input: CreateLeadAssignmentRuleInput
): readonly AssignmentRuleValidationError[] {
  return validateCreateLeadAssignmentRuleInput(input);
}

export function validateUpdateLeadAssignmentRuleInput(
  input: UpdateLeadAssignmentRuleInput
): readonly AssignmentRuleValidationError[] {
  const errors: AssignmentRuleValidationError[] = [];

  if (!isUuid(input.ruleId)) {
    errors.push({ field: "ruleId", message: "Rule id is required." });
  }

  if (
    input.targetUserId != null &&
    input.targetUserId.length > 0 &&
    !isUuid(input.targetUserId)
  ) {
    errors.push({ field: "targetUserId", message: "Invalid assignee selection." });
  }

  if (
    input.priority != null &&
    (!Number.isInteger(input.priority) || input.priority <= 0)
  ) {
    errors.push({ field: "priority", message: "Priority must be a positive integer." });
  }

  if (
    input.serviceCode != null &&
    input.serviceCode.length > 0 &&
    !isAllowed(input.serviceCode, LEAD_SERVICE_CODES)
  ) {
    errors.push({ field: "serviceCode", message: "Invalid service code." });
  }

  if (
    input.budgetComfortCode != null &&
    input.budgetComfortCode.length > 0 &&
    !isAllowed(input.budgetComfortCode, LEAD_BUDGET_COMFORT_CODES)
  ) {
    errors.push({ field: "budgetComfortCode", message: "Invalid budget code." });
  }

  const locality = normalizeOptionalText(input.locality);
  if (locality != null && locality.length > 120) {
    errors.push({ field: "locality", message: "Locality must be at most 120 characters." });
  }

  return errors;
}
