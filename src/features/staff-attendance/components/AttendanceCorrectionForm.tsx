"use client";

import { useActionState } from "react";
import { ATTENDANCE_CORRECTION_TYPES } from "../contracts/dto.ts";
import type { CorrectionStaffOption } from "../server/attendance-queries.ts";
import {
  correctAttendanceDayAction,
  type AttendanceFormActionState,
} from "../server/attendance-form-actions.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const INITIAL_STATE: AttendanceFormActionState = {
  success: false,
  message: "",
};

interface AttendanceCorrectionFormProps {
  readonly staffOptions: readonly CorrectionStaffOption[];
}

export function AttendanceCorrectionForm({ staffOptions }: AttendanceCorrectionFormProps) {
  const [state, formAction, pending] = useActionState(
    correctAttendanceDayAction,
    INITIAL_STATE
  );

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6"
    >
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="staffId" className="text-sm font-medium text-neutral-200">
            Staff member
          </label>
          <select id="staffId" name="staffId" required className={fieldClassName}>
            <option value="">Select staff</option>
            {staffOptions.map((option) => (
              <option key={option.staffId} value={option.staffId}>
                {option.displayName} ({option.employeeCode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="attendanceDate" className="text-sm font-medium text-neutral-200">
            Attendance date
          </label>
          <input
            id="attendanceDate"
            name="attendanceDate"
            type="date"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor="correctionType" className="text-sm font-medium text-neutral-200">
            Correction type
          </label>
          <select id="correctionType" name="correctionType" required className={fieldClassName}>
            <option value="">Select correction</option>
            {ATTENDANCE_CORRECTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="reason" className="text-sm font-medium text-neutral-200">
            Reason
          </label>
          <textarea
            id="reason"
            name="reason"
            required
            rows={3}
            className={fieldClassName}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
      >
        {pending ? "Recording correction…" : "Record correction"}
      </button>
    </form>
  );
}
