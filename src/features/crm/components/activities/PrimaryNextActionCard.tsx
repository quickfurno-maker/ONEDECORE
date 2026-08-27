"use client";

import type { CrmLeadDetailFollowUp } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  activityDueStateClassName,
  activityDueStateLabel,
  formatActivityPriorityLabel,
  formatActivityTimestamp,
  formatActivityTypeLabel,
  getActivityDueState,
} from "./activity-ui-utils.ts";

interface PrimaryNextActionCardProps {
  readonly activity: CrmLeadDetailFollowUp;
  readonly canManage: boolean;
  readonly onComplete: () => void;
  readonly onReschedule: () => void;
}

export function PrimaryNextActionCard({
  activity,
  canManage,
  onComplete,
  onReschedule,
}: PrimaryNextActionCardProps) {
  const dueState = getActivityDueState(activity.dueAt);

  return (
    <section
      className="rounded-xl border-2 border-[var(--od-gold)]/50 bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 p-5 shadow-lg"
      data-testid="crm-primary-next-action-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--od-gold)]">
            Primary next action
          </p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-50">
            {activity.title}
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            {formatActivityTypeLabel(activity.activityType)} ·{" "}
            {formatActivityPriorityLabel(activity.priority)} priority
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${activityDueStateClassName(dueState)}`}
          data-testid="crm-primary-due-state"
        >
          {activityDueStateLabel(dueState)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Due</dt>
          <dd className="font-medium text-neutral-100">
            {formatActivityTimestamp(activity.dueAt)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Owner</dt>
          <dd className="font-medium text-neutral-100">{activity.ownerLabel}</dd>
        </div>
        {activity.reminderAt ? (
          <div>
            <dt className="text-neutral-500">Reminder</dt>
            <dd className="text-neutral-200">
              {formatActivityTimestamp(activity.reminderAt)}
            </dd>
          </div>
        ) : null}
        {activity.durationMinutes ? (
          <div>
            <dt className="text-neutral-500">Duration</dt>
            <dd className="text-neutral-200">{activity.durationMinutes} min</dd>
          </div>
        ) : null}
        {activity.source !== "manual" ? (
          <div>
            <dt className="text-neutral-500">Source</dt>
            <dd className="text-neutral-200">
              {formatCrmCodeLabel(activity.source)}
            </dd>
          </div>
        ) : null}
        {activity.quotationId ? (
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Linked quotation</dt>
            <dd className="font-mono text-xs text-neutral-300">
              {activity.quotationId}
            </dd>
          </div>
        ) : null}
      </dl>

      {canManage ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-[var(--od-gold)] px-4 py-2 text-sm font-semibold text-neutral-950 sm:flex-none"
            data-testid="crm-primary-complete"
          >
            Complete
          </button>
          <button
            type="button"
            onClick={onReschedule}
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100"
            data-testid="crm-primary-reschedule"
          >
            Reschedule
          </button>
        </div>
      ) : null}
    </section>
  );
}
