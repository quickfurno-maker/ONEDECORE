"use client";

import { useActionState, useId, useMemo } from "react";
import { STAFF_ASSIGNABLE_ROLE_CODES } from "../contracts/permissions.ts";
import type { AttendancePolicyOption, ReportingManagerOption } from "../server/staff-queries.ts";
import {
  createStaffMemberAction,
  type StaffFormActionState,
} from "../server/staff-form-actions.ts";
import { ReportingManagerPicker } from "./ReportingManagerPicker.tsx";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const labelClassName = "text-sm font-medium text-neutral-200";

const INITIAL_STATE: StaffFormActionState = {
  success: false,
  message: "",
};

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

export function StaffCreateForm({ managers, policies }: StaffCreateFormProps) {
  const formId = useId();
  const clientRequestId = useMemo(() => crypto.randomUUID(), []);
  const [state, formAction, pending] = useActionState(createStaffMemberAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
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
            className={fieldClassName}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-displayName`} className={labelClassName}>
            Display name <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-displayName`}
            name="displayName"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className={labelClassName}>
            Work email <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-phoneE164`} className={labelClassName}>
            Phone (E.164)
          </label>
          <input
            id={`${formId}-phoneE164`}
            name="phoneE164"
            placeholder="+919876543210"
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-designation`} className={labelClassName}>
            Designation <span className="text-amber-400">*</span>
          </label>
          <input
            id={`${formId}-designation`}
            name="designation"
            required
            className={fieldClassName}
          />
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
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-roleCode`} className={labelClassName}>
            Role <span className="text-amber-400">*</span>
          </label>
          <select id={`${formId}-roleCode`} name="roleCode" required className={fieldClassName}>
            <option value="">Select role</option>
            {STAFF_ASSIGNABLE_ROLE_CODES.map((roleCode) => (
              <option key={roleCode} value={roleCode}>
                {formatRoleLabel(roleCode)}
              </option>
            ))}
          </select>
        </div>
        <ReportingManagerPicker managers={managers} required={false} />
      </div>

      <fieldset className="rounded-md border border-neutral-800 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-200">Attendance</legend>
        <label className="mt-2 flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            name="attendanceEligible"
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
            className={fieldClassName}
          >
            <option value="">Select policy when attendance is enabled</option>
            {policies.map((policy) => (
              <option key={policy.policyId} value={policy.policyId}>
                {policy.name} ({policy.code}){policy.isCurrent ? " — current" : ""}
              </option>
            ))}
          </select>
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
