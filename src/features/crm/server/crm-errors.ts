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
  | "ACTIVITY_NOT_FOUND"
  | "ACTIVITY_NOT_OPEN"
  | "ACTIVITY_OWNER_NOT_AUTHORIZED"
  | "ACTIVITY_TYPE_INVALID"
  | "ACTIVITY_TITLE_INVALID"
  | "ACTIVITY_PRIORITY_INVALID"
  | "ACTIVITY_DUE_REQUIRED"
  | "ACTIVITY_DUE_MUST_BE_FUTURE"
  | "ACTIVITY_DURATION_INVALID"
  | "ACTIVITY_REMINDER_INVALID"
  | "ACTIVITY_QUOTATION_MISMATCH"
  | "ACTIVITY_TERMINAL_REJECTED"
  | "ACTIVITY_OUTCOME_REQUIRED"
  | "ACTIVITY_OUTCOME_INVALID"
  | "ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE"
  | "PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT"
  | "ON_HOLD_PRIMARY_RESERVED"
  | "ON_HOLD_REVIEW_REQUIRED"
  | "NEXT_ACTION_REQUIRED"
  | "NEXT_PRIMARY_INVALID"
  | "WHATSAPP_SEND_EVIDENCE_REQUIRED"
  | "WHATSAPP_SEND_EVIDENCE_INVALID"
  | "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE"
  | "CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED"
  | "CRM_STAGE_GATE_CONSULTATION_REQUIRED"
  | "CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED"
  | "CADENCE_AUTH_REQUIRED"
  | "CADENCE_PERMISSION_DENIED"
  | "CADENCE_TEMPLATE_NOT_FOUND"
  | "CADENCE_TEMPLATE_NOT_EDITABLE"
  | "CADENCE_TEMPLATE_NOT_PUBLISHED"
  | "CADENCE_TEMPLATE_REQUIRES_STEPS"
  | "CADENCE_TEMPLATE_NAME_TAKEN"
  | "CADENCE_TEMPLATE_INVALID"
  | "CADENCE_STEP_INVALID"
  | "CADENCE_ENROLLMENT_NOT_FOUND"
  | "CADENCE_ENROLLMENT_EXISTS"
  | "CADENCE_ENROLLMENT_NOT_ACTIVE"
  | "CADENCE_ENROLLMENT_NOT_PAUSED"
  | "CADENCE_LEAD_NOT_ELIGIBLE"
  | "CADENCE_NEXT_STEP_UNAVAILABLE"
  | "CADENCE_ACTIVITY_NOT_CADENCE"
  | "IMPORT_AUTH_REQUIRED"
  | "IMPORT_PERMISSION_DENIED"
  | "IMPORT_BATCH_NOT_FOUND"
  | "IMPORT_BATCH_ACCESS_DENIED"
  | "IMPORT_BATCH_NOT_EDITABLE"
  | "IMPORT_BATCH_NOT_VALIDATABLE"
  | "IMPORT_BATCH_NOT_SUBMITTABLE"
  | "IMPORT_BATCH_NOT_APPROVABLE"
  | "IMPORT_BATCH_NOT_REJECTABLE"
  | "IMPORT_BATCH_NOT_CONFIRMABLE"
  | "IMPORT_BATCH_NOT_CANCELLABLE"
  | "IMPORT_BATCH_NOT_PROCESSABLE"
  | "IMPORT_STALE_REVISION"
  | "IMPORT_INVALID_MAPPING"
  | "IMPORT_INVALID_ROWS"
  | "IMPORT_NO_IMPORTABLE_ROWS"
  | "IMPORT_APPROVE_DENIED"
  | "IMPORT_APPROVER_CANNOT_BE_CREATOR"
  | "IMPORT_DIRECT_CONFIRM_SA_ONLY"
  | "IMPORT_FILE_TOO_LARGE"
  | "IMPORT_TOO_MANY_ROWS"
  | "IMPORT_TOO_MANY_COLUMNS"
  | "IMPORT_EMPTY_FILE"
  | "IMPORT_FORMULA_REJECTED"
  | "IMPORT_INVALID_FILE_TYPE"
  | "ASSIGNMENT_RULE_AUTH_REQUIRED"
  | "ASSIGNMENT_RULE_PERMISSION_DENIED"
  | "ASSIGNMENT_RULE_NOT_FOUND"
  | "ASSIGNMENT_RULE_INVALID"
  | "SALES_TARGET_AUTH_REQUIRED"
  | "SALES_TARGET_PERMISSION_DENIED"
  | "SALES_TARGET_NOT_FOUND"
  | "SALES_TARGET_INVALID"
  | "SALES_TARGET_DUPLICATE"
  | "SALES_TARGET_REVISION_MISMATCH"
  | "CRM_REPORTING_AUTH_REQUIRED"
  | "CRM_REPORTING_PERMISSION_DENIED"
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

