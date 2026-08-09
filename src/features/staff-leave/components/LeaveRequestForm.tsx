"use client";

import { useActionState } from "react";
import type { LeaveTypeSummary } from "../server/leave-actions.ts";
import {
  createLeaveRequestAction,
  type LeaveFormActionState,
} from "../server/leave-form-actions.ts";
import { LEAVE_HALF_DAY_PARTS } from "../contracts/dto.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const INITIAL_STATE: LeaveFormActionState = {
  success: false,
  message: "",
};

interface LeaveRequestFormProps {
  readonly leaveTypes: readonly LeaveTypeSummary[];
}

export function LeaveRequestForm({ leaveTypes }: LeaveRequestFormProps) {
  const [state, formAction, pending] = useActionState(
    createLeaveRequestAction,
    INITIAL_STATE
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6"
    >
      <h2 className="text-lg font-semibold text-neutral-50">Request leave</h2>
      {leaveTypes.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No active leave types are configured yet (OD-9 owner gate).
        </p>
      ) : null}
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
          <label className="text-sm font-medium text-neutral-200">Leave type</label>
          <select name="leaveTypeId" required className={fieldClassName}>
            <option value="">Select type</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-200">Half-day part</label>
          <select name="halfDayPart" className={fieldClassName}>
            <option value="">Full day</option>
            {LEAVE_HALF_DAY_PARTS.map((part) => (
              <option key={part} value={part}>
                {part.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-200">Start date</label>
          <input name="startDate" type="date" required className={fieldClassName} />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-200">End date</label>
          <input name="endDate" type="date" required className={fieldClassName} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-neutral-200">Reason</label>
          <textarea name="reason" required rows={3} className={fieldClassName} />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending || leaveTypes.length === 0}
        className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
