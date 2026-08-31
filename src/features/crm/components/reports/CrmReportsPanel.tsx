import type { ReactNode } from "react";
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
  /**
   * CRM 2E management analytics, rendered directly under the shared filter form
   * so both surfaces are governed by one set of filters.
   */
  readonly analytics?: ReactNode;
}

export function CrmReportsPanel({
  snapshot,
  filters,
  sources,
  assignees,
  canFilterAssignee,
  analytics,
}: CrmReportsPanelProps) {
  const maxTrend = Math.max(...snapshot.trend.map((point) => point.count), 1);
  const maxSource = Math.max(...snapshot.sourceMix.map((item) => item.count), 1);

  return (
    <div className="space-y-6">
      <form
        method="get"
        className="crm-surface grid gap-3 rounded-[14px] p-3.5 sm:grid-cols-2 sm:rounded-[var(--crm-radius)] sm:p-4 lg:grid-cols-4"
      >
        <label className="text-[11px] text-[var(--crm-muted)]">
          Preset
          <select
            name="preset"
            defaultValue={filters.dateRange.preset}
            className="crm-select mt-1 w-full"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="text-[11px] text-[var(--crm-muted)]">
          Source
          <select
            name="source"
            defaultValue={filters.sourceId ?? ""}
            className="crm-select mt-1 w-full"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-[var(--crm-muted)]">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="crm-select mt-1 w-full"
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
          <label className="text-[11px] text-[var(--crm-muted)]">
            Assignee
            <select
              name="assignee"
              defaultValue={filters.assigneeId ?? ""}
              className="crm-select mt-1 w-full"
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
          <button type="submit" className="crm-btn crm-btn-primary">
            Apply filters
          </button>
        </div>
      </form>

      {analytics}

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Lead volume
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
          {filters.dateRange.label}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <KpiCard label="Total leads" value={snapshot.summary.totalLeads} />
          <KpiCard label="Closed lost" value={snapshot.summary.closedLostCount} />
          <KpiCard
            label="Closed won (pipeline status)"
            value={snapshot.summary.closedWonCount}
          />
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Pipeline status
        </h2>
        <div className="mt-3 grid gap-2">
          {Object.entries(snapshot.summary.statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center justify-between rounded-[8px] border border-[var(--crm-border)] px-3 py-2 text-[13px]"
            >
              <span className="text-[var(--crm-text-secondary)]">{status}</span>
              <span className="font-medium tabular-nums text-[var(--crm-text)]">
                {count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Lead trend
        </h2>
        <div className="mt-3 space-y-2">
          {snapshot.trend.map((point) => (
            <div key={point.bucket} className="flex items-center gap-3 text-[11px]">
              <span className="w-24 shrink-0 text-[var(--crm-muted)]">
                {point.bucket}
              </span>
              <div className="h-2 flex-1 rounded bg-[var(--crm-surface-subtle)]">
                <div
                  className="h-2 rounded bg-[var(--crm-primary)]"
                  style={{ width: `${(point.count / maxTrend) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-[var(--crm-text-secondary)]">
                {point.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Lead sources
        </h2>
        <div className="mt-3 space-y-2">
          {snapshot.sourceMix.map((item) => (
            <div key={item.sourceId} className="flex items-center gap-3 text-[11px]">
              <span className="w-32 shrink-0 truncate text-[var(--crm-text-secondary)] sm:w-40">
                {item.sourceName}
              </span>
              <div className="h-2 flex-1 rounded bg-[var(--crm-surface-subtle)]">
                <div
                  className="h-2 rounded bg-[var(--crm-info)]"
                  style={{ width: `${(item.count / maxSource) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-[var(--crm-text-secondary)]">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Assignment / workload
        </h2>
        <div className="crm-scrollbar-x -mx-1 mt-3 overflow-x-auto px-1">
          <table className="w-full min-w-[280px] text-left text-[13px]">
            <thead className="text-[11px] text-[var(--crm-muted)]">
              <tr>
                <th scope="col" className="pb-2 font-medium">Assignee</th>
                <th scope="col" className="pb-2 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.assigneeWorkload.map((item) => (
                <tr
                  key={item.assigneeId ?? "unassigned"}
                  className="border-t border-[var(--crm-border)]"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-normal text-[var(--crm-text-secondary)]"
                  >
                    {item.assigneeName}
                  </th>
                  <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                    {item.leadCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Follow-up health
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Open" value={snapshot.followUps.open} />
          <KpiCard label="Overdue" value={snapshot.followUps.overdue} />
          <KpiCard label="Due soon" value={snapshot.followUps.dueSoon} />
          <KpiCard label="Completed" value={snapshot.followUps.completed} />
          <KpiCard label="Cancelled" value={snapshot.followUps.cancelled} />
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Lead aging
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {snapshot.agingBuckets.map((bucket) => (
            <KpiCard key={bucket.label} label={bucket.label} value={bucket.count} />
          ))}
        </div>
      </section>

      <section className="crm-surface rounded-[14px] p-3.5 sm:rounded-[var(--crm-radius)] sm:p-4">
        <h2 className="text-[13px] font-semibold text-[var(--crm-text)]">
          Closed-lost reasons
        </h2>
        {snapshot.closedLostReasons.length === 0 ? (
          <p className="mt-2 text-[11px] text-[var(--crm-muted)]">
            No closed-lost leads in range.
          </p>
        ) : (
          <div className="crm-scrollbar-x -mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full min-w-[280px] text-left text-[13px]">
              <thead className="text-[11px] text-[var(--crm-muted)]">
                <tr>
                  <th scope="col" className="pb-2 font-medium">Reason</th>
                  <th scope="col" className="pb-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.closedLostReasons.map((item) => (
                  <tr
                    key={item.reasonCode}
                    className="border-t border-[var(--crm-border)]"
                  >
                    <th
                      scope="row"
                      className="py-2 pr-3 font-normal text-[var(--crm-text-secondary)]"
                    >
                      {item.reasonName}
                    </th>
                    <td className="py-2 text-right tabular-nums text-[var(--crm-text)]">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-[11px] text-[var(--crm-muted)]">
        <p>
          Lead, follow-up and aging metrics above are counts only. Target
          configuration is managed separately; achievement shown here is
          accepted-quotation truth.
        </p>
        <Link
          href="/admin/crm/targets"
          className="mt-1 inline-flex min-h-11 items-center text-[var(--crm-primary)] underline"
        >
          Target configuration
        </Link>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-[12px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 sm:rounded-[8px]">
      <p className="text-[11px] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-[var(--crm-text)] sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}
