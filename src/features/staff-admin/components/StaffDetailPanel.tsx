"use client";

import { useActionState } from "react";
import type { StaffDetail } from "../contracts/dto.ts";
import { STAFF_PROFILE_STATUS_CODES } from "../contracts/permissions.ts";
import type {
  AttendancePolicyOption,
  ReportingManagerOption,
} from "../server/staff-queries.ts";
import {
  setReportingManagerAction,
  setStaffStatusAction,
  updateStaffEmploymentAction,
  type StaffFormActionState,
} from "../server/staff-form-actions.ts";
import { ReportingManagerPicker } from "./ReportingManagerPicker.tsx";
import { StaffAccessStateBadge, StaffStatusBadge } from "./StaffStatusBadge.tsx";

const fieldClassName =
  "mt-1 block w-full min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const INITIAL_STATE: StaffFormActionState = {
  success: false,
  message: "",
};

interface StaffDetailPanelProps {
  readonly staff: StaffDetail;
  readonly canManage: boolean;
  readonly managers: readonly ReportingManagerOption[];
  readonly policies: readonly AttendancePolicyOption[];
}

function ActionFeedback({ state }: { readonly state: StaffFormActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      role={state.success ? "status" : "alert"}
      className={`text-sm ${state.success ? "text-emerald-300" : "text-red-300"}`}
    >
      {state.message}
    </p>
  );
}

export function StaffDetailPanel({
  staff,
  canManage,
  managers,
  policies,
}: StaffDetailPanelProps) {
  const [statusState, statusAction, statusPending] = useActionState(
    setStaffStatusAction,
    INITIAL_STATE
  );
  const [managerState, managerAction, managerPending] = useActionState(
    setReportingManagerAction,
    INITIAL_STATE
  );
  const [employmentState, employmentAction, employmentPending] = useActionState(
    updateStaffEmploymentAction,
    INITIAL_STATE
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-50">{staff.displayName}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {staff.employeeCode} · {staff.designation}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">
              Employment
            </span>
            <StaffStatusBadge status={staff.status} />
            <StaffAccessStateBadge accessState={staff.accessState} />
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Role</dt>
            <dd className="mt-1 text-sm text-neutral-200">{staff.roleCode}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Manager</dt>
            <dd className="mt-1 text-sm text-neutral-200">{staff.managerName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Joined</dt>
            <dd className="mt-1 text-sm text-neutral-200">{staff.joiningDate}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Phone</dt>
            <dd className="mt-1 text-sm text-neutral-200">{staff.phoneE164 ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Attendance</dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {staff.attendanceEligible
                ? staff.policyName ?? "Eligible (policy pending)"
                : "Not eligible"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Last audit event</dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {staff.auditSummary.lastEventType ?? "—"}
              {staff.auditSummary.lastEventAt
                ? ` · ${new Date(staff.auditSummary.lastEventAt).toLocaleString()}`
                : ""}
            </dd>
          </div>
        </dl>
      </section>

      {canManage ? (
        <>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Update employment
            </h3>
            <form action={employmentAction} className="mt-4 space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-neutral-200">Employee code</label>
                  <input
                    name="employeeCode"
                    defaultValue={staff.employeeCode}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-200">Designation</label>
                  <input
                    name="designation"
                    defaultValue={staff.designation}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-200">Display name</label>
                  <input
                    name="displayName"
                    defaultValue={staff.displayName}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-200">Phone (E.164)</label>
                  <input
                    name="phoneE164"
                    defaultValue={staff.phoneE164 ?? ""}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-200">Joining date</label>
                  <input
                    name="joiningDate"
                    type="date"
                    defaultValue={staff.joiningDate}
                    className={fieldClassName}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-200">Reason</label>
                  <input name="reason" required className={fieldClassName} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  name="attendanceEligible"
                  defaultChecked={staff.attendanceEligible}
                  className="size-4 rounded border-neutral-600 bg-neutral-950 text-amber-500"
                />
                Attendance eligible
              </label>
              <div>
                <label className="text-sm font-medium text-neutral-200">Attendance policy</label>
                <select
                  name="attendancePolicyId"
                  defaultValue=""
                  className={fieldClassName}
                >
                  <option value="">No policy selected</option>
                  {policies.map((policy) => (
                    <option key={policy.policyId} value={policy.policyId}>
                      {policy.name} ({policy.code})
                    </option>
                  ))}
                </select>
              </div>
              <ActionFeedback state={employmentState} />
              <button
                type="submit"
                disabled={employmentPending}
                className="min-h-11 rounded-md border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 hover:border-amber-400"
              >
                Save employment
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Reporting manager
            </h3>
            <form action={managerAction} className="mt-4 space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <ReportingManagerPicker
                managers={managers.filter((manager) => manager.staffId !== staff.staffId)}
                defaultValue=""
              />
              <div>
                <label className="text-sm font-medium text-neutral-200">Reason</label>
                <input name="reason" required className={fieldClassName} />
              </div>
              <ActionFeedback state={managerState} />
              <button
                type="submit"
                disabled={managerPending}
                className="min-h-11 rounded-md border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 hover:border-amber-400"
              >
                Update manager
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Profile status
            </h3>
            <form action={statusAction} className="mt-4 space-y-4">
              <input type="hidden" name="staffId" value={staff.staffId} />
              <div>
                <label className="text-sm font-medium text-neutral-200">Status</label>
                <select name="status" defaultValue={staff.status} className={fieldClassName}>
                  {STAFF_PROFILE_STATUS_CODES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-200">Reason</label>
                <input name="reason" required className={fieldClassName} />
              </div>
              <ActionFeedback state={statusState} />
              <button
                type="submit"
                disabled={statusPending}
                className="min-h-11 rounded-md border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-100 hover:border-amber-400"
              >
                Update status
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
