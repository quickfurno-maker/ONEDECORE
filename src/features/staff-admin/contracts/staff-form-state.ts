/**
 * Staff administration — create-form state contracts.
 *
 * The staff create form previously discarded every entered value whenever the
 * server rejected one field. This module holds the pure, framework-free pieces
 * that let the server action echo submitted values back and attach
 * *field-level* errors.
 *
 * Two rules matter here:
 *
 *  - Field errors are derived from STRUCTURED sources only: the `field` on
 *    {@link StaffValidationError}, or the `code` on a `StaffError`. No error
 *    message text is ever pattern-matched to guess a field.
 *  - Echoed values are presentation state only. `createStaffMember` re-runs the
 *    authoritative validation server-side; nothing here is trusted as valid.
 */

import type { StaffValidationError } from "./dto.ts";
import type { StaffErrorCode } from "./errors.ts";

/** Every user-editable control on the staff create form. */
export const STAFF_CREATE_FORM_FIELDS = [
  "employeeCode",
  "displayName",
  "email",
  "phoneE164",
  "designation",
  "joiningDate",
  "roleCode",
  "reportingManagerId",
  "attendanceEligible",
  "attendancePolicyId",
] as const;

export type StaffCreateFormField = (typeof STAFF_CREATE_FORM_FIELDS)[number];

/**
 * DOM order of the form controls. The client focuses the first invalid field in
 * this order so keyboard and screen-reader users land on the earliest problem
 * rather than an arbitrary one.
 */
export const STAFF_CREATE_FORM_FIELD_ORDER: readonly StaffCreateFormField[] =
  STAFF_CREATE_FORM_FIELDS;

/** Submitted values echoed back to the form after a rejected submit. */
export interface StaffCreateFormValues {
  readonly employeeCode: string;
  readonly displayName: string;
  readonly email: string;
  readonly phoneE164: string;
  readonly designation: string;
  readonly joiningDate: string;
  readonly roleCode: string;
  readonly reportingManagerId: string;
  readonly attendanceEligible: boolean;
  readonly attendancePolicyId: string;
}

export type StaffCreateFieldErrors = Partial<Record<StaffCreateFormField, string>>;

export const EMPTY_STAFF_CREATE_FORM_VALUES: StaffCreateFormValues = {
  employeeCode: "",
  displayName: "",
  email: "",
  phoneE164: "",
  designation: "",
  joiningDate: "",
  roleCode: "",
  reportingManagerId: "",
  attendanceEligible: false,
  attendancePolicyId: "",
};

/** Summary rendered above the form whenever at least one field is invalid. */
export const STAFF_FORM_CORRECTION_SUMMARY =
  "Please correct the highlighted field(s).";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return value == null ? "" : String(value).trim();
}

function readCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

/**
 * Reads every form control into a plain object so the action can echo it back
 * verbatim on failure. Values are trimmed but otherwise unmodified — the form
 * must redisplay what the user actually typed.
 */
export function readStaffCreateFormValues(formData: FormData): StaffCreateFormValues {
  return {
    employeeCode: readText(formData, "employeeCode"),
    displayName: readText(formData, "displayName"),
    email: readText(formData, "email"),
    phoneE164: readText(formData, "phoneE164"),
    designation: readText(formData, "designation"),
    joiningDate: readText(formData, "joiningDate"),
    roleCode: readText(formData, "roleCode"),
    reportingManagerId: readText(formData, "reportingManagerId"),
    attendanceEligible: readCheckbox(formData, "attendanceEligible"),
    attendancePolicyId: readText(formData, "attendancePolicyId"),
  };
}

function isStaffCreateFormField(value: string): value is StaffCreateFormField {
  return (STAFF_CREATE_FORM_FIELDS as readonly string[]).includes(value);
}

/**
 * Structured error-code → form-field mapping.
 *
 * Codes absent from this map are genuinely form-wide (permission, idempotency,
 * transport) and surface only in the banner.
 */
const STAFF_ERROR_CODE_FIELDS: Partial<Record<StaffErrorCode, StaffCreateFormField>> = {
  STAFF_EMPLOYEE_CODE_CONFLICT: "employeeCode",
  STAFF_EMAIL_INVALID: "email",
  STAFF_EMAIL_CONFLICT: "email",
  STAFF_PHONE_INVALID: "phoneE164",
  STAFF_INVALID_ROLE: "roleCode",
  STAFF_MANAGER_REQUIRED: "reportingManagerId",
  STAFF_MANAGER_INACTIVE: "reportingManagerId",
  STAFF_REPORTING_CYCLE: "reportingManagerId",
  STAFF_ATTENDANCE_POLICY_MISSING: "attendancePolicyId",
};

/** Returns the field a staff error code belongs to, or `null` when form-wide. */
export function staffErrorCodeToField(code: string): StaffCreateFormField | null {
  return (STAFF_ERROR_CODE_FIELDS as Record<string, StaffCreateFormField | undefined>)[code] ?? null;
}

/**
 * Collapses structured validation errors into one message per field. The first
 * error for a field wins so the user sees a stable, single message per control.
 */
export function toStaffCreateFieldErrors(
  errors: readonly StaffValidationError[]
): StaffCreateFieldErrors {
  const fieldErrors: Record<string, string> = {};

  for (const entry of errors) {
    if (!isStaffCreateFormField(entry.field)) {
      // clientRequestId and any future non-visible field stay form-wide.
      continue;
    }
    if (fieldErrors[entry.field] == null) {
      fieldErrors[entry.field] = entry.message;
    }
  }

  return fieldErrors as StaffCreateFieldErrors;
}

/** True when at least one visible control carries an error. */
export function hasStaffCreateFieldErrors(errors: StaffCreateFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** First invalid field in DOM order, for focus and scroll management. */
export function firstInvalidStaffCreateField(
  errors: StaffCreateFieldErrors
): StaffCreateFormField | null {
  for (const field of STAFF_CREATE_FORM_FIELD_ORDER) {
    if (errors[field] != null) {
      return field;
    }
  }
  return null;
}

/**
 * Errors that carry no visible field (permission denied, idempotency conflict,
 * transport failure) still need to reach the user through the banner.
 */
export function shouldShowFormWideMessage(
  errors: StaffCreateFieldErrors,
  message: string
): boolean {
  return message.length > 0 && !hasStaffCreateFieldErrors(errors);
}
