"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DragEvent } from "react";
import {
  addCalendarDays,
  buildCalendarHref,
  CRM_CALENDAR_DAY_END_HOUR,
  CRM_CALENDAR_DAY_START_HOUR,
  CRM_CALENDAR_EVENT_LIMIT,
  CRM_CALENDAR_VIEWS,
  compareCalendarEvents,
  formatCalendarDayLabel,
  formatCalendarDayNumber,
  formatCalendarHourLabel,
  formatCalendarRangeTitle,
  groupCalendarEventsByLocalDate,
  calendarLocalHour,
  resolveCalendarRescheduleTarget,
  shiftCalendarAnchor,
  type CrmCalendarEvent,
  type CrmCalendarSnapshot,
  type CrmCalendarView,
} from "../../contracts/calendar-contracts.ts";
import { INITIAL_CRM_ACTIVITY_ACTION_STATE } from "../../contracts/activity-contracts.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import { rescheduleLeadActivityAction } from "../../server/crm-activity-actions.ts";
import { CalendarEventChip } from "./CalendarEventChip.tsx";
import { CalendarEventDialog } from "./CalendarEventDialog.tsx";

interface CrmCalendarWorkspaceProps {
  readonly snapshot: CrmCalendarSnapshot;
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly canFilterOwner: boolean;
  readonly canReschedule: boolean;
}

const VIEW_LABELS: Readonly<Record<CrmCalendarView, string>> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const MONTH_CELL_PREVIEW = 3;