/** Maps Postgres tokens such as CRM_IMPORT_* and CRM_ASSIGNMENT_RULE_* to app errors. */
export function crmErrorFromPostgresMessage(
  message: string,
  fallbackCode: CrmErrorCode = "RPC_FAILED"
): CrmError {
  const normalised = message.toLowerCase();

  // CRM 2C stage-gate and cadence tokens — matched FIRST so that
  // "CADENCE_TEMPLATE_NOT_FOUND" never falls through to the generic
  // "not found" -> LEAD_NOT_FOUND branch below.
  const crm2cTokenMap: ReadonlyArray<{
    readonly token: string;
    readonly code: CrmErrorCode;
    readonly message: string;
    readonly httpStatus: number;
  }> = [
    {
      token: "crm_stage_gate_first_contact_required",
      code: "CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED",
      message:
        "Record a first contact attempt before moving this lead to Contacted.",
      httpStatus: 422,
    },
    {
      token: "crm_stage_gate_consultation_required",
      code: "CRM_STAGE_GATE_CONSULTATION_REQUIRED",
      message:
        "Schedule a consultation or site visit before moving this lead to Consultation Scheduled.",
      httpStatus: 422,
    },
    {
      token: "crm_stage_gate_proposal_delivery_required",
      code: "CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED",
      message:
        "Send the finalized quotation through the controlled client-access flow before moving this lead to Proposal Sent.",
      httpStatus: 422,
    },
    {
      token: "cadence_permission_denied",
      code: "CADENCE_PERMISSION_DENIED",
      message: "You are not allowed to manage this cadence.",
      httpStatus: 403,
    },
    {
      token: "cadence_template_not_found",
      code: "CADENCE_TEMPLATE_NOT_FOUND",
      message: "Cadence template not found.",
      httpStatus: 404,
    },
    {
      token: "cadence_template_not_editable",
      code: "CADENCE_TEMPLATE_NOT_EDITABLE",
      message: "Only a draft cadence template can be edited.",
      httpStatus: 422,
    },
    {
      token: "cadence_template_not_published",
      code: "CADENCE_TEMPLATE_NOT_PUBLISHED",
      message: "Only a published cadence can be used for enrollment.",
      httpStatus: 422,
    },
    {
      token: "cadence_template_requires_steps",
      code: "CADENCE_TEMPLATE_REQUIRES_STEPS",
      message: "Add at least one step before publishing this cadence.",
      httpStatus: 422,
    },
    {
      token: "cadence_template_name_taken",
      code: "CADENCE_TEMPLATE_NAME_TAKEN",
      message: "Another active cadence already uses this name.",
      httpStatus: 422,
    },
    {
      token: "cadence_template_invalid",
      code: "CADENCE_TEMPLATE_INVALID",
      message: "Cadence name or description is invalid.",
      httpStatus: 422,
    },
    {
      token: "cadence_step_invalid",
      code: "CADENCE_STEP_INVALID",
      message: "One or more cadence steps are invalid.",
      httpStatus: 422,
    },
    {
      token: "cadence_enrollment_not_found",
      code: "CADENCE_ENROLLMENT_NOT_FOUND",
      message: "Cadence enrollment not found.",
      httpStatus: 404,
    },
    {
      token: "cadence_enrollment_exists",
      code: "CADENCE_ENROLLMENT_EXISTS",
      message: "This lead already has an active cadence.",
      httpStatus: 422,
    },
    {
      token: "cadence_enrollment_not_active",
      code: "CADENCE_ENROLLMENT_NOT_ACTIVE",
      message: "This cadence is not active.",
      httpStatus: 422,
    },
    {
      token: "cadence_enrollment_not_paused",
      code: "CADENCE_ENROLLMENT_NOT_PAUSED",
      message: "Only a paused cadence can be resumed.",
      httpStatus: 422,
    },
    {
      token: "cadence_lead_not_eligible",
      code: "CADENCE_LEAD_NOT_ELIGIBLE",
      message:
        "This lead cannot run a cadence right now. It must be assigned, active and not on hold.",
      httpStatus: 422,
    },
    {
      token: "cadence_next_step_unavailable",
      code: "CADENCE_NEXT_STEP_UNAVAILABLE",
      message:
        "This cadence has no further steps. Choose the next action for this lead.",
      httpStatus: 422,
    },
    {
      token: "cadence_activity_not_cadence",
      code: "CADENCE_ACTIVITY_NOT_CADENCE",
      message: "This activity was not created by a cadence.",
      httpStatus: 422,
    },
  ];

  for (const entry of crm2cTokenMap) {
    if (normalised.includes(entry.token)) {
      return new CrmError({
        code: entry.code,
        message: entry.message,
        httpStatus: entry.httpStatus,
        details: message,
      });
    }
  }

  // CRM 2A-3 activity tokens — match BEFORE generic "not found" / "permission denied".
  const activityTokenMap: ReadonlyArray<{
    readonly token: string;
    readonly code: CrmErrorCode;
    readonly message: string;
    readonly httpStatus: number;
  }> = [
    {
      token: "activity_not_found",
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found.",
      httpStatus: 404,
    },
    {
      token: "activity_not_open",
      code: "ACTIVITY_NOT_OPEN",
      message: "This activity is no longer open.",
      httpStatus: 422,
    },
    {
      token: "activity_owner_not_authorized",
      code: "ACTIVITY_OWNER_NOT_AUTHORIZED",
      message: "You are not allowed to perform this activity action.",
      httpStatus: 403,
    },
    {
      token: "activity_type_invalid",
      code: "ACTIVITY_TYPE_INVALID",
      message: "Activity type is invalid.",
      httpStatus: 422,
    },
    {
      token: "activity_title_invalid",
      code: "ACTIVITY_TITLE_INVALID",
      message: "Activity title must be 1–120 characters.",
      httpStatus: 422,
    },
    {
      token: "activity_priority_invalid",
      code: "ACTIVITY_PRIORITY_INVALID",
      message: "Activity priority is invalid.",
      httpStatus: 422,
    },
    {
      token: "activity_due_required",
      code: "ACTIVITY_DUE_REQUIRED",
      message: "Due date and time are required.",
      httpStatus: 422,
    },
    {
      token: "activity_due_must_be_future",
      code: "ACTIVITY_DUE_MUST_BE_FUTURE",
      message: "Due date and time must be in the future.",
      httpStatus: 422,
    },
    {
      token: "activity_duration_invalid",
      code: "ACTIVITY_DURATION_INVALID",
      message: "Duration must be between 1 and 1440 minutes.",
      httpStatus: 422,
    },
    {
      token: "activity_reminder_invalid",
      code: "ACTIVITY_REMINDER_INVALID",
      message: "Reminder must be at or before the due time.",
      httpStatus: 422,
    },
    {
      token: "activity_quotation_mismatch",
      code: "ACTIVITY_QUOTATION_MISMATCH",
      message: "Quotation does not belong to this lead.",
      httpStatus: 422,
    },
    {
      token: "activity_terminal_rejected",
      code: "ACTIVITY_TERMINAL_REJECTED",
      message: "This action is not allowed on a closed lead.",
      httpStatus: 422,
    },
    {
      token: "activity_outcome_required",
      code: "ACTIVITY_OUTCOME_REQUIRED",
      message: "Outcome is required.",
      httpStatus: 422,
    },
    {
      token: "activity_outcome_not_allowed_for_type",
      code: "ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE",
      message: "Outcome is not allowed for this activity type.",
      httpStatus: 422,
    },
    {
      token: "activity_outcome_invalid",
      code: "ACTIVITY_OUTCOME_INVALID",
      message: "Outcome is invalid.",
      httpStatus: 422,
    },
    {
      token: "primary_transfer_requires_lead_reassignment",
      code: "PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT",
      message: "Primary next-action ownership follows lead assignment.",
      httpStatus: 422,
    },
    {
      token: "on_hold_primary_reserved",
      code: "ON_HOLD_PRIMARY_RESERVED",
      message: "On-hold primary is reserved for the review task.",
      httpStatus: 422,
    },
    {
      token: "on_hold_review_required",
      code: "ON_HOLD_REVIEW_REQUIRED",
      message: "On-hold reason and future review time are required.",
      httpStatus: 422,
    },
    {
      token: "next_action_required",
      code: "NEXT_ACTION_REQUIRED",
      message: "Choose the next action before completing this activity.",
      httpStatus: 422,
    },
    {
      token: "next_primary_invalid",
      code: "NEXT_PRIMARY_INVALID",
      message: "Next primary activity details are invalid.",
      httpStatus: 422,
    },
    {
      token: "whatsapp_send_evidence_required",
      code: "WHATSAPP_SEND_EVIDENCE_REQUIRED",
      message:
        "This WhatsApp activity can only be marked sent after a governed message is sent.",
      httpStatus: 422,
    },
    {
      token: "whatsapp_send_evidence_invalid",
      code: "WHATSAPP_SEND_EVIDENCE_INVALID",
      message: "The linked WhatsApp send could not be verified.",
      httpStatus: 422,
    },
    {
      token: "closed_won_requires_quotation_acceptance",
      code: "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE",
      message: "Closed Won is created only through accepted quotation.",
      httpStatus: 422,
    },
  ];

  for (const entry of activityTokenMap) {
    if (normalised.includes(entry.token)) {
      return new CrmError({
        code: entry.code,
        message: entry.message,
        httpStatus: entry.httpStatus,
        details: message,
      });
    }
  }

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

  if (normalised.includes("crm_import_auth_required")) {
    return new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (
    normalised.includes("crm_import_permission_denied") ||
    normalised.includes("crm_import_batch_access_denied") ||
    normalised.includes("crm_import_cancel_denied")
  ) {
    return new CrmError({
      code: "IMPORT_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_import_approve_denied")) {
    return new CrmError({
      code: "IMPORT_APPROVE_DENIED",
      message: "You are not allowed to approve import batches.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_import_approver_cannot_be_creator")) {
    return new CrmError({
      code: "IMPORT_APPROVER_CANNOT_BE_CREATOR",
      message: "You cannot approve an import batch you created.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_import_direct_confirm_sa_only")) {
    return new CrmError({
      code: "IMPORT_DIRECT_CONFIRM_SA_ONLY",
      message: "Only super admins can confirm direct imports.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_found")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_FOUND",
      message: "Import batch not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("crm_import_stale_revision")) {
    return new CrmError({
      code: "IMPORT_STALE_REVISION",
      message:
        "This import batch was updated elsewhere. Refresh and try again.",
      httpStatus: 409,
      details: message,
    });
  }

  if (
    normalised.includes("active_duplicate") ||
    normalised.includes("crm_import_contact_identity_conflict")
  ) {
    return new CrmError({
      code: "ACTIVE_DUPLICATE",
      message: "Duplicate lead blocked for import.",
      httpStatus: 409,
      details: message,
    });
  }

  if (
    normalised.includes("crm_import_invalid_mapping") ||
    normalised.includes("crm_import_invalid_mapping_key") ||
    normalised.includes("crm_import_invalid_mapping_field")
  ) {
    return new CrmError({
      code: "IMPORT_INVALID_MAPPING",
      message: "Column mapping is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("crm_import_invalid_rows_payload") ||
    normalised.includes("crm_import_row_count_out_of_bounds")
  ) {
    return new CrmError({
      code: "IMPORT_INVALID_ROWS",
      message: "Import rows payload is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_no_importable_rows")) {
    return new CrmError({
      code: "IMPORT_NO_IMPORTABLE_ROWS",
      message: "No importable rows are available for submission.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_editable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_EDITABLE",
      message: "This import batch can no longer be edited.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_validatable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_VALIDATABLE",
      message: "This import batch cannot be validated in its current state.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_submittable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_SUBMITTABLE",
      message: "This import batch cannot be submitted for approval.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_approvable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_APPROVABLE",
      message: "This import batch cannot be approved.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_rejectable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_REJECTABLE",
      message: "This import batch cannot be rejected.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_confirmable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_CONFIRMABLE",
      message: "This import batch cannot be confirmed for direct import.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_cancellable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_CANCELLABLE",
      message: "This import batch cannot be cancelled.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_import_batch_not_processable")) {
    return new CrmError({
      code: "IMPORT_BATCH_NOT_PROCESSABLE",
      message: "This import batch cannot be processed.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("crm_import_invalid_file_type") ||
    normalised.includes("crm_import_invalid_file_size") ||
    normalised.includes("crm_import_invalid_file_sha256")
  ) {
    return new CrmError({
      code: "IMPORT_INVALID_FILE_TYPE",
      message: "Import file metadata is invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_assignment_rule_auth_required")) {
    return new CrmError({
      code: "ASSIGNMENT_RULE_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (normalised.includes("crm_assignment_rule_permission_denied")) {
    return new CrmError({
      code: "ASSIGNMENT_RULE_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_assignment_rule_not_found")) {
    return new CrmError({
      code: "ASSIGNMENT_RULE_NOT_FOUND",
      message: "Assignment rule not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (
    normalised.includes("crm_assignment_rule_invalid") ||
    normalised.includes("crm_assignment_rule_invalid_source") ||
    normalised.includes("crm_assignment_rule_invalid_target") ||
    normalised.includes("crm_assignment_rule_invalid_priority")
  ) {
    return new CrmError({
      code: "ASSIGNMENT_RULE_INVALID",
      message: "Assignment rule details are invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("crm_sales_target_auth_required")) {
    return new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (normalised.includes("crm_sales_target_permission_denied")) {
    return new CrmError({
      code: "SALES_TARGET_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("crm_sales_target_not_found")) {
    return new CrmError({
      code: "SALES_TARGET_NOT_FOUND",
      message: "Sales target not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("crm_sales_target_duplicate")) {
    return new CrmError({
      code: "SALES_TARGET_DUPLICATE",
      message: "A target already exists for this month and scope.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("crm_sales_target_revision_mismatch")) {
    return new CrmError({
      code: "SALES_TARGET_REVISION_MISMATCH",
      message: "This target was updated elsewhere. Refresh and try again.",
      httpStatus: 409,
      details: message,
    });
  }

  if (
    normalised.includes("crm_sales_target_invalid") ||
    normalised.includes("crm_sales_target_month_not_first_day") ||
    normalised.includes("crm_sales_target_ineligible_executive")
  ) {
    return new CrmError({
      code: "SALES_TARGET_INVALID",
      message: "Sales target details are invalid.",
      httpStatus: 422,
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
