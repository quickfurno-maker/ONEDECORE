/**
 * Deleting an enquiry — the contract shared by the form, the action and the RPC.
 *
 * DELETE IS NOT CLOSED LOST
 *
 * Marking an enquiry CLOSED LOST is the sales team's ordinary lifecycle
 * transition: it needs a reason and a note, and the enquiry stays in CRM
 * history where reporting can still see it. Deleting one removes it from every
 * operational surface and is the owner's alone. They share no permission, no
 * code path and no wording, and this module exists so they never start to.
 *
 * Nothing here is authority. The database RPC checks the permission AND the
 * role and is the only thing that can actually delete; these rules exist so the
 * owner is told what is wrong before a destructive call is made, not instead of
 * the server checking.
 */

/** Typed by hand, exactly, before anything is deleted. */
export const LEAD_DELETE_CONFIRMATION = "DELETE";

export const LEAD_DELETE_REASON_MIN = 10;
export const LEAD_DELETE_REASON_MAX = 500;

export interface LeadDeleteInput {
  readonly leadId: string;
  readonly reason: string;
  /**
   * The `updated_at` the owner was looking at.
   *
   * If the enquiry moved since the page rendered — reassigned, transitioned, a
   * note added — the delete is refused rather than applied to a lead they have
   * not actually seen.
   */
  readonly expectedUpdatedAt: string;
  readonly confirmation: string;
}

export type LeadDeleteFieldName = "reason" | "confirmation" | "leadId";

export interface LeadDeleteFieldError {
  readonly field: LeadDeleteFieldName;
  readonly message: string;
}

export interface LeadDeleteActionState {
  readonly success: boolean;
  readonly message: string | null;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Partial<Record<LeadDeleteFieldName, string>>>;
}

export const LEAD_DELETE_IDLE_STATE: LeadDeleteActionState = {
  success: false,
  message: null,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateLeadDeleteInput(
  input: Partial<LeadDeleteInput>
): readonly LeadDeleteFieldError[] {
  const errors: LeadDeleteFieldError[] = [];

  if (!input.leadId || !UUID.test(input.leadId)) {
    errors.push({ field: "leadId", message: "Enquiry reference is missing." });
  }

  const reason = (input.reason ?? "").trim();
  if (reason.length < LEAD_DELETE_REASON_MIN) {
    errors.push({
      field: "reason",
      message: `Give a reason of at least ${LEAD_DELETE_REASON_MIN} characters.`,
    });
  } else if (reason.length > LEAD_DELETE_REASON_MAX) {
    errors.push({
      field: "reason",
      message: `Keep the reason under ${LEAD_DELETE_REASON_MAX} characters.`,
    });
  }

  // Exact, case-sensitive. A destructive action should cost a deliberate keystroke.
  if (input.confirmation !== LEAD_DELETE_CONFIRMATION) {
    errors.push({
      field: "confirmation",
      message: `Type ${LEAD_DELETE_CONFIRMATION} exactly to confirm.`,
    });
  }

  return errors;
}

export function leadDeleteFieldErrorsToRecord(
  errors: readonly LeadDeleteFieldError[]
): Readonly<Partial<Record<LeadDeleteFieldName, string>>> {
  const record: Partial<Record<LeadDeleteFieldName, string>> = {};
  for (const error of errors) {
    record[error.field] ??= error.message;
  }
  return record;
}
