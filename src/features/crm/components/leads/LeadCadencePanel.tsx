"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
  INITIAL_CADENCE_ACTION_STATE,
  formatCadenceDelayLabel,
  formatCadenceStatusLabel,
  formatCadenceStopReasonLabel,
  isLiveCadenceEnrollment,
  type CadenceActionState,
  type CrmCadenceTemplateSummary,
  type CrmLeadCadenceState,
} from "../../contracts/cadence-contracts.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import { isTerminalLeadStage } from "../../contracts/lead-stages.ts";
import {
  cancelLeadCadenceAction,
  enrollLeadInCadenceAction,
  pauseLeadCadenceAction,
  resumeLeadCadenceAction,
} from "../../server/crm-cadence-actions.ts";

interface LeadCadencePanelProps {
  readonly leadId: string;
  readonly leadStatus: LeadStageCode;
  readonly isAssigned: boolean;
  readonly canManage: boolean;
  readonly cadence: CrmLeadCadenceState | null;
  readonly enrollableTemplates: readonly CrmCadenceTemplateSummary[];
}

const EVENT_LABELS: Readonly<Record<string, string>> = {
  enrolled: "Enrolled",
  step_materialized: "Step scheduled",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  auto_stopped: "Stopped automatically",
  completed: "Completed",
};

function formatEventTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

/**
 * Concise cadence surface on lead detail. Cadence activities themselves live in
 * the Activities workspace — this never duplicates that UI.
 */
