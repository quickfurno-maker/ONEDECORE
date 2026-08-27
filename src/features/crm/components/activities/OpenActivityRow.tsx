"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_CRM_ACTIVITY_ACTION_STATE } from "../../contracts/activity-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type { CrmLeadDetailFollowUp } from "../../contracts/lead-detail-dtos.ts";
import { designatePrimaryNextActionAction } from "../../server/crm-activity-actions.ts";
import {
  activityDueStateClassName,
  activityDueStateLabel,
  formatActivityTimestamp,
  formatActivityTypeLabel,
  getActivityDueState,
} from "./activity-ui-utils.ts";

interface OpenActivityRowProps {
  readonly activity: CrmLeadDetailFollowUp;
  readonly canManage: boolean;
  readonly canTransfer: boolean;
  readonly showDesignatePrimary: boolean;
  readonly onComplete: () => void;
  readonly onReschedule: () => void;
  readonly onTransfer: () => void;
}

export function OpenActivityRow({
  activity,
  canManage,
  canTransfer,
  showDesignatePrimary,
  onComplete,
  onReschedule,
  onTransfer,
}: OpenActivityRowProps) {
  const router = useRouter();
  const dueState = getActivityDueState(activity.dueAt);
  const [state, formAction, pending] = useActionState(
    designatePrimaryNextActionAction,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <li
      className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-3 text-sm"
      data-testid={`crm-open-activity-${activity.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-100">{activity.title}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatActivityTypeLabel(activity.activityType)} · {activity.ownerLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${activityDueStateClassName(dueState)}`}
        >
          {activityDueStateLabel(dueState)}
        </span>
      </div>

      <p className="mt-2 text-xs text-neutral-400">
        Due {formatActivityTimestamp(activity.dueAt)}
        {activity.reminderAt
          ? ` · Reminder ${formatActivityTimestamp(activity.reminderAt)}`
          : ""}
      </p>

      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex min-h-9 items-center rounded-md border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-100"
            data-testid={`crm-activity-complete-${activity.id}`}
          >
            Complete
          </button>
          <button
            type="button"
            onClick={onReschedule}
            className="inline-flex min-h-9 items-center rounded-md border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-200"
            data-testid={`crm-activity-reschedule-${activity.id}`}
          >
            Reschedule
          </button>
          {showDesignatePrimary ? (
            <form action={formAction} className="inline-flex">
              <input type="hidden" name="activityId" value={activity.id} />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-9 items-center rounded-md border border-[var(--od-gold)]/40 px-3 py-1 text-xs font-medium text-[var(--od-gold)] disabled:opacity-60"
                data-testid={`crm-activity-make-primary-${activity.id}`}
              >
                {pending ? "Updating…" : "Make Primary"}
              </button>
            </form>
          ) : null}
          {canTransfer ? (
            <button
              type="button"
              onClick={onTransfer}
              className="inline-flex min-h-9 items-center rounded-md border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300"
              data-testid={`crm-activity-transfer-${activity.id}`}
            >
              Transfer Owner
            </button>
          ) : null}
        </div>
      ) : null}

      {state.message ? (
        <p
          className={`mt-2 text-xs ${state.success ? "text-emerald-300" : "text-red-300"}`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

interface ActivityHistoryListProps {
  readonly activities: readonly CrmLeadDetailFollowUp[];
}

export function ActivityHistoryList({ activities }: ActivityHistoryListProps) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="mt-6" data-testid="crm-activity-history">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Completed & cancelled
      </h3>
      <ul className="mt-3 space-y-2">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="rounded-md border border-neutral-800/80 bg-neutral-950/30 px-3 py-2 text-xs text-neutral-400"
            data-testid={`crm-history-activity-${activity.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-neutral-300">{activity.title}</span>
              <span>{formatCrmCodeLabel(activity.status)}</span>
            </div>
            <p className="mt-1">
              {formatActivityTypeLabel(activity.activityType)}
              {activity.outcomeCode
                ? ` · ${activity.outcomeCode.replace(/_/g, " ")}`
                : activity.outcome
                  ? ` · ${activity.outcome}`
                  : ""}
            </p>
            {activity.completedAt ? (
              <p className="mt-1 text-neutral-500">
                Completed {formatActivityTimestamp(activity.completedAt)}
              </p>
            ) : null}
            {activity.cancelledAt ? (
              <p className="mt-1 text-neutral-500">
                Cancelled {formatActivityTimestamp(activity.cancelledAt)}
              </p>
            ) : null}
            {activity.completionNote ? (
              <p className="mt-1 text-neutral-500">{activity.completionNote}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
