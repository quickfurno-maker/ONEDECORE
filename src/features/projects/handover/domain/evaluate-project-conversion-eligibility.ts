/**
 * Pure Closed-Won project conversion eligibility (ADR-0020).
 * Does not mutate leads or create projects.
 */

import type { LeadStageCode } from "../../../crm/contracts/lead-stages.ts";
import type { QuotationLifecycleState } from "../../../quotations/contracts/lifecycle.ts";

export const PROJECT_CONVERSION_ELIGIBILITY_ERROR_CODES = [
  "QUOTATION_NOT_ACCEPTED",
  "LEAD_NOT_CLOSED_WON",
  "LEAD_CLOSED_LOST",
  "LEAD_INCOMPLETE",
  "DUPLICATE_PROJECT",
  "COMMERCIAL_SNAPSHOT_MISSING",
  "ADVANCE_PAYMENT_INSUFFICIENT",
] as const;

export type ProjectConversionEligibilityErrorCode =
  (typeof PROJECT_CONVERSION_ELIGIBILITY_ERROR_CODES)[number];

export interface ProjectConversionEligibilityError {
  readonly code: ProjectConversionEligibilityErrorCode;
  readonly message: string;
}

export interface ProjectConversionEligibilityInput {
  readonly leadStage: LeadStageCode;
  readonly quotationLifecycleState: QuotationLifecycleState | string;
  readonly acceptedQuotationReference: string | null;
  readonly acceptedRevisionNumber: number | null;
  readonly hasExistingProject: boolean;
  readonly hasCommercialSnapshot: boolean;
  readonly advancePaymentReceived: boolean;
}

export interface ProjectConversionEligibilityResult {
  readonly eligible: boolean;
  readonly errors: readonly ProjectConversionEligibilityError[];
}

function error(
  code: ProjectConversionEligibilityErrorCode,
  message: string
): ProjectConversionEligibilityError {
  return { code, message };
}

export function evaluateProjectConversionEligibility(
  input: ProjectConversionEligibilityInput
): ProjectConversionEligibilityResult {
  const errors: ProjectConversionEligibilityError[] = [];

  if (input.leadStage === "closed_lost") {
    errors.push(
      error("LEAD_CLOSED_LOST", "Closed-Lost leads cannot convert to projects.")
    );
  }

  if (input.leadStage !== "closed_won") {
    errors.push(
      error(
        "LEAD_NOT_CLOSED_WON",
        "Lead must be Closed-Won before project conversion."
      )
    );
  }

  if (
    input.quotationLifecycleState !== "accepted" ||
    !input.acceptedQuotationReference?.trim() ||
    input.acceptedRevisionNumber === null ||
    input.acceptedRevisionNumber < 1
  ) {
    errors.push(
      error(
        "QUOTATION_NOT_ACCEPTED",
        "An accepted authoritative quotation is required for Closed-Won conversion."
      )
    );
  }

  if (input.hasExistingProject) {
    errors.push(
      error("DUPLICATE_PROJECT", "A project already exists for this lead.")
    );
  }

  if (!input.hasCommercialSnapshot) {
    errors.push(
      error(
        "COMMERCIAL_SNAPSHOT_MISSING",
        "Commercial snapshot from accepted quotation is required."
      )
    );
  }

  if (
    input.advancePaymentReceived &&
    input.quotationLifecycleState !== "accepted"
  ) {
    errors.push(
      error(
        "ADVANCE_PAYMENT_INSUFFICIENT",
        "Advance payment alone does not satisfy Closed-Won conversion prerequisites."
      )
    );
  }

  const incompleteStages = [
    "new",
    "assigned",
    "contacted",
    "qualified",
    "consultation_scheduled",
    "proposal_sent",
    "negotiation",
    "on_hold",
  ] as const;

  if ((incompleteStages as readonly string[]).includes(input.leadStage)) {
    errors.push(
      error(
        "LEAD_INCOMPLETE",
        "Incomplete lead pipeline stages cannot convert to projects."
      )
    );
  }

  return {
    eligible: errors.length === 0,
    errors,
  };
}