export function LeadCadencePanel({
  leadId,
  leadStatus,
  isAssigned,
  canManage,
  cadence,
  enrollableTemplates,
}: LeadCadencePanelProps) {
  const router = useRouter();
  const fieldId = useId();
  const [enrollState, enrollAction, enrollPending] = useActionState<
    CadenceActionState,
    FormData
  >(enrollLeadInCadenceAction, INITIAL_CADENCE_ACTION_STATE);
  const [pauseState, pauseAction, pausePending] = useActionState<
    CadenceActionState,
    FormData
  >(pauseLeadCadenceAction, INITIAL_CADENCE_ACTION_STATE);
  const [resumeState, resumeAction, resumePending] = useActionState<
    CadenceActionState,
    FormData
  >(resumeLeadCadenceAction, INITIAL_CADENCE_ACTION_STATE);
  const [cancelState, cancelAction, cancelPending] = useActionState<
    CadenceActionState,
    FormData
  >(cancelLeadCadenceAction, INITIAL_CADENCE_ACTION_STATE);

  const succeeded =
    enrollState.success ||
    pauseState.success ||
    resumeState.success ||
    cancelState.success;

  useEffect(() => {
    if (succeeded) {
      router.refresh();
    }
  }, [succeeded, router]);

  const message =
    enrollState.message ||
    pauseState.message ||
    resumeState.message ||
    cancelState.message;
  const failed =
    (enrollState.message && !enrollState.success) ||
    (pauseState.message && !pauseState.success) ||
    (resumeState.message && !resumeState.success) ||
    (cancelState.message && !cancelState.success);

  const isLive = cadence != null && isLiveCadenceEnrollment(cadence.status);
  const canEnroll =
    canManage &&
    !isLive &&
    isAssigned &&
    !isTerminalLeadStage(leadStatus) &&
    leadStatus !== "on_hold" &&
    enrollableTemplates.length > 0;

  return (
    <section className="crm-surface p-5" data-testid="crm-lead-cadence-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--crm-text)]">Cadence</h2>
          <p className="mt-1 text-xs text-[var(--crm-muted)]">
            A cadence schedules the next follow-up activity for a person to do. It
            never sends anything on its own.
          </p>
        </div>
        {cadence ? (
          <span
            className="inline-flex items-center rounded-md border border-[var(--crm-border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--crm-text-secondary)]"
            data-testid="crm-lead-cadence-status"
          >
            {formatCadenceStatusLabel(cadence.status)}
          </span>
        ) : null}
      </div>

      {cadence ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[var(--crm-text)]">
            {cadence.templateName}
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--crm-muted)]">Progress</dt>
              <dd
                className="font-medium text-[var(--crm-text)]"
                data-testid="crm-lead-cadence-progress"
              >
                Step {cadence.currentStepOrder ?? 0} of {cadence.totalSteps}
              </dd>
            </div>
            {cadence.currentStepTitle ? (
              <div>
                <dt className="text-[var(--crm-muted)]">Current step</dt>
                <dd className="text-[var(--crm-text)]">
                  {cadence.currentStepTitle}
                </dd>
              </div>
            ) : null}
            {isLive && cadence.upcomingStepTitle ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--crm-muted)]">Upcoming step</dt>
                <dd
                  className="text-[var(--crm-text)]"
                  data-testid="crm-lead-cadence-upcoming"
                >
                  {cadence.upcomingStepTitle}
                  {cadence.upcomingStepDelayHours != null
                    ? ` · ${formatCadenceDelayLabel(cadence.upcomingStepDelayHours)}`
                    : ""}
                </dd>
              </div>
            ) : null}
            {cadence.stopReason ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--crm-muted)]">Stopped because</dt>
                <dd className="text-[var(--crm-text)]">
                  {formatCadenceStopReasonLabel(cadence.stopReason)}
                </dd>
              </div>
            ) : null}
          </dl>

          {canManage && isLive ? (
            <div className="flex flex-wrap gap-2">
              {cadence.status === "active" ? (
                <form action={pauseAction}>
                  <input
                    type="hidden"
                    name="enrollmentId"
                    value={cadence.enrollmentId}
                  />
                  <button
                    type="submit"
                    disabled={pausePending}
                    className="crm-btn crm-btn-secondary"
                    data-testid="crm-lead-cadence-pause"
                  >
                    {pausePending ? "Pausing…" : "Pause"}
                  </button>
                </form>
              ) : (
                <form action={resumeAction}>
                  <input
                    type="hidden"
                    name="enrollmentId"
                    value={cadence.enrollmentId}
                  />
                  <button
                    type="submit"
                    disabled={resumePending}
                    className="crm-btn crm-btn-primary"
                    data-testid="crm-lead-cadence-resume"
                  >
                    {resumePending ? "Resuming…" : "Resume"}
                  </button>
                </form>
              )}
              <form action={cancelAction}>
                <input
                  type="hidden"
                  name="enrollmentId"
                  value={cadence.enrollmentId}
                />
                <button
                  type="submit"
                  disabled={cancelPending}
                  className="crm-btn crm-btn-ghost text-red-300"
                  data-testid="crm-lead-cadence-cancel"
                >
                  {cancelPending ? "Cancelling…" : "Cancel cadence"}
                </button>
              </form>
            </div>
          ) : null}

          {cadence.history.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-medium text-[var(--crm-muted)]">
                Cadence history
              </summary>
              <ul
                className="mt-2 space-y-1.5 text-xs text-[var(--crm-muted)]"
                data-testid="crm-lead-cadence-history"
              >
                {cadence.history.map((entry) => (
                  <li key={entry.id}>
                    <span className="text-[var(--crm-text-secondary)]">
                      {EVENT_LABELS[entry.eventType] ?? entry.eventType}
                    </span>{" "}
                    · {formatEventTimestamp(entry.createdAt)}
                    {entry.reasonCode ? ` · ${entry.reasonCode}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">
          This lead is not enrolled in a cadence.
        </p>
      )}

      {canEnroll ? (
        <form
          action={enrollAction}
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        >
          <input type="hidden" name="leadId" value={leadId} />
          <label htmlFor={`${fieldId}-template`} className="sr-only">
            Cadence to enroll
          </label>
          <select
            id={`${fieldId}-template`}
            name="templateId"
            required
            className="crm-input min-h-11 w-full min-w-0 text-base sm:flex-1 sm:text-sm"
            data-testid="crm-lead-cadence-template"
          >
            <option value="">Select a published cadence</option>
            {enrollableTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.stepCount} steps)
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={enrollPending}
            className="crm-btn crm-btn-primary w-full sm:w-auto"
            data-testid="crm-lead-cadence-enroll"
          >
            {enrollPending ? "Enrolling…" : "Enroll in cadence"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          className={`mt-3 text-sm ${failed ? "text-red-300" : "text-emerald-300"}`}
          role="status"
          data-testid="crm-lead-cadence-message"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
