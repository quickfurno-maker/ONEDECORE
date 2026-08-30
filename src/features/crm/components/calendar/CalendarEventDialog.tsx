"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  formatCalendarTimestampLabel,
  type CrmCalendarEvent,
} from "../../contracts/calendar-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  activityDueStateClassName,
  activityDueStateLabel,
  formatActivityTypeLabel,
  getActivityDueState,
} from "../activities/activity-ui-utils.ts";
import { CrmActivityDialogShell } from "../activities/CrmActivityDialogShell.tsx";
import { CrmDateTimeField } from "../ui/CrmDateTimeField.tsx";
import { LeadStatusBadge } from "../leads/LeadStatusBadge.tsx";
import { localDatetimeToIso, isoToDatetimeLocalValue } from "../../lib/local-datetime-to-iso.ts";

interface CalendarEventDialogProps {
  readonly event: CrmCalendarEvent | null;
  readonly canReschedule: boolean;
  readonly pending: boolean;
  readonly errorMessage: string | null;
  readonly onReschedule: (activityId: string, dueAtIso: string) => void;
  readonly onClose: () => void;
}

export function CalendarEventDialog({
  event,
  canReschedule,
  pending,
  errorMessage,
  onReschedule,
  onClose,
}: CalendarEventDialogProps) {
  // Remounted by the caller on every event change (keyed), so plain
  // initializers are the whole reset story — no synchronous effect state.
  const titleId = useId();
  const [rescheduling, setRescheduling] = useState(false);
  const [draft, setDraft] = useState(() =>
    event ? isoToDatetimeLocalValue(event.dueAt) : ""
  );
  const [localError, setLocalError] = useState<string | null>(null);

  if (!event) {
    return null;
  }

  const dueState = getActivityDueState(event.dueAt);

  const submit = () => {
    setLocalError(null);
    const iso = localDatetimeToIso(draft);
    if (!iso) {
      setLocalError("Enter a valid date and time.");
      return;
    }
    if (Date.parse(iso) <= Date.now()) {
      setLocalError("Activities can only be rescheduled to a future time.");
      return;
    }
    onReschedule(event.activityId, iso);
  };

  return (
    <CrmActivityDialogShell
      open
      title={event.title}
      titleId={titleId}
      onClose={onClose}
      testId="crm-calendar-event-dialog"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${activityDueStateClassName(
              dueState
            )}`}
          >
            {activityDueStateLabel(dueState)}
          </span>
          <LeadStatusBadge status={event.leadStatus} />
          {event.isPrimaryNextAction ? (
            <span className="inline-flex items-center rounded-md border border-[var(--crm-brand-gold)]/35 bg-[#fdf8ec] px-2 py-0.5 text-[11px] font-medium text-[#8a6c1f]">
              Primary next action
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
              Lead
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--crm-text)]">
              {event.leadDisplayLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
              Due
            </dt>
            <dd className="mt-0.5 text-[var(--crm-text)]">
              {formatCalendarTimestampLabel(event.dueAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
              Type
            </dt>
            <dd className="mt-0.5 text-[var(--crm-text)]">
              {formatActivityTypeLabel(event.activityType)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
              Priority
            </dt>
            <dd className="mt-0.5 text-[var(--crm-text)]">
              {formatCrmCodeLabel(event.priority)}
            </dd>
          </div>
          {event.ownerLabel ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
                Owner
              </dt>
              <dd className="mt-0.5 text-[var(--crm-text)]">{event.ownerLabel}</dd>
            </div>
          ) : null}
        </dl>

        {errorMessage ? (
          <p className="text-sm text-[var(--crm-danger)]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {rescheduling ? (
          <div className="space-y-3 rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3">
            <CrmDateTimeField
              id={`${titleId}-due`}
              name="calendarRescheduleDueAtLocal"
              label="New due date and time"
              required
              value={draft}
              onChange={setDraft}
              hasError={Boolean(localError)}
              data-testid="crm-calendar-reschedule-due"
            />
            {localError ? (
              <p className="text-xs text-[var(--crm-danger)]" role="alert">
                {localError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduling(false)}
                className="crm-btn crm-btn-secondary min-h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="crm-btn crm-btn-primary min-h-11 disabled:opacity-60"
                data-testid="crm-calendar-reschedule-submit"
              >
                {pending ? "Saving…" : "Save reschedule"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/admin/crm/leads/${event.leadId}`}
              className="crm-btn crm-btn-secondary min-h-11"
              data-testid="crm-calendar-open-lead"
            >
              Open lead
            </Link>
            {canReschedule ? (
              <button
                type="button"
                onClick={() => setRescheduling(true)}
                className="crm-btn crm-btn-primary min-h-11"
                data-testid="crm-calendar-reschedule-open"
              >
                Reschedule
              </button>
            ) : null}
          </div>
        )}
      </div>
    </CrmActivityDialogShell>
  );
}
