"use client";

import { useActionState, useId, useMemo, useState } from "react";
import {
  WORKFORCE_CATEGORY_LABELS,
  WORKFORCE_EXCEPTION_FLAGS,
  WORKFORCE_EXCEPTION_LABELS,
  WORKFORCE_FINAL_CATEGORIES,
  WORKFORCE_STATE_LABELS,
  formatMinutes,
  isBulkApprovable,
  type WorkforceApprovalInboxRow,
  type WorkforceExceptionFlag,
} from "../contracts/workforce-contracts.ts";
import {
  approveAttendanceDayAction,
  approveSelectedAttendanceAction,
  INITIAL_WORKFORCE_FORM_STATE,
  rejectAttendanceDayAction,
  returnAttendanceForCorrectionAction,
} from "../server/workforce-form-actions.ts";

const FLAG_STYLES: Readonly<Record<WorkforceExceptionFlag, string>> = {
  LATE: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  MISSING_CHECK_IN: "border-red-900/60 bg-red-950/60 text-red-200",
  MISSING_CHECK_OUT: "border-red-900/60 bg-red-950/60 text-red-200",
  VERY_SHORT_ATTENDANCE: "border-orange-900/60 bg-orange-950/60 text-orange-200",
  WEEKLY_OFF_QUOTA_ISSUE: "border-violet-900/60 bg-violet-950/60 text-violet-200",
  UNAPPROVED: "border-neutral-700 bg-neutral-800 text-neutral-300",
  MANUALLY_EDITED: "border-sky-900/60 bg-sky-950/60 text-sky-200",
  MISSING_ATTENDANCE: "border-red-900/60 bg-red-950/60 text-red-200",
};

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(parsed));
}

