import type { TeamAttendanceRow } from "../contracts/dto.ts";
import { AttendanceStatusBadge } from "./AttendanceTodayCard.tsx";

interface AttendanceTeamTableProps {
  readonly rows: readonly TeamAttendanceRow[];
}

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceTeamTable({ rows }: AttendanceTeamTableProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10 text-sm text-neutral-400">
        No direct reports with attendance eligibility were found for today.
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-900/80">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Team member
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Last check-in
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-300">
              Flags
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
          {rows.map((row) => (
            <tr key={row.staffId}>
              <td className="px-4 py-3 font-medium text-neutral-100">{row.displayName}</td>
              <td className="px-4 py-3">
                <AttendanceStatusBadge status={row.todayStatus} />
                {row.openSession ? (
                  <span className="ml-2 text-xs text-emerald-300">Open</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-neutral-400">{formatTime(row.lastCheckInAt)}</td>
              <td className="px-4 py-3 text-neutral-400">
                {[
                  row.isLate ? "Late" : null,
                  row.isEarlyCheckout ? "Early out" : null,
                  row.isMissingCheckout ? "Missing checkout" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
