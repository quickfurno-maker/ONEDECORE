import {
  WORKFORCE_CATEGORY_LABELS,
  WORKFORCE_STATE_LABELS,
  formatMinutes,
  type WorkforceMonthlySummary,
  type WorkforceSubmissionRow,
} from "../contracts/workforce-contracts.ts";

interface WorkforceMonthlySummaryCardProps {
  readonly summary: WorkforceMonthlySummary;
  readonly heading?: string;
}

interface Tile {
  readonly label: string;
  readonly value: number | string;
  readonly tone?: "default" | "warn" | "good";
}

const TONE_CLASSES = {
  default: "border-neutral-800 bg-neutral-950/60",
  warn: "border-amber-900/60 bg-amber-950/30",
  good: "border-emerald-900/60 bg-emerald-950/30",
} as const;

/**
 * Approved-only month totals.
 *
 * Every count here comes from APPROVED days, so nothing undecided is ever
 * presented as a fact. Days still awaiting a decision are shown separately as
 * "Unresolved" rather than folded into Absent.
 */
export function WorkforceMonthlySummaryCard({
  summary,
  heading = "This month",
}: WorkforceMonthlySummaryCardProps) {
  const tiles: readonly Tile[] = [
    { label: WORKFORCE_CATEGORY_LABELS.FULL_DAY_8H, value: summary.fullDay8hCount },
    { label: WORKFORCE_CATEGORY_LABELS.FULL_DAY_12H, value: summary.fullDay12hCount },
    { label: WORKFORCE_CATEGORY_LABELS.HALF_DAY_4H, value: summary.halfDay4hCount },
    { label: WORKFORCE_CATEGORY_LABELS.WEEKLY_OFF, value: summary.weeklyOffCount },
    { label: WORKFORCE_CATEGORY_LABELS.ABSENT, value: summary.absentCount },
    { label: "Late days", value: summary.lateDayCount, tone: "warn" },
    {
      label: "Credited",
      value: formatMinutes(summary.creditedMinutes),
      tone: "good",
    },
    {
      label: "Unresolved",
      value: summary.unresolvedCount,
      tone: summary.unresolvedCount > 0 ? "warn" : "default",
    },
  ];

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-100">{heading}</h2>
        <p className="text-xs text-neutral-500">
          {summary.monthStart} → {summary.monthEnd} · approved days only
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-lg border px-3 py-2 ${TONE_CLASSES[tile.tone ?? "default"]}`}
          >
            <dt className="text-[11px] uppercase tracking-wide text-neutral-500">
              {tile.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-neutral-100">{tile.value}</dd>
          </div>
        ))}
      </dl>

      {summary.unresolvedCount > 0 ? (
        <p className="mt-4 text-xs text-amber-200">
          {summary.unresolvedCount} day(s) this month are still awaiting a Super Admin
          decision. They are not counted as Absent.
        </p>
      ) : null}
    </section>
  );
}

/** Compact own-attendance history for the month. */
export function WorkforceSubmissionHistory({
  rows,
}: {
  readonly rows: readonly WorkforceSubmissionRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 text-sm text-neutral-400">
        No attendance recorded this month yet.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-neutral-100">Attendance history</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-2 pr-3">Date</th>
              <th scope="col" className="py-2 pr-3">Submitted</th>
              <th scope="col" className="py-2 pr-3">Final</th>
              <th scope="col" className="py-2 pr-3">Credited</th>
              <th scope="col" className="py-2 pr-3">Arrival</th>
              <th scope="col" className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.attendanceDate} className="border-b border-neutral-900">
                <td className="py-2 pr-3 text-neutral-200">{row.attendanceDate}</td>
                <td className="py-2 pr-3 text-neutral-400">
                  {row.submittedCategory
                    ? WORKFORCE_CATEGORY_LABELS[row.submittedCategory]
                    : "—"}
                </td>
                <td className="py-2 pr-3 text-neutral-100">
                  {row.finalCategory
                    ? WORKFORCE_CATEGORY_LABELS[row.finalCategory]
                    : "—"}
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {formatMinutes(row.creditedMinutes)}
                </td>
                <td className="py-2 pr-3 text-neutral-300">
                  {row.isLate ? `Late · ${row.lateMinutes}m` : "On time"}
                </td>
                <td className="py-2 text-neutral-300">
                  {WORKFORCE_STATE_LABELS[row.lifecycleState]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
