import Link from "next/link";
import type { AttendanceDaySummary, AttendanceMonthSummary } from "../contracts/dto.ts";
import { AttendanceStatusBadge } from "./AttendanceTodayCard.tsx";

interface AttendanceCalendarProps {
  readonly summary: AttendanceMonthSummary;
  readonly year: number;
  readonly month: number;
}

function formatWorkedMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function dayByDate(days: readonly AttendanceDaySummary[]): Readonly<Record<string, AttendanceDaySummary>> {
  return Object.fromEntries(days.map((day) => [day.attendanceDate, day]));
}

export function AttendanceCalendar({ summary, year, month }: AttendanceCalendarProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const dayMap = dayByDate(summary.days);
  const cells: Array<{ key: string; date: string | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `pad-${index}`, date: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ key: date, date });
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/admin/attendance/calendar?year=${prevYear}&month=${prevMonth}`}
          className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-400"
        >
          Previous
        </Link>
        <h2 className="text-lg font-semibold text-neutral-50">
          {new Date(year, month - 1, 1).toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <Link
          href={`/admin/attendance/calendar?year=${nextYear}&month=${nextMonth}`}
          className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-amber-400"
        >
          Next
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-neutral-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="min-h-24 rounded-md border border-transparent" />;
          }

          const day = dayMap[cell.date];
          const dayNumber = Number(cell.date.slice(-2));

          return (
            <article
              key={cell.key}
              className="min-h-24 rounded-md border border-neutral-800 bg-neutral-900/50 p-2 text-left"
            >
              <p className="text-xs font-semibold text-neutral-300">{dayNumber}</p>
              {day ? (
                <div className="mt-2 space-y-1">
                  <AttendanceStatusBadge status={day.primaryStatus} />
                  <p className="text-[11px] text-neutral-500">
                    {formatWorkedMinutes(day.workedMinutes)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-neutral-600">No record</p>
              )}
            </article>
          );
        })}
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <h3 className="text-sm font-semibold text-neutral-200">Month totals</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-neutral-500">Present</dt>
            <dd className="text-neutral-100">{summary.totals.presentDays}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Absent</dt>
            <dd className="text-neutral-100">{summary.totals.absentDays}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Leave</dt>
            <dd className="text-neutral-100">{summary.totals.leaveDays}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Worked</dt>
            <dd className="text-neutral-100">
              {formatWorkedMinutes(summary.totals.workedMinutes)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
