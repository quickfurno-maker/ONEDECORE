"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_CRM_ACTIVITY_ACTION_STATE } from "../../contracts/activity-contracts.ts";
import type { CrmLeadDetailFollowUp } from "../../contracts/lead-detail-dtos.ts";
import {
  conversationNoteHeadingForActivityType,
  formatConversationActivityType,
  formatConversationOutcome,
  formatConversationStatus,
  resolveActivityActorLabel,
  resolveActivityOccurredAt,
  sortActivityHistory,
} from "../../contracts/lead-activity-history.ts";
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
      className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-3 text-sm"
      data-testid={`crm-open-activity-${activity.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--crm-text)]">{activity.title}</p>
          <p className="mt-1 text-xs text-[var(--crm-muted)]">
            {formatActivityTypeLabel(activity.activityType)} · {activity.ownerLabel}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${activityDueStateClassName(dueState)}`}
        >
          {activityDueStateLabel(dueState)}
        </span>
      </div>

      <p className="mt-2 text-xs text-[var(--crm-muted)]">
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
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--crm-border-strong)] px-3 py-1 text-xs font-medium text-[var(--crm-text)]"
            data-testid={`crm-activity-complete-${activity.id}`}
          >
            Complete
          </button>
          <button
            type="button"
            onClick={onReschedule}
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--crm-border-strong)] px-3 py-1 text-xs font-medium text-[var(--crm-text)]"
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
                className="inline-flex min-h-10 items-center rounded-md border border-[var(--crm-primary)]/30 bg-[var(--crm-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--crm-primary)] disabled:opacity-60"
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
              className="inline-flex min-h-9 items-center rounded-md border border-[var(--crm-border-strong)] px-3 py-1 text-xs font-medium text-[var(--crm-text-secondary)]"
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

/**
 * The sales conversation & activity log.
 *
 * A record of what ACTUALLY happened with the client, in the order it happened.
 * Three things distinguish it from the open-activity list above it, and each one
 * was previously wrong here:
 *
 *   - it is ordered by real occurrence, not by when the work was scheduled
 *   - the timestamp is the completion/cancellation instant, never `dueAt`
 *   - the person named is the one who did it, never the scheduled owner
 *
 * It reads only fields the canonical activity row already stores.
 */
export function ActivityHistoryList({ activities }: ActivityHistoryListProps) {
  const ordered = sortActivityHistory(activities);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <div className="mt-6" data-testid="crm-activity-history">
      <h3 className="text-[12px] font-semibold text-[var(--crm-muted)]">
        Conversation &amp; activity log
      </h3>
      <ul className="mt-3 space-y-2">
        {ordered.map((activity) => {
          const occurredAt = resolveActivityOccurredAt(activity);
          const actorLabel = resolveActivityActorLabel(activity);
          const outcome = formatConversationOutcome(activity);
          const isCancelled = activity.status === "cancelled";
          /*
            The heading comes from the SAME client-facing predicate the
            completion dialog and the mobile log use, so the three surfaces
            cannot disagree about which activities involve a client.
          */
          const noteHeading = conversationNoteHeadingForActivityType(
            activity.activityType
          );

          return (
            <li
              key={activity.id}
              className="rounded-md border border-[var(--crm-border)]/80 bg-[var(--crm-surface-subtle)]/30 px-3 py-2.5 text-xs text-[var(--crm-muted)]"
              data-testid={`crm-history-activity-${activity.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 font-medium text-[var(--crm-text-secondary)]">
                  <span className="text-[var(--crm-muted)]">
                    {formatConversationActivityType(activity.activityType)}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="break-words">{activity.title}</span>
                </p>
                {/*
                  Status is carried by the WORD, not by the border tint, so it
                  survives a monochrome or high-contrast rendering.
                */}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 ${
                    isCancelled
                      ? "border-[var(--crm-border-strong)] text-[var(--crm-muted)]"
                      : "border-[var(--crm-border-strong)] text-[var(--crm-text-secondary)]"
                  }`}
                  data-testid={`crm-history-status-${activity.id}`}
                >
                  {formatConversationStatus(activity.status)}
                  {outcome ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{outcome}</span>
                    </>
                  ) : null}
                </span>
              </div>

              {/*
                The actual interaction time and the person who recorded it. An
                unknown actor is omitted rather than filled in with the owner.
              */}
              <p
                className="mt-1.5 break-words text-[var(--crm-muted)]"
                data-testid={`crm-history-when-${activity.id}`}
              >
                {occurredAt ? formatActivityTimestamp(occurredAt) : "Time not recorded"}
                {actorLabel ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="text-[var(--crm-text-secondary)]">
                      {actorLabel}
                    </span>
                  </>
                ) : null}
              </p>

              {activity.completionNote ? (
                <div
                  className="mt-2 rounded border-l-2 border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)]/60 py-1.5 pl-2.5 pr-2"
                  data-testid={`crm-history-note-${activity.id}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
                    {noteHeading}
                  </p>
                  {/*
                    `whitespace-pre-line` keeps the salesperson's own line breaks;
                    `break-words` stops a pasted URL forcing a horizontal scroll.
                  */}
                  <p className="mt-0.5 whitespace-pre-line break-words text-[var(--crm-text-secondary)]">
                    {activity.completionNote}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
