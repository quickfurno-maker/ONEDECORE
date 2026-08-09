import type { ReactNode } from "react";
import type {
  AttendancePrimaryStatus,
  AttendanceToday,
} from "../contracts/dto.ts";

const STATUS_STYLES: Readonly<Record<AttendancePrimaryStatus, string>> = {
  present: "bg-emerald-950/70 text-emerald-200 border-emerald-900/60",
  absent: "bg-neutral-800 text-neutral-300 border-neutral-700",
  half_day: "bg-amber-950/70 text-amber-200 border-amber-900/60",
  leave: "bg-sky-950/70 text-sky-200 border-sky-900/60",
  weekly_off: "bg-violet-950/70 text-violet-200 border-violet-900/60",
  holiday: "bg-indigo-950/70 text-indigo-200 border-indigo-900/60",
};

function formatStatusLabel(status: AttendancePrimaryStatus): string {
  return status.replaceAll("_", " ");
}

interface AttendanceStatusBadgeProps {
  readonly status: AttendancePrimaryStatus | "unknown";
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  if (status === "unknown") {
    return (
      <span className="inline-flex items-center rounded border border-neutral-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        Unknown
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWorkedMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

interface AttendanceTodayCardProps {
  readonly today: AttendanceToday;
  readonly showLocationSelector?: boolean;
  readonly checkInAction: ReactNode;
  readonly checkOutAction: ReactNode;
}

export function AttendanceTodayCard({
  today,
  showLocationSelector = false,
  checkInAction,
  checkOutAction,
}: AttendanceTodayCardProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
            Today
          </p>
          <p className="mt-1 text-sm text-neutral-400">{today.attendanceDate}</p>
          <div className="mt-3">
            <AttendanceStatusBadge status={today.primaryStatus} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {today.openSession ? checkOutAction : checkInAction}
          {today.openSession ? (
            <p className="text-xs text-emerald-300">Open session</p>
          ) : (
            <p className="text-xs text-neutral-500">No open session</p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-in</dt>
          <dd className="mt-1 text-neutral-100">{formatTime(today.firstCheckInAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Check-out</dt>
          <dd className="mt-1 text-neutral-100">{formatTime(today.lastCheckOutAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Worked</dt>
          <dd className="mt-1 text-neutral-100">
            {formatWorkedMinutes(today.workedMinutesSoFar)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Flags</dt>
          <dd className="mt-1 text-neutral-300">
            {[
              today.isLate ? "Late" : null,
              today.isEarlyCheckout ? "Early out" : null,
              today.isMissingCheckout ? "Missing checkout" : null,
              today.hasManualAdjustment ? "Adjusted" : null,
            ]
              .filter(Boolean)
              .join(", ") || "None"}
          </dd>
        </div>
      </dl>

      {showLocationSelector ? (
        <p className="mt-4 text-xs text-neutral-500">
          Location category may be required by the active attendance policy.
        </p>
      ) : null}
    </section>
  );
}