function ActionFeedback({
  state,
}: {
  readonly state: { success: boolean; message: string; failures?: readonly string[] };
}) {
  if (!state.message) {
    return null;
  }
  return (
    <div
      role={state.success ? "status" : "alert"}
      className={`rounded-md border px-3 py-2 text-sm ${
        state.success
          ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-100"
          : "border-red-900/60 bg-red-950/30 text-red-100"
      }`}
    >
      <p>{state.message}</p>
      {state.failures && state.failures.length > 0 ? (
        <ul className="mt-1 list-inside list-disc text-xs">
          {state.failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Per-row decision controls. Each posts to the same server action as bulk. */
function RowActions({ row }: { readonly row: WorkforceApprovalInboxRow }) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveAttendanceDayAction,
    INITIAL_WORKFORCE_FORM_STATE
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectAttendanceDayAction,
    INITIAL_WORKFORCE_FORM_STATE
  );
  const [correctionState, correctionAction, correctionPending] = useActionState(
    returnAttendanceForCorrectionAction,
    INITIAL_WORKFORCE_FORM_STATE
  );
  const [open, setOpen] = useState(false);

  const hidden = (
    <>
      <input type="hidden" name="staffId" value={row.staffId} />
      <input type="hidden" name="attendanceDate" value={row.attendanceDate} />
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          {hidden}
          <button
            type="submit"
            disabled={approvePending || row.lifecycleState === "APPROVED"}
            className="min-h-9 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            {approvePending ? "Approving…" : "Approve"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-h-9 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-amber-500"
        >
          {open ? "Close" : "Edit / Reject / Correct"}
        </button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
          <form action={approveAction} className="space-y-2">
            {hidden}
            <label className="block text-xs font-medium text-neutral-300">
              Edit + Approve — set the final category
              <select
                name="finalCategory"
                defaultValue={row.submittedCategory ?? ""}
                className="mt-1 block min-h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
              >
                <option value="">Use submitted category</option>
                {WORKFORCE_FINAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {WORKFORCE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              name="note"
              maxLength={500}
              placeholder="Note (optional)"
              className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
            />
            <button
              type="submit"
              disabled={approvePending}
              className="min-h-9 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
            >
              Edit + Approve
            </button>
          </form>
          <ActionFeedback state={approveState} />

          <form action={rejectAction} className="space-y-2 border-t border-neutral-800 pt-3">
            {hidden}
            <input
              type="text"
              name="note"
              required
              maxLength={500}
              placeholder="Reason for rejection (required)"
              className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
            />
            <button
              type="submit"
              disabled={rejectPending}
              className="min-h-9 rounded-md border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-50"
            >
              Reject
            </button>
          </form>
          <ActionFeedback state={rejectState} />

          <form action={correctionAction} className="space-y-2 border-t border-neutral-800 pt-3">
            {hidden}
            <input
              type="text"
              name="note"
              required
              maxLength={500}
              placeholder="What must the employee correct? (required)"
              className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
            />
            <button
              type="submit"
              disabled={correctionPending}
              className="min-h-9 rounded-md border border-orange-800 px-3 py-1.5 text-xs font-semibold text-orange-200 disabled:opacity-50"
            >
              Send for Correction
            </button>
          </form>
          <ActionFeedback state={correctionState} />
        </div>
      ) : (
        <ActionFeedback state={approveState} />
      )}
    </div>
  );
}

interface AttendanceApprovalInboxProps {
  readonly rows: readonly WorkforceApprovalInboxRow[];
}

export function AttendanceApprovalInbox({ rows }: AttendanceApprovalInboxProps) {
  const bulkFormId = useId();
  const [activeFlags, setActiveFlags] = useState<readonly WorkforceExceptionFlag[]>([]);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    approveSelectedAttendanceAction,
    INITIAL_WORKFORCE_FORM_STATE
  );

  const visibleRows = useMemo(() => {
    if (activeFlags.length === 0) {
      return rows;
    }
    // A row matches when it carries EVERY selected flag, so stacking filters
    // narrows rather than widens the queue.
    return rows.filter((row) =>
      activeFlags.every((flag) => row.exceptionFlags.includes(flag))
    );
  }, [rows, activeFlags]);

  const bulkCandidates = useMemo(
    () => visibleRows.filter((row) => isBulkApprovable(row)),
    [visibleRows]
  );

  const toggleFlag = (flag: WorkforceExceptionFlag) => {
    setActiveFlags((current) =>
      current.includes(flag)
        ? current.filter((value) => value !== flag)
        : [...current, flag]
    );
  };

  const flagCounts = useMemo(() => {
    const counts = new Map<WorkforceExceptionFlag, number>();
    for (const row of rows) {
      for (const flag of row.exceptionFlags) {
        counts.set(flag, (counts.get(flag) ?? 0) + 1);
      }
    }
    return counts;
  }, [rows]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-neutral-100">Exception filters</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {WORKFORCE_EXCEPTION_FLAGS.map((flag) => {
            const active = activeFlags.includes(flag);
            const count = flagCounts.get(flag) ?? 0;
            return (
              <button
                key={flag}
                type="button"
                onClick={() => toggleFlag(flag)}
                aria-pressed={active}
                className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-amber-500 bg-amber-500/20 text-amber-100"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                {WORKFORCE_EXCEPTION_LABELS[flag]} ({count})
              </button>
            );
          })}
          {activeFlags.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveFlags([])}
              className="min-h-9 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-neutral-100"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Showing {visibleRows.length} of {rows.length} day(s).
        </p>
      </section>

      {/*
        The bulk form deliberately does NOT wrap the table: the per-row decision
        forms live inside the rows, and nested <form> elements are invalid HTML.
        The checkboxes below associate with this form via the `form` attribute.
      */}
      <form id={bulkFormId} action={bulkAction}>
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Approve Selected
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Only straightforward pending rows can be selected. Every selected row is
                re-validated individually on the server, including the Weekly Off cap.
              </p>
            </div>
            <button
              type="submit"
              disabled={bulkPending || bulkCandidates.length === 0}
              className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            >
              {bulkPending ? "Approving…" : `Approve Selected`}
            </button>
          </div>
          <ActionFeedback state={bulkState} />
        </section>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="bg-neutral-900/80">
              <tr className="text-[11px] uppercase tracking-wide text-neutral-500">
                <th scope="col" className="p-3">Select</th>
                <th scope="col" className="p-3">Employee</th>
                <th scope="col" className="p-3">Date</th>
                <th scope="col" className="p-3">In</th>
                <th scope="col" className="p-3">Out</th>
                <th scope="col" className="p-3">Elapsed</th>
                <th scope="col" className="p-3">Submitted</th>
                <th scope="col" className="p-3">Final</th>
                <th scope="col" className="p-3">Late</th>
                <th scope="col" className="p-3">Flags</th>
                <th scope="col" className="p-3">State</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-sm text-neutral-400">
                    Nothing to review here.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const selectable = isBulkApprovable(row);
                  return (
                    <tr
                      key={`${row.staffId}|${row.attendanceDate}`}
                      className="border-t border-neutral-800 align-top"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          form={bulkFormId}
                          name="selection"
                          value={`${row.staffId}|${row.attendanceDate}`}
                          disabled={!selectable}
                          aria-label={`Select ${row.employeeName} on ${row.attendanceDate}`}
                          className="size-4 rounded border-neutral-600 bg-neutral-950 disabled:opacity-40"
                        />
                      </td>
                      <td className="p-3">
                        <span className="text-neutral-100">{row.employeeName}</span>
                        {row.employeeCode ? (
                          <span className="block text-xs text-neutral-500">
                            {row.employeeCode}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-neutral-300">{row.attendanceDate}</td>
                      <td className="p-3 text-neutral-300">{formatTime(row.inTime)}</td>
                      <td className="p-3 text-neutral-300">{formatTime(row.outTime)}</td>
                      <td className="p-3 text-neutral-300">
                        {formatMinutes(row.elapsedMinutes)}
                      </td>
                      <td className="p-3 text-neutral-300">
                        {row.submittedCategory
                          ? WORKFORCE_CATEGORY_LABELS[row.submittedCategory]
                          : "—"}
                      </td>
                      <td className="p-3 text-neutral-100">
                        {row.finalCategory
                          ? WORKFORCE_CATEGORY_LABELS[row.finalCategory]
                          : "—"}
                      </td>
                      <td className="p-3 text-neutral-300">
                        {row.isLate ? `${row.lateMinutes}m` : "On time"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.exceptionFlags.length === 0 ? (
                            <span className="text-xs text-neutral-500">—</span>
                          ) : (
                            row.exceptionFlags.map((flag) => (
                              <span
                                key={flag}
                                className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${FLAG_STYLES[flag]}`}
                              >
                                {WORKFORCE_EXCEPTION_LABELS[flag]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-neutral-300">
                        {WORKFORCE_STATE_LABELS[row.lifecycleState]}
                      </td>
                      <td className="p-3">
                        <RowActions row={row} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
}
