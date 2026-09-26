"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  moveScheduledInstantToDate,
  schedulerDateKey,
  schedulerMonthCells,
  schedulerStatusLabel,
  schedulerStatusTone,
  schedulerTimeLabel,
  schedulerWeekDates,
  type WhatsappSchedulerEvent,
  type WhatsappSchedulerView,
} from "../../contracts/campaign-scheduler.ts";
import { INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE } from "../../contracts/control-plane.ts";
import { rescheduleWhatsappCampaignRunAction } from "../../server/whatsapp-campaign-actions.ts";
import { ControlPlaneActionMessage } from "../control-plane/ControlPlaneActionMessage.tsx";

const DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dateLabel(dateKey: string): string {
  return DAY.format(new Date(`${dateKey}T12:00:00Z`));
}

function sourceTimeValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "09";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

type PendingMove = {
  readonly event: WhatsappSchedulerEvent;
  readonly dateKey: string;
  readonly time: string;
};

const SCHEDULER_FILTERS = [
  ["all", "All"],
  ["scheduled", "Scheduled"],
  ["active", "Active"],
  ["attention", "Needs attention"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;
type SchedulerFilter = (typeof SCHEDULER_FILTERS)[number][0];

function matchesSchedulerFilter(event: WhatsappSchedulerEvent, filter: SchedulerFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") return event.status === "scheduled";
  if (filter === "active") return ["materializing", "ready", "dispatching", "paused"].includes(event.status);
  if (filter === "attention") return ["reconciling", "failed"].includes(event.status);
  if (filter === "completed") return event.status === "completed";
  return event.status === "cancelled";
}

function scheduledIso(dateKey: string, time: string): string {
  const result = new Date(`${dateKey}T${time}:00+05:30`);
  return Number.isNaN(result.getTime()) ? "" : result.toISOString();
}
function EventCard({
  event,
  onMove,
  onSelect,
}: {
  readonly event: WhatsappSchedulerEvent;
  readonly onMove: (event: WhatsappSchedulerEvent) => void;
  readonly onSelect: (event: WhatsappSchedulerEvent) => void;
}) {
  return (
    <article
      className="od-scheduler__event"
      data-status={event.status}
      draggable={event.canReschedule}
      onDragStart={(dragEvent) => {
        if (!event.canReschedule) return;
        dragEvent.dataTransfer.setData("text/plain", event.runId);
        dragEvent.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="od-scheduler__event-topline">
        <time dateTime={event.scheduledFor}>{schedulerTimeLabel(event.scheduledFor)}</time>
        <span className="od-scheduler__status" data-tone={schedulerStatusTone(event.status)}>
          {schedulerStatusLabel(event.status)}
        </span>
      </div>
      <button
        className="od-scheduler__event-title"
        type="button"
        onClick={() => onSelect(event)}
      >
        {event.campaignName}
      </button>
      <span className="od-scheduler__event-meta">
        {event.templateName ?? "Template setup required"}
      </span>
      {event.totalCount > 0 || event.eligibleCount > 0 ? (
        <span className="od-scheduler__event-meta">
          {event.eligibleCount.toLocaleString("en-IN")} eligible /{" "}
          {event.totalCount.toLocaleString("en-IN")} materialised
        </span>
      ) : (
        <span className="od-scheduler__event-meta">Audience resolves at delivery</span>
      )}
      {event.canReschedule ? (
        <button
          className="od-scheduler__event-move"
          type="button"
          onClick={() => onMove(event)}
        >
          Reschedule
        </button>
      ) : null}
    </article>
  );
}
export function CampaignSchedulerCalendar({
  events,
  view,
  month,
  anchorDate,
  previousHref,
  nextHref,
  todayHref,
  monthHref,
  weekHref,
  agendaHref,
  todayDateKey,
}: {
  readonly events: readonly WhatsappSchedulerEvent[];
  readonly view: WhatsappSchedulerView;
  readonly month: string;
  readonly anchorDate: string;
  readonly previousHref: string;
  readonly nextHref: string;
  readonly todayHref: string;
  readonly monthHref: string;
  readonly weekHref: string;
  readonly agendaHref: string;
  readonly todayDateKey: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    rescheduleWhatsappCampaignRunAction,
    INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE
  );
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WhatsappSchedulerEvent | null>(null);
  const [filter, setFilter] = useState<SchedulerFilter>("all");

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesSchedulerFilter(event, filter)),
    [events, filter]
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  const byDate = useMemo(() => {
    const map = new Map<string, WhatsappSchedulerEvent[]>();
    for (const event of visibleEvents) {
      const key = schedulerDateKey(event.scheduledFor);
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
    }
    return map;
  }, [visibleEvents]);

  const openMove = (event: WhatsappSchedulerEvent, dateKey?: string) => {
    setPendingMove({
      event,
      dateKey: dateKey ?? schedulerDateKey(event.scheduledFor),
      time: sourceTimeValue(event.scheduledFor),
    });
  };

  const onDrop = (dateKey: string, runId: string) => {
    const event = events.find((candidate) => candidate.runId === runId);
    if (!event?.canReschedule) return;
    const moved = moveScheduledInstantToDate(event.scheduledFor, dateKey);
    if (!moved || schedulerDateKey(moved) === schedulerDateKey(event.scheduledFor)) return;
    openMove(event, dateKey);
  };
  const renderDay = (dateKey: string, compact = false) => {
    const rows = byDate.get(dateKey) ?? [];
    const inMonth = dateKey.startsWith(month);
    return (
      <div
        key={dateKey}
        className="od-scheduler__day"
        data-outside={!inMonth || undefined}
        data-today={dateKey === todayDateKey || undefined}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("text/plain")) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(dateKey, event.dataTransfer.getData("text/plain"));
        }}
      >
        <div className="od-scheduler__day-head">
          <time dateTime={dateKey}>{compact ? dateLabel(dateKey) : Number(dateKey.slice(-2))}</time>
          {rows.length > 0 ? <span>{rows.length}</span> : null}
        </div>
        <div className="od-scheduler__day-events">
          {rows.map((event) => (
            <EventCard key={event.runId} event={event} onMove={openMove} onSelect={setSelectedEvent} />
          ))}
        </div>
      </div>
    );
  };

  const agendaEvents = visibleEvents
    .filter((event) => schedulerDateKey(event.scheduledFor).startsWith(month))
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));

  return (
    <section className="od-scheduler__calendar-shell" aria-labelledby="campaign-scheduler-calendar">
      <header className="od-scheduler__calendar-toolbar">
        <div>
          <p className="od-growth__eyebrow">Delivery calendar</p>
          <h2 id="campaign-scheduler-calendar">Campaign calendar</h2>
        </div>
        <div className="od-scheduler__toolbar-actions">
          <Link className="od-cp__btn od-cp__btn--quiet" href={todayHref}>
            Today
          </Link>
          <div className="od-scheduler__pager">
            <Link href={previousHref} aria-label="Previous period">←</Link>
            <Link href={nextHref} aria-label="Next period">→</Link>
          </div>
          <nav className="od-scheduler__view-switch" aria-label="Calendar view">
            <Link href={monthHref} data-active={view === "month"}>Month</Link>
            <Link href={weekHref} data-active={view === "week"}>Week</Link>
            <Link href={agendaHref} data-active={view === "agenda"}>Agenda</Link>
          </nav>
        </div>
      </header>
      <div className="od-scheduler__filters" aria-label="Filter campaign calendar">
        {SCHEDULER_FILTERS.map(([value, label]) => {
          const count = events.filter((event) => matchesSchedulerFilter(event, value)).length;
          return (
            <button
              key={value}
              type="button"
              data-active={filter === value}
              onClick={() => setFilter(value)}
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
      {view === "month" ? (
        <div className="od-scheduler__month">
          <div className="od-scheduler__weekday-row" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="od-scheduler__month-grid">
            {schedulerMonthCells(month).map((dateKey) => renderDay(dateKey))}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="od-scheduler__week">
          {schedulerWeekDates(anchorDate).map((dateKey) => renderDay(dateKey, true))}
        </div>
      ) : null}

      {view === "agenda" ? (
        <div className="od-scheduler__agenda">
          {agendaEvents.length === 0 ? (
            <p className="od-cp__empty">No campaign delivery is scheduled in this month.</p>
          ) : (
            agendaEvents.map((event) => (
              <div className="od-scheduler__agenda-row" key={event.runId}>
                <div className="od-scheduler__agenda-date">
                  <strong>{dateLabel(schedulerDateKey(event.scheduledFor))}</strong>
                  <span>{schedulerTimeLabel(event.scheduledFor)}</span>
                </div>
                <EventCard event={event} onMove={openMove} onSelect={setSelectedEvent} />
              </div>
            ))
          )}
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="od-scheduler__drawer-backdrop" role="presentation" onMouseDown={() => setSelectedEvent(null)}>
          <aside
            className="od-scheduler__drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduler-event-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="od-scheduler__drawer-head">
              <div>
                <p className="od-growth__eyebrow">Scheduled campaign</p>
                <h3 id="scheduler-event-detail-title">{selectedEvent.campaignName}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close campaign details">×</button>
            </div>
            <span className="od-scheduler__status" data-tone={schedulerStatusTone(selectedEvent.status)}>
              {schedulerStatusLabel(selectedEvent.status)}
            </span>
            <dl className="od-scheduler__drawer-facts">
              <div><dt>Delivery</dt><dd>{dateLabel(schedulerDateKey(selectedEvent.scheduledFor))} · {schedulerTimeLabel(selectedEvent.scheduledFor)} IST</dd></div>
              <div><dt>Template</dt><dd>{selectedEvent.templateName ?? "Template setup required"}</dd></div>
              <div><dt>Audience</dt><dd>{selectedEvent.totalCount > 0 ? `${selectedEvent.eligibleCount.toLocaleString("en-IN")} eligible / ${selectedEvent.totalCount.toLocaleString("en-IN")} materialised` : "Resolves from live CRM truth at delivery"}</dd></div>
              <div><dt>Sent</dt><dd>{selectedEvent.sentCount.toLocaleString("en-IN")}</dd></div>
            </dl>
            <div className="od-scheduler__drawer-note">
              The audience rule is fixed, but matching people are recalculated when delivery begins. The resulting run recipient set is then frozen for consistent dispatch.
            </div>
            <div className="od-scheduler__drawer-actions">
              {selectedEvent.canReschedule ? (
                <button className="od-cp__btn od-cp__btn--primary" type="button" onClick={() => { openMove(selectedEvent); setSelectedEvent(null); }}>
                  Reschedule
                </button>
              ) : null}
              <Link className="od-cp__btn od-cp__btn--quiet" href={`/admin/whatsapp/campaigns?version=${selectedEvent.campaignVersionId}`}>
                Open campaign
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {state.message ? (
        <div className="od-scheduler__action-message">
          <ControlPlaneActionMessage state={state} />
        </div>
      ) : null}
      {pendingMove ? (
        <div className="od-scheduler__modal-backdrop" role="presentation">
          <section
            className="od-scheduler__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduler-reschedule-title"
          >
            <p className="od-growth__eyebrow">Confirm schedule change</p>
            <h3 id="scheduler-reschedule-title">{pendingMove.event.campaignName}</h3>
            <p>
              Move this campaign to a new delivery slot. CRM membership is not frozen now;
              Hot / Warm / Cold and every other audience rule are evaluated again when the
              run becomes due.
            </p>
            <form
              action={action}
              className="od-cp__stack"
              onSubmit={() => setPendingMove(null)}
            >
              <input type="hidden" name="runId" value={pendingMove.event.runId} />
              <input
                type="hidden"
                name="scheduledFor"
                value={scheduledIso(pendingMove.dateKey, pendingMove.time)}
              />
              <div className="od-cp__grid">
                <label className="od-cp__field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={pendingMove.dateKey}
                    onChange={(event) =>
                      setPendingMove((current) =>
                        current ? { ...current, dateKey: event.target.value } : current
                      )
                    }
                    required
                  />
                </label>
                <label className="od-cp__field">
                  <span>Time · IST</span>
                  <input
                    type="time"
                    value={pendingMove.time}
                    onChange={(event) =>
                      setPendingMove((current) =>
                        current ? { ...current, time: event.target.value } : current
                      )
                    }
                    required
                  />
                </label>
              </div>
              <div className="od-scheduler__modal-actions">
                <button
                  type="button"
                  className="od-cp__btn od-cp__btn--quiet"
                  onClick={() => setPendingMove(null)}
                  disabled={pending}
                >
                  Keep current time
                </button>
                <button
                  type="submit"
                  className="od-cp__btn od-cp__btn--primary"
                  disabled={pending || !scheduledIso(pendingMove.dateKey, pendingMove.time)}
                >
                  {pending ? "Rescheduling…" : "Confirm reschedule"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
