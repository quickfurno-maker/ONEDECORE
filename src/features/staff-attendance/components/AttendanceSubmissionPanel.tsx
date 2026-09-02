"use client";

import { useActionState } from "react";
import {
  WORKFORCE_CATEGORY_LABELS,
  WORKFORCE_STATE_LABELS,
  WORKFORCE_SUBMITTABLE_CATEGORIES,
  WORKFORCE_WEEKLY_OFF_MONTHLY_CAP,
  formatMinutes,
  type WorkforceLifecycleState,
  type WorkforceSubmissionRow,
} from "../contracts/workforce-contracts.ts";
import {
  INITIAL_WORKFORCE_FORM_STATE,
  requestAttendanceCorrectionAction,
  submitAttendanceDayAction,
} from "../server/workforce-form-actions.ts";

const STATE_STYLES: Readonly<Record<WorkforceLifecycleState, string>> = {
  NOT_STARTED: "border-neutral-700 bg-neutral-800 text-neutral-300",
  CHECKED_IN: "border-sky-900/60 bg-sky-950/70 text-sky-200",
  CHECKED_OUT: "border-sky-900/60 bg-sky-950/70 text-sky-200",
  SUBMITTED: "border-amber-900/60 bg-amber-950/70 text-amber-200",
  PENDING_APPROVAL: "border-amber-900/60 bg-amber-950/70 text-amber-200",
  APPROVED: "border-emerald-900/60 bg-emerald-950/70 text-emerald-200",
  REJECTED: "border-red-900/60 bg-red-950/70 text-red-200",
  CORRECTION_REQUIRED: "border-orange-900/60 bg-orange-950/70 text-orange-200",
};

interface AttendanceSubmissionPanelProps {
  readonly attendanceDate: string;
  readonly submission: WorkforceSubmissionRow | null;
  readonly weeklyOffUsed: number;
  readonly weeklyOffRemaining: number;
}

function StateBadge({ state }: { readonly state: WorkforceLifecycleState }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATE_STYLES[state]}`}
    >
      {WORKFORCE_STATE_LABELS[state]}
    </span>
  );
}

/**
 * Weekly Off allowance for the calendar month.
 *
 * Shown prominently because the cap is a hard business rule: the fourth day is
 * the last one, and the server refuses a fifth.
 */
export function WeeklyOffQuotaIndicator({
  used,
  remaining,
}: {
  readonly used: number;
  readonly remaining: number;
}) {
  const exhausted = remaining <= 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        exhausted
          ? "border-red-900/60 bg-red-950/30"
          : "border-violet-900/60 bg-violet-950/30"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Weekly Off this month
        </p>
        <p
          className={`text-sm font-semibold ${
            exhausted ? "text-red-200" : "text-violet-200"
          }`}
        >
          {used} of {WORKFORCE_WEEKLY_OFF_MONTHLY_CAP} used · {remaining} remaining
        </p>
      </div>
      <div
        className="mt-2 flex gap-1"
        role="img"
        aria-label={`${used} of ${WORKFORCE_WEEKLY_OFF_MONTHLY_CAP} Weekly Off days used, ${remaining} remaining`}
      >
        {Array.from({ length: WORKFORCE_WEEKLY_OFF_MONTHLY_CAP }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < used ? "bg-violet-400" : "bg-neutral-700"
            }`}
          />
        ))}
      </div>
      {exhausted ? (
        <p className="mt-2 text-xs text-red-200">
          You have used all {WORKFORCE_WEEKLY_OFF_MONTHLY_CAP} Weekly Off days this
          month. A fifth cannot be submitted or approved.
        </p>
      ) : null}
    </div>
  );
}

