import Link from "next/link";
import type { CrmReportingSnapshot } from "../../contracts/reporting-contracts.ts";
import type { ReportFilters } from "../../contracts/reporting-contracts.ts";
import type { CrmLeadSourceOption } from "../../contracts/lead-detail-dtos.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";

interface CrmReportsPanelProps {
  readonly snapshot: CrmReportingSnapshot;
  readonly filters: ReportFilters;
  readonly sources: readonly CrmLeadSourceOption[];
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly canFilterAssignee: boolean;
}

export function CrmReportsPanel({
  snapshot,
  filters,
  sources,
  assignees,
  canFilterAssignee,
}: CrmReportsPanelProps) {
  const maxTrend = Math.max(...snapshot.trend.map((point) => point.count), 1);
  const maxSource = Math.max(...snapshot.sourceMix.map((item) => item.count), 1);

  return (
    <div className="space-y-8">
      <form method="get" className="grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-neutral-400">
          Preset
          <select
            name="preset"
            defaultValue={filters.dateRange.preset}
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="text-xs text-neutral-400">
          Source
          <select
            name="source"
            defaultValue={filters.sourceId ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-400">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {Object.keys(snapshot.summary.statusCounts).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {canFilterAssignee ? (
          <label className="text-xs text-neutral-400">
            Assignee
            <select
              name="assignee"
              defaultValue={filters.assigneeId ?? ""}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value="">All assignees</option>
              {assignees.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950"
          >
            Apply filters
          </button>
        </div>
      </form>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Lead volume</h2>
        <p className="mt-1 text-xs text-neutral-500">{filters.dateRange.label}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Total leads" value={snapshot.summary.totalLeads} />
          <KpiCard label="Closed lost" value={snapshot.summary.closedLostCount} />
          <KpiCard
            label="Closed won (pipeline status)"
            value={snapshot.summary.closedWonCount}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Pipeline status</h2>
        <div className="mt-3 grid gap-2">
          {Object.entries(snapshot.summary.statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm"
            >
              <span className="text-neutral-300">{status}</span>
              <span className="font-medium text-neutral-100">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Lead trend</h2>
        <div className="mt-3 space-y-2">
          {snapshot.trend.map((point) => (
            <div key={point.bucket} className="flex items-center gap-3 text-xs">
              <span className="w-24 text-neutral-500">{point.bucket}</span>
              <div className="h-2 flex-1 rounded bg-neutral-800">
                <div
                  className="h-2 rounded bg-amber-400/80"
                  style={{ width: `${(point.count / maxTrend) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-neutral-300">{point.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Lead sources</h2>
        <div className="mt-3 space-y-2">
          {snapshot.sourceMix.map((item) => (
            <div key={item.sourceId} className="flex items-center gap-3 text-xs">
              <span className="w-40 truncate text-neutral-400">{item.sourceName}</span>
              <div className="h-2 flex-1 rounded bg-neutral-800">
                <div
                  className="h-2 rounded bg-amber-400/60"
                  style={{ width: `${(item.count / maxSource) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-neutral-300">{item.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Assignment / workload</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr>
              <th className="pb-2">Assignee</th>
              <th className="pb-2 text-right">Leads</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.assigneeWorkload.map((item) => (
              <tr key={item.assigneeId ?? "unassigned"} className="border-t border-neutral-800">
                <td className="py-2 text-neutral-300">{item.assigneeName}</td>
                <td className="py-2 text-right text-neutral-100">{item.leadCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Follow-up health</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <KpiCard label="Open" value={snapshot.followUps.open} />
          <KpiCard label="Overdue" value={snapshot.followUps.overdue} />
          <KpiCard label="Due soon" value={snapshot.followUps.dueSoon} />
          <KpiCard label="Completed" value={snapshot.followUps.completed} />
          <KpiCard label="Cancelled" value={snapshot.followUps.cancelled} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Lead aging</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {snapshot.agingBuckets.map((bucket) => (
            <KpiCard key={bucket.label} label={bucket.label} value={bucket.count} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Closed-lost reasons</h2>
        {snapshot.closedLostReasons.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">No closed-lost leads in range.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="pb-2">Reason</th>
                <th className="pb-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.closedLostReasons.map((item) => (
                <tr key={item.reasonCode} className="border-t border-neutral-800">
                  <td className="py-2 text-neutral-300">{item.reasonName}</td>
                  <td className="py-2 text-right text-neutral-100">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Non-commercial reporting only.{" "}
        <Link href="/admin/crm/targets" className="text-amber-300 underline">
          Target configuration
        </Link>{" "}
        does not include achievement until Phase 7B.
      </p>
    </div>
  );
}

function KpiCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-50">{value}</p>
    </div>
  );
}
