"use client";

import { useActionState } from "react";
import { ATTENDANCE_BUSINESS_TIMEZONE } from "../contracts/dto.ts";
import type { AttendancePolicyRow } from "../server/attendance-queries.ts";
import {
  publishAttendancePolicyAction,
  setCurrentAttendancePolicyAction,
  type AttendanceFormActionState,
} from "../server/attendance-form-actions.ts";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const INITIAL_STATE: AttendanceFormActionState = {
  success: false,
  message: "",
};

interface AttendancePolicyFormProps {
  readonly policies: readonly AttendancePolicyRow[];
}

export function AttendancePolicyForm({ policies }: AttendancePolicyFormProps) {
  const [publishState, publishAction, publishPending] = useActionState(
    publishAttendancePolicyAction,
    INITIAL_STATE
  );
  const [currentState, currentAction, currentPending] = useActionState(
    setCurrentAttendancePolicyAction,
    INITIAL_STATE
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold text-neutral-50">Published policies</h2>
        {policies.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            No attendance policies have been published yet. Use the form below after owner
            policy values (OD-1 through OD-8) are confirmed.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {policies.map((policy) => (
              <li
                key={policy.policyId}
                className="flex flex-col gap-3 rounded-md border border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-neutral-100">
                    {policy.name}{" "}
                    {policy.isCurrent ? (
                      <span className="text-xs text-amber-300">(current)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {policy.code} · {policy.timezone} · {policy.workdayStartLocal}–
                    {policy.workdayEndLocal}
                  </p>
                </div>
                {!policy.isCurrent ? (
                  <form action={currentAction}>
                    <input type="hidden" name="policyId" value={policy.policyId} />
                    <button
                      type="submit"
                      disabled={currentPending}
                      className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 hover:border-amber-400"
                    >
                      Set current
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {currentState.message ? (
          <p className="mt-3 text-sm text-emerald-300">{currentState.message}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <h2 className="text-lg font-semibold text-neutral-50">Publish policy</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Enter owner-approved policy values. Timezone is fixed to {ATTENDANCE_BUSINESS_TIMEZONE}.
        </p>
        <form action={publishAction} className="mt-5 space-y-4">
          <input type="hidden" name="timezone" value={ATTENDANCE_BUSINESS_TIMEZONE} />
          {publishState.message ? (
            <div
              role={publishState.success ? "status" : "alert"}
              className={`rounded-md border px-4 py-3 text-sm ${
                publishState.success
                  ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-100"
                  : "border-red-900/60 bg-red-950/30 text-red-100"
              }`}
            >
              {publishState.message}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-neutral-200">Code</label>
              <input name="code" required className={fieldClassName} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Name</label>
              <input name="name" required className={fieldClassName} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Workday start</label>
              <input name="workdayStartLocal" type="time" required className={fieldClassName} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Workday end</label>
              <input name="workdayEndLocal" type="time" required className={fieldClassName} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Late grace (minutes)</label>
              <input
                name="lateGraceMinutes"
                type="number"
                min={0}
                required
                className={fieldClassName}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">
                Half-day threshold (minutes)
              </label>
              <input
                name="halfDayThresholdMinutes"
                type="number"
                min={0}
                required
                className={fieldClassName}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">
                Missing checkout cutoff
              </label>
              <input
                name="missingCheckoutCutoffLocal"
                type="time"
                required
                className={fieldClassName}
              />
            </div>
            <div>
              <label
                htmlFor="weeklyOffDays"
                className="text-sm font-medium text-neutral-200"
              >
                Legacy weekly-off days (optional, 1=Mon … 7=Sun)
              </label>
              <input
                id="weeklyOffDays"
                name="weeklyOffDays"
                placeholder="Leave blank"
                aria-describedby="weeklyOffDays-hint"
                className={fieldClassName}
              />
              <p id="weeklyOffDays-hint" className="mt-1 text-xs text-neutral-500">
                Leave blank for Workforce V1. Weekly Off is selected day-by-day.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-200">Supersedes policy</label>
              <select name="supersedesPolicyId" className={fieldClassName}>
                <option value="">None</option>
                {policies.map((policy) => (
                  <option key={policy.policyId} value={policy.policyId}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              name="locationRequired"
              className="size-4 rounded border-neutral-600 bg-neutral-950 text-amber-500"
            />
            Location required (OD-8)
          </label>
          <button
            type="submit"
            disabled={publishPending}
            className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
          >
            {publishPending ? "Publishing…" : "Publish policy"}
          </button>
        </form>
      </section>
    </div>
  );
}