export function CrmCalendarWorkspace({
  snapshot,
  assignees,
  canFilterOwner,
  canReschedule,
}: CrmCalendarWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { range, events } = snapshot;

  const [overrides, setOverrides] = useState<Readonly<Record<string, string>>>({});
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Server truth replaces any optimistic move as soon as fresh data arrives.
  // Adjusted during render (React's prop-change pattern) rather than in an
  // effect, so a refreshed snapshot never paints stale optimistic positions.
  const [lastSnapshot, setLastSnapshot] = useState(snapshot);
  if (lastSnapshot !== snapshot) {
    setLastSnapshot(snapshot);
    setOverrides({});
    setPendingActivityId(null);
  }

  const effectiveEvents = useMemo(
    () =>
      events
        .map((event) =>
          overrides[event.activityId]
            ? { ...event, dueAt: overrides[event.activityId]! }
            : event
        )
        .sort(compareCalendarEvents),
    [events, overrides]
  );

  const eventsByDate = useMemo(
    () => groupCalendarEventsByLocalDate(effectiveEvents),
    [effectiveEvents]
  );

  const selectedEvent =
    effectiveEvents.find((event) => event.activityId === selectedId) ?? null;

  const todayLocalDate = snapshot.todayLocalDate;

  const applyReschedule = (activityId: string, dueAtIso: string) => {
    setErrorMessage(null);
    setPendingActivityId(activityId);
    setOverrides((current) => ({ ...current, [activityId]: dueAtIso }));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("activityId", activityId);
      formData.set("dueAt", dueAtIso);
      formData.set("clearReminder", "false");

      const result = await rescheduleLeadActivityAction(
        INITIAL_CRM_ACTIVITY_ACTION_STATE,
        formData
      );

      if (!result.success) {
        // Explicit revert to server state — a failed drag never silently sticks.
        setOverrides((current) => {
          const next = { ...current };
          delete next[activityId];
          return next;
        });
        setPendingActivityId(null);
        setErrorMessage(result.message || "Reschedule failed.");
        return;
      }

      setSelectedId(null);
      router.refresh();
    });
  };

  const handleDrop = (targetLocalDate: string, targetHour: number | null) => {
    setDropTarget(null);
    const activityId = draggingId;
    setDraggingId(null);
    if (!activityId) {
      return;
    }

    const event = effectiveEvents.find((entry) => entry.activityId === activityId);
    if (!event) {
      return;
    }

    const target = resolveCalendarRescheduleTarget({
      currentDueAt: event.dueAt,
      targetLocalDate,
      targetHour,
    });

    if (!target.ok) {
      setErrorMessage(target.reason);
      return;
    }

    applyReschedule(activityId, target.dueAt);
  };

  const dropProps = (key: string, localDate: string, hour: number | null) =>
    canReschedule
      ? {
          onDragOver: (dragEvent: DragEvent<HTMLElement>) => {
            if (!draggingId) {
              return;
            }
            dragEvent.preventDefault();
            dragEvent.dataTransfer.dropEffect = "move";
            setDropTarget(key);
          },
          onDragLeave: () => {
            setDropTarget((current) => (current === key ? null : current));
          },
          onDrop: (dragEvent: DragEvent<HTMLElement>) => {
            dragEvent.preventDefault();
            handleDrop(localDate, hour);
          },
        }
      : {};

  const chipProps = (event: CrmCalendarEvent) => ({
    event,
    draggable: canReschedule,
    pending: pendingActivityId === event.activityId,
    onOpen: (opened: CrmCalendarEvent) => {
      setErrorMessage(null);
      setSelectedId(opened.activityId);
    },
    onDragStart: (dragged: CrmCalendarEvent) => setDraggingId(dragged.activityId),
    onDragEnd: () => {
      setDraggingId(null);
      setDropTarget(null);
    },
  });

  const previousHref = buildCalendarHref(
    range.view,
    shiftCalendarAnchor(range.view, range.anchorDate, -1),
    snapshot.scopeOwnerId
  );
  const nextHref = buildCalendarHref(
    range.view,
    shiftCalendarAnchor(range.view, range.anchorDate, 1),
    snapshot.scopeOwnerId
  );
  const todayHref = buildCalendarHref(
    range.view,
    todayLocalDate,
    snapshot.scopeOwnerId
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={todayHref}
            className="crm-btn crm-btn-secondary min-h-11"
            data-testid="crm-calendar-today"
          >
            Today
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={previousHref}
              aria-label={`Previous ${range.view}`}
              className="crm-btn crm-btn-secondary min-h-11 min-w-11 justify-center px-0"
              data-testid="crm-calendar-prev"
            >
              ‹
            </Link>
            <Link
              href={nextHref}
              aria-label={`Next ${range.view}`}
              className="crm-btn crm-btn-secondary min-h-11 min-w-11 justify-center px-0"
              data-testid="crm-calendar-next"
            >
              ›
            </Link>
          </div>
          <div className="min-w-0">
            <h2
              className="truncate text-[15px] font-semibold text-[var(--crm-text)] sm:text-base"
              data-testid="crm-calendar-range-title"
            >
              {formatCalendarRangeTitle(range)}
            </h2>
            <p className="text-[11px] text-[var(--crm-muted)]">
              Times shown in Asia/Kolkata
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Calendar view"
            className="inline-flex rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0.5"
          >
            {CRM_CALENDAR_VIEWS.map((view) => {
              const active = view === range.view;
              return (
                <Link
                  key={view}
                  role="tab"
                  aria-selected={active}
                  href={buildCalendarHref(
                    view,
                    range.anchorDate,
                    snapshot.scopeOwnerId
                  )}
                  data-testid={`crm-calendar-view-${view}`}
                  className={`inline-flex min-h-10 items-center rounded-[8px] px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--crm-primary-soft)] text-[var(--crm-primary)]"
                      : "text-[var(--crm-muted)] hover:text-[var(--crm-text)]"
                  }`}
                >
                  {VIEW_LABELS[view]}
                </Link>
              );
            })}
          </div>

          {canFilterOwner ? (
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="view" value={range.view} />
              <input type="hidden" name="date" value={range.anchorDate} />
              <label className="text-xs text-[var(--crm-muted)]">
                <span className="sr-only">Owner</span>
                <select
                  name="owner"
                  defaultValue={snapshot.scopeOwnerId ?? "team"}
                  className="crm-select min-h-10"
                >
                  <option value="team">Team</option>
                  {assignees.map((entry) => (
                    <option key={entry.userId} value={entry.userId}>
                      {entry.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="crm-btn crm-btn-secondary min-h-10">
                Apply
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          data-testid="crm-calendar-error"
          className="rounded-[10px] border border-[var(--crm-danger)]/25 bg-[var(--crm-danger-soft)] px-3 py-2 text-sm text-[var(--crm-danger)]"
        >
          {errorMessage}
        </p>
      ) : null}

      {snapshot.truncated ? (
        <p className="rounded-[10px] border border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] px-3 py-2 text-xs text-[var(--crm-warning)]">
          Showing the first {CRM_CALENDAR_EVENT_LIMIT} activities in this range.
          Narrow the range or filter by owner to see the rest.
        </p>
      ) : null}

      {canReschedule ? (
        <p className="text-[11px] text-[var(--crm-muted)]">
          Drag an activity to another slot to reschedule, or open it and use
          Reschedule. Every change is written through the audited reschedule
          action.
        </p>
      ) : null}

      {range.view === "day" ? (
        <DayGrid
          range={range}
          eventsByDate={eventsByDate}
          dropTarget={dropTarget}
          dropProps={dropProps}
          chipProps={chipProps}
        />
      ) : range.view === "week" ? (
        <WeekGrid
          range={range}
          today={todayLocalDate}
          eventsByDate={eventsByDate}
          dropTarget={dropTarget}
          dropProps={dropProps}
          chipProps={chipProps}
        />
      ) : (
        <MonthGrid
          range={range}
          today={todayLocalDate}
          eventsByDate={eventsByDate}
          dropTarget={dropTarget}
          dropProps={dropProps}
          chipProps={chipProps}
          ownerId={snapshot.scopeOwnerId}
        />
      )}

      <CalendarEventDialog
        key={selectedEvent?.activityId ?? "none"}
        event={selectedEvent}
        canReschedule={canReschedule}
        pending={pending}
        errorMessage={errorMessage}
        onReschedule={applyReschedule}
        onClose={() => {
          setSelectedId(null);
          setErrorMessage(null);
        }}
      />
    </div>
  );
}

type EventsByDate = Readonly<Record<string, readonly CrmCalendarEvent[]>>;
type DropPropsFactory = (
  key: string,
  localDate: string,
  hour: number | null
) => Record<string, unknown>;
type ChipPropsFactory = (
  event: CrmCalendarEvent
) => Omit<Parameters<typeof CalendarEventChip>[0], "density">;

function dropHighlightClass(active: boolean): string {
  return active
    ? "border-[var(--crm-primary)] bg-[var(--crm-primary-soft)]"
    : "border-[var(--crm-border)]";
}

function DayGrid({
  range,
  eventsByDate,
  dropTarget,
  dropProps,
  chipProps,
}: {
  readonly range: CrmCalendarSnapshot["range"];
  readonly eventsByDate: EventsByDate;
  readonly dropTarget: string | null;
  readonly dropProps: DropPropsFactory;
  readonly chipProps: ChipPropsFactory;
}) {
  const localDate = range.days[0]!;
  const dayEvents = eventsByDate[localDate] ?? [];
  const hours: number[] = [];
  for (
    let hour = CRM_CALENDAR_DAY_START_HOUR;
    hour <= CRM_CALENDAR_DAY_END_HOUR;
    hour += 1
  ) {
    hours.push(hour);
  }

  const outsideGrid = dayEvents.filter((event) => {
    const hour = calendarLocalHour(event.dueAt);
    return hour < CRM_CALENDAR_DAY_START_HOUR || hour > CRM_CALENDAR_DAY_END_HOUR;
  });

  return (
    <section className="crm-surface overflow-hidden" data-testid="crm-calendar-day">
      {outsideGrid.length > 0 ? (
        <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
            Outside working hours
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {outsideGrid.map((event) => (
              <CalendarEventChip
                key={event.activityId}
                density="comfortable"
                {...chipProps(event)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {dayEvents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--crm-muted)]">
          No scheduled activities on this day. Open a lead to add the next action.
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--crm-border)]">
        {hours.map((hour) => {
          const key = `${localDate}:${hour}`;
          const slotEvents = dayEvents.filter(
            (event) => calendarLocalHour(event.dueAt) === hour
          );
          return (
            <li
              key={key}
              className={`flex gap-3 border-l-2 px-3 py-2 ${dropHighlightClass(
                dropTarget === key
              )}`}
              data-testid="crm-calendar-day-slot"
              data-slot-hour={hour}
              {...dropProps(key, localDate, hour)}
            >
              <span className="w-14 shrink-0 pt-0.5 text-[11px] tabular-nums text-[var(--crm-muted)]">
                {formatCalendarHourLabel(hour)}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                {slotEvents.map((event) => (
                  <CalendarEventChip
                    key={event.activityId}
                    density="comfortable"
                    {...chipProps(event)}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WeekGrid({
  range,
  today,
  eventsByDate,
  dropTarget,
  dropProps,
  chipProps,
}: {
  readonly range: CrmCalendarSnapshot["range"];
  readonly today: string;
  readonly eventsByDate: EventsByDate;
  readonly dropTarget: string | null;
  readonly dropProps: DropPropsFactory;
  readonly chipProps: ChipPropsFactory;
}) {
  return (
    <section data-testid="crm-calendar-week">
      {/* Mobile: stacked agenda. Desktop: seven-column board. */}
      <div className="space-y-2 lg:hidden">
        {range.days.map((localDate) => {
          const dayEvents = eventsByDate[localDate] ?? [];
          return (
            <div
              key={localDate}
              className={`crm-surface border-l-2 p-3 ${dropHighlightClass(
                dropTarget === localDate
              )}`}
              {...dropProps(localDate, localDate, null)}
            >
              <div className="mb-2 flex items-center justify-between">
                <p
                  className={`text-[13px] font-semibold ${
                    localDate === today
                      ? "text-[var(--crm-primary)]"
                      : "text-[var(--crm-text)]"
                  }`}
                >
                  {formatCalendarDayLabel(localDate)}
                  {localDate === today ? (
                    <span className="ml-1.5 text-[11px] font-medium">Today</span>
                  ) : null}
                </p>
                <span className="text-[11px] tabular-nums text-[var(--crm-muted)]">
                  {dayEvents.length}
                </span>
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-[var(--crm-muted)]">Nothing scheduled.</p>
              ) : (
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <CalendarEventChip
                      key={event.activityId}
                      density="comfortable"
                      {...chipProps(event)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden grid-cols-7 gap-2 lg:grid">
        {range.days.map((localDate) => {
          const dayEvents = eventsByDate[localDate] ?? [];
          return (
            <div
              key={localDate}
              className={`crm-surface flex min-h-56 flex-col border-t-2 p-2 ${dropHighlightClass(
                dropTarget === localDate
              )}`}
              data-testid="crm-calendar-week-day"
              data-local-date={localDate}
              {...dropProps(localDate, localDate, null)}
            >
              <p
                className={`mb-2 text-[12px] font-semibold ${
                  localDate === today
                    ? "text-[var(--crm-primary)]"
                    : "text-[var(--crm-text-secondary)]"
                }`}
              >
                {formatCalendarDayLabel(localDate)}
              </p>
              <div className="min-h-0 flex-1 space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="text-[11px] text-[var(--crm-muted)]">—</p>
                ) : (
                  dayEvents.map((event) => (
                    <CalendarEventChip
                      key={event.activityId}
                      density="compact"
                      {...chipProps(event)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthGrid({
  range,
  today,
  eventsByDate,
  dropTarget,
  dropProps,
  chipProps,
  ownerId,
}: {
  readonly range: CrmCalendarSnapshot["range"];
  readonly today: string;
  readonly eventsByDate: EventsByDate;
  readonly dropTarget: string | null;
  readonly dropProps: DropPropsFactory;
  readonly chipProps: ChipPropsFactory;
  readonly ownerId: string | null;
}) {
  const weekdayLabels = range.days.slice(0, 7).map((localDate) => ({
    key: localDate,
    label: formatCalendarDayLabel(localDate).split(" ")[0] ?? "",
  }));

  return (
    <section data-testid="crm-calendar-month">
      <div className="mb-1 hidden grid-cols-7 gap-1 px-1 text-center text-[11px] font-medium text-[var(--crm-muted)] sm:grid">
        {weekdayLabels.map((entry) => (
          <span key={entry.key}>{entry.label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {range.days.map((localDate) => {
          const dayEvents = eventsByDate[localDate] ?? [];
          const inPeriod =
            localDate >= range.periodStartDate && localDate <= range.periodEndDate;
          const preview = dayEvents.slice(0, MONTH_CELL_PREVIEW);
          const overflow = dayEvents.length - preview.length;

          return (
            <div
              key={localDate}
              className={`flex min-h-20 flex-col rounded-[8px] border p-1 sm:min-h-28 ${dropHighlightClass(
                dropTarget === localDate
              )} ${
                inPeriod
                  ? "bg-[var(--crm-surface)]"
                  : "bg-[var(--crm-surface-subtle)]"
              }`}
              data-testid="crm-calendar-month-cell"
              data-local-date={localDate}
              {...dropProps(localDate, localDate, null)}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <Link
                  href={buildCalendarHref("day", localDate, ownerId)}
                  aria-label={`Open ${formatCalendarDayLabel(localDate)} in day view`}
                  className={`inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--crm-primary)] ${
                    localDate === today
                      ? "bg-[var(--crm-primary)] text-white"
                      : inPeriod
                        ? "text-[var(--crm-text)]"
                        : "text-[var(--crm-muted)]"
                  }`}
                >
                  {formatCalendarDayNumber(localDate)}
                </Link>
                {dayEvents.length > 0 ? (
                  <span className="text-[10px] tabular-nums text-[var(--crm-muted)]">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
                {preview.map((event) => (
                  <CalendarEventChip
                    key={event.activityId}
                    density="compact"
                    {...chipProps(event)}
                  />
                ))}
                {overflow > 0 ? (
                  <Link
                    href={buildCalendarHref("day", localDate, ownerId)}
                    className="block px-1 text-[10px] font-medium text-[var(--crm-primary)]"
                  >
                    +{overflow} more
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--crm-muted)]">
        Select a date number to open that day.{" "}
        {range.days.length > 0
          ? `Grid covers ${formatCalendarDayLabel(
              range.visibleStartDate
            )} – ${formatCalendarDayLabel(addCalendarDays(range.visibleEndDate, 0))}.`
          : null}
      </p>
    </section>
  );
}