export function AttendanceSubmissionPanel({
  attendanceDate,
  submission,
  weeklyOffUsed,
  weeklyOffRemaining,
}: AttendanceSubmissionPanelProps) {
  const [submitState, submitAction, submitPending] = useActionState(
    submitAttendanceDayAction,
    INITIAL_WORKFORCE_FORM_STATE
  );
  const [correctionState, correctionAction, correctionPending] = useActionState(
    requestAttendanceCorrectionAction,
    INITIAL_WORKFORCE_FORM_STATE
  );

  const state: WorkforceLifecycleState = submission?.lifecycleState ?? "NOT_STARTED";
  const isApproved = state === "APPROVED";
  const weeklyOffBlocked = weeklyOffRemaining <= 0;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Submit today&rsquo;s attendance
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Your submission goes to a Super Admin for approval. Only approved
            attendance is official.
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Submitted</dt>
          <dd className="mt-1 text-neutral-100">
            {submission?.submittedCategory
              ? WORKFORCE_CATEGORY_LABELS[submission.submittedCategory]
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Final (approved)
          </dt>
          <dd className="mt-1 text-neutral-100">
            {submission?.finalCategory
              ? WORKFORCE_CATEGORY_LABELS[submission.finalCategory]
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Credited</dt>
          <dd className="mt-1 text-neutral-100">
            {formatMinutes(submission?.creditedMinutes ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Arrival</dt>
          <dd className="mt-1 text-neutral-100">
            {submission?.isLate
              ? `Late · ${submission.lateMinutes} min`
              : submission
                ? "On time"
                : "—"}
          </dd>
        </div>
      </dl>

      {submission?.reviewNote ? (
        <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-300">
          <span className="font-medium text-neutral-200">Reviewer note:</span>{" "}
          {submission.reviewNote}
        </p>
      ) : null}

      <div className="mt-5">
        <WeeklyOffQuotaIndicator used={weeklyOffUsed} remaining={weeklyOffRemaining} />
      </div>

      {isApproved ? (
        <p className="mt-5 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
          This day is approved and final. Ask a Super Admin if it needs to change.
        </p>
      ) : (
        <form action={submitAction} className="mt-5 space-y-3">
          <input type="hidden" name="attendanceDate" value={attendanceDate} />
          <fieldset>
            <legend className="text-sm font-medium text-neutral-200">
              Choose today&rsquo;s attendance
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {WORKFORCE_SUBMITTABLE_CATEGORIES.map((category) => {
                const disabled =
                  submitPending || (category === "WEEKLY_OFF" && weeklyOffBlocked);
                return (
                  <button
                    key={category}
                    type="submit"
                    name="category"
                    value={category}
                    disabled={disabled}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-amber-500 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    title={
                      category === "WEEKLY_OFF" && weeklyOffBlocked
                        ? "Weekly Off allowance for this month is used up"
                        : undefined
                    }
                  >
                    {WORKFORCE_CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-neutral-500">
            Absent is not a self-service option. If you were away, submit nothing and a
            Super Admin will decide the day.
          </p>
          {submitState.message ? (
            <p
              role={submitState.success ? "status" : "alert"}
              className={`text-sm ${
                submitState.success ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {submitState.message}
            </p>
          ) : null}
        </form>
      )}

      <form action={correctionAction} className="mt-6 space-y-2 border-t border-neutral-800 pt-5">
        <input type="hidden" name="attendanceDate" value={attendanceDate} />
        <label htmlFor="correction-note" className="text-sm font-medium text-neutral-200">
          Check-in or check-out wrong? Request a correction
        </label>
        <textarea
          id="correction-note"
          name="note"
          rows={2}
          maxLength={500}
          required
          placeholder="Describe what is wrong or missing."
          className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        />
        <button
          type="submit"
          disabled={correctionPending}
          className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-amber-500 hover:text-amber-200 disabled:opacity-60"
        >
          {correctionPending ? "Sending…" : "Request correction"}
        </button>
        <p className="text-xs text-neutral-500">
          You cannot edit recorded times yourself — a Super Admin makes the correction,
          and the change is audited.
        </p>
        {correctionState.message ? (
          <p
            role={correctionState.success ? "status" : "alert"}
            className={`text-sm ${
              correctionState.success ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {correctionState.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
