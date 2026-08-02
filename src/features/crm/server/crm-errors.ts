import "server-only";

export type CrmErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "LEAD_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INVALID_ASSIGNMENT"
  | "ASSIGNMENT_CONFLICT"
  | "OPEN_FOLLOW_UPS_BLOCK_ASSIGNMENT"
  | "VALIDATION_FAILED"
  | "INVALID_MANUAL_LEAD"
  | "CONTACT_IDENTITY_CONFLICT"
  | "ACTIVE_DUPLICATE"
  | "RECENT_SIMILAR_DUPLICATE"
  | "DUPLICATE_OVERRIDE_REQUIRED"
  | "DUPLICATE_OVERRIDE_DENIED"
  | "INVALID_ASSIGNEE"
  | "INACTIVE_SOURCE"
  | "LEAD_CREATE_FAILED"
  | "FOLLOW_UP_NOT_FOUND"
  | "FOLLOW_UP_NOT_OPEN"
  | "RPC_FAILED";

export class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: CrmErrorCode;
    message: string;
    httpStatus: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "CrmError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

export function crmErrorFromPostgresMessage(
  message: string,
  fallbackCode: CrmErrorCode = "RPC_FAILED"
): CrmError {
  const normalised = message.toLowerCase();

  if (
    normalised.includes("crm_assignment_auth_required") ||
    normalised.includes("authentication required")
  ) {
    return new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (
    normalised.includes("crm_assignment_permission_denied") ||
    normalised.includes("permission denied") ||
    normalised.includes("not visible")
  ) {
    return new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (
    normalised.includes("follow-up") &&
    normalised.includes("not found")
  ) {
    return new CrmError({
      code: "FOLLOW_UP_NOT_FOUND",
      message: "Follow-up not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (
    normalised.includes("crm_assignment_lead_not_found") ||
    normalised.includes("not found")
  ) {
    return new CrmError({
      code: "LEAD_NOT_FOUND",
      message: "Lead not found",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("crm_assignment_stale")) {
    return new CrmError({
      code: "ASSIGNMENT_CONFLICT",
      message:
        "This lead was updated by someone else. Refresh the page and review the current assignment before trying again.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("crm_assignment_open_follow_ups")) {
    return new CrmError({
      code: "OPEN_FOLLOW_UPS_BLOCK_ASSIGNMENT",
      message:
        "Open follow-ups must be resolved before this assignment change can proceed.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("invalid lead status transition")) {
    return new CrmError({
      code: "INVALID_TRANSITION",
      message: "Invalid lead status transition",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("on-hold requires") ||
    normalised.includes("on-hold lead may resume")
  ) {
    return new CrmError({
      code: "VALIDATION_FAILED",
      message: "On-hold reason or resume target is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("invalid closure reason code") ||
    normalised.includes("closed_lost_requires_reason")
  ) {
    return new CrmError({
      code: "VALIDATION_FAILED",
      message: "Closed-lost reason or note is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("only open follow-ups can be")) {
    return new CrmError({
      code: "FOLLOW_UP_NOT_OPEN",
      message: "Only open follow-ups can be updated.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("permission denied to manage follow-ups") ||
    normalised.includes("permission denied to transition lead status")
  ) {
    return new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("invalid owner")) {
    return new CrmError({
      code: "VALIDATION_FAILED",
      message: "Follow-up owner selection is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("append-only") ||
    normalised.includes("lead_notes")
  ) {
    return new CrmError({
      code: "VALIDATION_FAILED",
      message: "Note could not be saved.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("closed_won_requires_quotation_acceptance") ||
    normalised.includes("closed_lost_requires_reason") ||
    normalised.includes("terminal lead status") ||
    normalised.includes("crm_assignment_terminal")
  ) {
    return new CrmError({
      code: "INVALID_TRANSITION",
      message: "Lead status transition rejected",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("crm_assignment_target_invalid") ||
    normalised.includes("crm_assignment_unsafe_unassign") ||
    normalised.includes("crm_assignment_reason_required") ||
    normalised.includes("crm_assignment_reason_invalid") ||
    normalised.includes("crm_manual_lead_invalid_assignee") ||
    normalised.includes("crm_manual_lead_assignee_forbidden") ||
    normalised.includes("assignee is not an active eligible sales user") ||
    normalised.includes("invalid assignment method")
  ) {
    return new CrmError({
      code: normalised.includes("crm_manual_lead")
        ? "INVALID_ASSIGNEE"
        : "INVALID_ASSIGNMENT",
      message: normalised.includes("crm_manual_lead")
        ? "Lead assignee selection is invalid."
        : "Lead assignment rejected",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_manual_lead_auth_required")) {
    return new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (
    normalised.includes("crm_manual_lead_permission_denied") ||
    normalised.includes("crm_manual_lead_duplicate_override_denied")
  ) {
    return new CrmError({
      code: normalised.includes("duplicate_override_denied")
        ? "DUPLICATE_OVERRIDE_DENIED"
        : "PERMISSION_DENIED",
      message: normalised.includes("duplicate_override_denied")
        ? "You are not allowed to override this duplicate warning."
        : "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_manual_lead_contact_identity_conflict")) {
    return new CrmError({
      code: "CONTACT_IDENTITY_CONFLICT",
      message:
        "The phone number and email map to different existing client records. Contact a manager or administrator for review.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("crm_manual_lead_active_duplicate")) {
    return new CrmError({
      code: "ACTIVE_DUPLICATE",
      message:
        "A similar active enquiry already exists. Use the existing lead instead of creating a duplicate.",
      httpStatus: 409,
      details: message,
    });
  }

  if (
    normalised.includes("crm_manual_lead_duplicate_override_required") ||
    normalised.includes("crm_manual_lead_recent")
  ) {
    return new CrmError({
      code: normalised.includes("override_required")
        ? "DUPLICATE_OVERRIDE_REQUIRED"
        : "RECENT_SIMILAR_DUPLICATE",
      message: normalised.includes("override_required")
        ? "A recent similar enquiry requires manager approval to proceed."
        : "A similar enquiry was closed recently. Contact your sales manager to proceed.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("crm_manual_lead_inactive_source")) {
    return new CrmError({
      code: "INACTIVE_SOURCE",
      message: "The selected lead source is inactive.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("crm_manual_lead_invalid") ||
    normalised.includes("crm_manual_lead_contact_required") ||
    normalised.includes("crm_manual_lead_duplicate_override_reason_invalid")
  ) {
    return new CrmError({
      code: "INVALID_MANUAL_LEAD",
      message: "Manual lead details are invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_manual_lead")) {
    return new CrmError({
      code: "LEAD_CREATE_FAILED",
      message: "Manual lead creation failed.",
      httpStatus: 500,
      details: message,
    });
  }

  return new CrmError({
    code: fallbackCode,
    message: "CRM operation failed",
    httpStatus: 500,
    details: message,
  });
}
