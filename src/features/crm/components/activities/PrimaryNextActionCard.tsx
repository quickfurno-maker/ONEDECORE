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
      className="crm-surface relative overflow-hidden p-5"
      data-testid="crm-primary-next-action-card"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--crm-primary)]"
      />
      <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--crm-primary)]">
            Primary next action
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--crm-text)]">
            {activity.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {formatActivityTypeLabel(activity.activityType)} ·{" "}
            {formatActivityPriorityLabel(activity.priority)} priority
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${activityDueStateClassName(dueState)}`}
          data-testid="crm-primary-due-state"
        >
          {activityDueStateLabel(dueState)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 pl-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--crm-muted)]">Due</dt>
          <dd className="font-medium text-[var(--crm-text)]">
            {formatActivityTimestamp(activity.dueAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Owner</dt>
          <dd className="font-medium text-[var(--crm-text)]">{activity.ownerLabel}</dd>
        </div>
        {activity.reminderAt ? (
          <div>
            <dt className="text-[var(--crm-muted)]">Reminder</dt>
            <dd className="text-[var(--crm-text)]">
              {formatActivityTimestamp(activity.reminderAt)}
            </dd>
          </div>
        ) : null}
        {activity.durationMinutes ? (
          <div>
            <dt className="text-[var(--crm-muted)]">Duration</dt>
            <dd className="text-[var(--crm-text)]">{activity.durationMinutes} min</dd>
          </div>
        ) : null}
        {activity.source !== "manual" ? (
          <div>
            <dt className="text-[var(--crm-muted)]">Source</dt>
            <dd className="text-[var(--crm-text)]">
              {formatCrmCodeLabel(activity.source)}
            </dd>
          </div>
        ) : null}
        {activity.quotationId ? (
          <div className="sm:col-span-2">
            <dt className="text-[var(--crm-muted)]">Linked quotation</dt>
            <dd className="font-mono text-xs text-[var(--crm-text-secondary)]">
              {activity.quotationId}
            </dd>
          </div>
        ) : null}
      </dl>

      {canManage ? (
        <div className="mt-5 flex flex-wrap gap-2 pl-2">
          <button
            type="button"
            onClick={onComplete}
            className="crm-btn crm-btn-primary flex-1 sm:flex-none"
            data-testid="crm-primary-complete"
          >
            Complete
          </button>
          <button
            type="button"
            onClick={onReschedule}
            className="crm-btn crm-btn-secondary"
            data-testid="crm-primary-reschedule"
          >
            Reschedule
          </button>
        </div>
      ) : null}
    </section>
  );
}
