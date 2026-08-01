/**
 * Phase 5C2A — lead assignment mutation input contracts.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LeadAssignmentIntent = "assign" | "reassign" | "unassign";

export interface LeadAssignmentInput {
  readonly leadId: string;
  readonly targetAssigneeId: string | null;
  readonly reason: string | null;
  readonly expectedAssigneeId: string | null;
  readonly expectedUpdatedAt: string;
  readonly intent: LeadAssignmentIntent;
}

export interface LeadAssignmentValidationError {
  readonly field: string;
  readonly message: string;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeReason(reason: string | null | undefined): string | null {
  if (reason == null) {
    return null;
  }
  const trimmed = reason.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateLeadAssignmentInput(
  input: LeadAssignmentInput
): readonly LeadAssignmentValidationError[] {
  const errors: LeadAssignmentValidationError[] = [];

  if (!isUuid(input.leadId)) {
    errors.push({ field: "leadId", message: "Lead identifier is invalid." });
  }

  if (input.targetAssigneeId !== null && !isUuid(input.targetAssigneeId)) {
    errors.push({
      field: "targetAssigneeId",
      message: "Assignee identifier is invalid.",
    });
  }

  if (
    input.expectedAssigneeId !== null &&
    !isUuid(input.expectedAssigneeId)
  ) {
    errors.push({
      field: "expectedAssigneeId",
      message: "Expected assignee identifier is invalid.",
    });
  }

  if (!input.expectedUpdatedAt || Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
    errors.push({
      field: "expectedUpdatedAt",
      message: "Expected update timestamp is required.",
    });
  }

  const reason = normalizeReason(input.reason);

  if (input.intent === "assign") {
    if (input.targetAssigneeId === null) {
      errors.push({
        field: "targetAssigneeId",
        message: "An assignee is required for initial assignment.",
      });
    }
    if (reason !== null && reason.length > 500) {
      errors.push({
        field: "reason",
        message: "Reason must be 500 characters or fewer.",
      });
    }
  }

  if (input.intent === "reassign" || input.intent === "unassign") {
    if (reason === null) {
      errors.push({
        field: "reason",
        message: "A reason is required for reassignment and unassignment.",
      });
    } else if (reason.length < 10 || reason.length > 500) {
      errors.push({
        field: "reason",
        message: "Reason must be between 10 and 500 characters.",
      });
    }
  }

  if (input.intent === "unassign" && input.targetAssigneeId !== null) {
    errors.push({
      field: "targetAssigneeId",
      message: "Unassignment must not include a target assignee.",
    });
  }

  return errors;
}

export function normalizeAssignmentReason(
  reason: string | null | undefined
): string | null {
  return normalizeReason(reason);
}
