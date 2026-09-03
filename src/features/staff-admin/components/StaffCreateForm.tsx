"use client";

import { useActionState, useEffect, useId, useMemo, useRef } from "react";
import { STAFF_ASSIGNABLE_ROLE_CODES } from "../contracts/permissions.ts";
import {
  EMPTY_STAFF_CREATE_FORM_VALUES,
  INITIAL_STAFF_FORM_STATE,
  firstInvalidStaffCreateField,
  type StaffCreateFieldErrors,
  type StaffCreateFormValues,
} from "../contracts/staff-form-state.ts";
import type { AttendancePolicyOption, ReportingManagerOption } from "../server/staff-queries.ts";
import { createStaffMemberAction } from "../server/staff-form-actions.ts";
import { ReportingManagerPicker } from "./ReportingManagerPicker.tsx";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const invalidFieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-red-500 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400";

const labelClassName = "text-sm font-medium text-neutral-200";

interface StaffCreateFormProps {
  readonly managers: readonly ReportingManagerOption[];
  readonly policies: readonly AttendancePolicyOption[];
}

function formatRoleLabel(roleCode: string): string {
  return roleCode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Renders the inline error paragraph that `aria-describedby` points at. */
function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-sm text-red-300">
      {message}
    </p>
  );
}

export function StaffCreateForm({ managers, policies }: StaffCreateFormProps) {
  const formId = useId();
  const clientRequestId = useMemo(() => crypto.randomUUID(), []);
  const [state, formAction, pending] = useActionState(
    createStaffMemberAction,
    INITIAL_STAFF_FORM_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);

  const values: StaffCreateFormValues = useMemo(
    () => state.values ?? EMPTY_STAFF_CREATE_FORM_VALUES,
    [state.values]
  );
  const fieldErrors: StaffCreateFieldErrors = useMemo(
    () => state.fieldErrors ?? {},
    [state.fieldErrors]
  );
  // Move focus to the earliest invalid control so the user is taken straight to
  // the first problem instead of hunting for the highlight.
  useEffect(() => {
    const field = firstInvalidStaffCreateField(fieldErrors);
    if (!field || !formRef.current) {
      return;
    }
    const control = formRef.current.querySelector<HTMLElement>(`[name="${field}"]`);
    if (control) {
      control.focus();
      control.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [fieldErrors]);

  const describedBy = (field: keyof StaffCreateFieldErrors, errorId: string) =>
    fieldErrors[field] ? errorId : undefined;
  const classFor = (field: keyof StaffCreateFieldErrors) =>
    fieldErrors[field] ? invalidFieldClassName : fieldClassName;

  const employeeCodeErrorId = `${formId}-employeeCode-error`;
  const displayNameErrorId = `${formId}-displayName-error`;
  const emailErrorId = `${formId}-email-error`;
  const phoneErrorId = `${formId}-phoneE164-error`;
  const designationErrorId = `${formId}-designation-error`;
  const joiningDateErrorId = `${formId}-joiningDate-error`;
  const roleCodeErrorId = `${formId}-roleCode-error`;
  const attendancePolicyErrorId = `${formId}-attendancePolicyId-error`;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6"
    >
      <input type="hidden" name="clientRequestId" value={clientRequestId} />

      {state.message ? (
        <div
          role={state.success ? "status" : "alert"}
          className={`rounded-md border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-100"
              : "border-red-900/60 bg-red-950/30 text-red-100"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-employeeCode`} className={labelClassName}>
            Employee code <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-employeeCode`}
            name="employeeCode"
            required
            defaultValue={values.employeeCode}
            aria-invalid={fieldErrors.employeeCode ? true : undefined}
            aria-describedby={describedBy("employeeCode", employeeCodeErrorId)}
            className={classFor("employeeCode")}
            autoComplete="off"
          />
          <FieldError id={employeeCodeErrorId} message={fieldErrors.employeeCode} />
        </div>
        <div>
          <label htmlFor={`${formId}-displayName`} className={labelClassName}>
            Display name <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-displayName`}
            name="displayName"
            required
            defaultValue={values.displayName}
            aria-invalid={fieldErrors.displayName ? true : undefined}
            aria-describedby={describedBy("displayName", displayNameErrorId)}
            className={classFor("displayName")}
          />
          <FieldError id={displayNameErrorId} message={fieldErrors.displayName} />
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className={labelClassName}>
            Work email (optional)
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            defaultValue={values.email}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={
              describedBy("email", emailErrorId) ?? `${formId}-email-hint`
            }
            className={classFor("email")}
          />
          <FieldError id={emailErrorId} message={fieldErrors.email} />
          {fieldErrors.email ? null : (
            <p id={`${formId}-email-hint`} className="mt-1 text-xs text-neutral-500">
              You can add app/login access later.
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${formId}-phoneE164`} className={labelClassName}>
            Phone (E.164)
          </label>
          <input
            id={`${formId}-phoneE164`}
            name="phoneE164"
            placeholder="+919876543210"
            defaultValue={values.phoneE164}
            aria-invalid={fieldErrors.phoneE164 ? true : undefined}
            aria-describedby={describedBy("phoneE164", phoneErrorId)}
            className={classFor("phoneE164")}
          />
          <FieldError id={phoneErrorId} message={fieldErrors.phoneE164} />
        </div>
        <div>
          <label htmlFor={`${formId}-designation`} className={labelClassName}>
            Designation <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-designation`}
            name="designation"
            required
            defaultValue={values.designation}
            aria-invalid={fieldErrors.designation ? true : undefined}
            aria-describedby={describedBy("designation", designationErrorId)}
            className={classFor("designation")}
          />
          <FieldError id={designationErrorId} message={fieldErrors.designation} />
        </div>
        <div>
          <label htmlFor={`${formId}-joiningDate`} className={labelClassName}>
            Joining date <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-joiningDate`}
            name="joiningDate"
            type="date"
            required
            defaultValue={values.joiningDate}
            aria-invalid={fieldErrors.joiningDate ? true : undefined}
            aria-describedby={describedBy("joiningDate", joiningDateErrorId)}
            className={classFor("joiningDate")}
          />
          <FieldError id={joiningDateErrorId} message={fieldErrors.joiningDate} />
        </div>
        <div>
          <label htmlFor={`${formId}-roleCode`} className={labelClassName}>
            Role <span className="text-amber-400">*</span>
          </label>
          <select
            id={`${formId}-roleCode`}
            name="roleCode"
            required
            defaultValue={values.roleCode}
            aria-invalid={fieldErrors.roleCode ? true : undefined}
            aria-describedby={describedBy("roleCode", roleCodeErrorId)}
            className={classFor("roleCode")}
          >
            <option value="">Select role</option>
            {STAFF_ASSIGNABLE_ROLE_CODES.map((roleCode) => (
              <option key={roleCode} value={roleCode}>
                {formatRoleLabel(roleCode)}
              </option>
            ))}
          </select>
          <FieldError id={roleCodeErrorId} message={fieldErrors.roleCode} />
        </div>
        <ReportingManagerPicker
          managers={managers}
          required={false}
          defaultValue={values.reportingManagerId}
          error={fieldErrors.reportingManagerId}
        />
      </div>

      <fieldset className="rounded-md border border-neutral-800 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-200">Attendance</legend>
        <label className="mt-2 flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            name="attendanceEligible"
            defaultChecked={values.attendanceEligible}
            className="size-4 rounded border-neutral-600 bg-neutral-950 text-amber-500"
          />
          Enable attendance tracking
        </label>
        <div className="mt-4">
          <label htmlFor={`${formId}-attendancePolicyId`} className={labelClassName}>
            Attendance policy
          </label>
          <select
            id={`${formId}-attendancePolicyId`}
            name="attendancePolicyId"
            defaultValue={values.attendancePolicyId}
            aria-invalid={fieldErrors.attendancePolicyId ? true : undefined}
            aria-describedby={describedBy("attendancePolicyId", attendancePolicyErrorId)}
            className={classFor("attendancePolicyId")}
          >
            <option value="">Select policy when attendance is enabled</option>
            {policies.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {policy.name} ({policy.code}){policy.isCurrent ? " — current" : ""}
              </option>
            ))}
          </select>
          <FieldError id={attendancePolicyErrorId} message={fieldErrors.attendancePolicyId} />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        {pending ? "Creating staff member…" : "Create and invite staff member"}
      </button>
    </form>
  );
}
