"use client";

import type { DragEvent } from "react";
import {
  formatCalendarTimeLabel,
  type CrmCalendarEvent,
} from "../../contracts/calendar-contracts.ts";
import {
  formatActivityTypeLabel,
  getActivityDueState,
} from "../activities/activity-ui-utils.ts";

interface CalendarEventChipProps {
  readonly event: CrmCalendarEvent;
  readonly density: "compact" | "comfortable";
  readonly draggable: boolean;
  readonly pending: boolean;
  readonly onOpen: (event: CrmCalendarEvent) => void;
  readonly onDragStart: (event: CrmCalendarEvent) => void;
  readonly onDragEnd: () => void;
}

const TONE_CLASSES = {
  overdue:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  today:
    "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  upcoming:
    "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)]",
} as const;

export function CalendarEventChip({
  event,
  density,
  draggable,
  pending,
  onOpen,
  onDragStart,
  onDragEnd,
}: CalendarEventChipProps) {
  const dueState = getActivityDueState(event.dueAt);
  const timeLabel = formatCalendarTimeLabel(event.dueAt);

  const handleDragStart = (dragEvent: DragEvent<HTMLButtonElement>) => {
    dragEvent.dataTransfer.effectAllowed = "move";
    // Some browsers refuse to start a drag without payload.
    dragEvent.dataTransfer.setData("text/plain", event.activityId);
    onDragStart(event);
  };

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={() => onOpen(event)}
      aria-label={`${timeLabel} — ${event.title} — ${event.leadDisplayLabel}`}
      data-testid="crm-calendar-event"
      data-activity-id={event.activityId}
      className={`w-full rounded-[8px] border px-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--crm-primary)] ${
        TONE_CLASSES[dueState]
      } ${density === "compact" ? "py-1" : "py-1.5"} ${
        pending ? "opacity-60" : "hover:border-[var(--crm-border-strong)]"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        {event.isPrimaryNextAction ? (
          <span
            aria-hidden
            title="Primary next action"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--crm-brand-gold)]"
          />
        ) : null}
        <span className="shrink-0 text-[11px] font-semibold tabular-nums">
          {timeLabel}
        </span>
        <span className="truncate text-[11px] font-medium text-[var(--crm-text)]">
          {event.leadDisplayLabel}
        </span>
      </span>
      {density === "comfortable" ? (
        <span className="mt-0.5 block truncate text-[11px] text-[var(--crm-muted)]">
          {event.title} · {formatActivityTypeLabel(event.activityType)}
        </span>
      ) : null}
      {event.isPrimaryNextAction ? (
        <span className="sr-only">Primary next action</span>
      ) : null}
      {pending ? <span className="sr-only">Saving reschedule</span> : null}
    </button>
  );
}
