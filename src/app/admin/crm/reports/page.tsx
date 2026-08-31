import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { CrmReportsPanel } from "@/features/crm/components/reports/CrmReportsPanel";
import { CrmManagementAnalyticsPanel } from "@/features/crm/components/reports/CrmManagementAnalyticsPanel";
import { parseReportFiltersFromSearchParams } from "@/features/crm/contracts/reporting-date-range.ts";
import { requireCrmReportingAccess } from "@/features/crm/server/crm-auth";
import { fetchCrmReportingSnapshot } from "@/features/crm/server/crm-reporting-queries";
import { fetchCrmManagementAnalytics } from "@/features/crm/server/crm-management-analytics-queries";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Reports | ONEDECORE",
  description:
    "CRM management analytics: first-response SLA, velocity, conversion, forecast and target achievement.",
};

interface CrmReportsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmReportsPage({ searchParams }: CrmReportsPageProps) {
  const context = await requireCrmReportingAccess();
  const params = new URLSearchParams();
  const raw = await searchParams;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const parsed = parseReportFiltersFromSearchParams(params);
  const filters =
    parsed.filters ??
    parseReportFiltersFromSearchParams(new URLSearchParams()).filters!;

  const [snapshot, analytics, sources, assignees] = await Promise.all([
    fetchCrmReportingSnapshot(filters),
    fetchCrmManagementAnalytics(context, filters),
    fetchActiveLeadSources(),
    context.canReadBroad ? fetchCrmAssigneeDirectory(context) : Promise.resolve([]),
  ]);

  // Managers and super-admin get Management Analytics; a sales executive without
  // broad lead read gets My Performance, pinned to their own scope server-side.
  const isManagementView = context.canReadBroad;
  const title = isManagementView ? "Management Analytics" : "My Performance";
  const description = isManagementView
    ? "First-response SLA, sales velocity, conversion, current forecast and target achievement across your authorised CRM scope."
    : "Your first-response SLA, velocity, conversion, current forecast and target achievement. Personal scope only.";

  return (
    <div className="space-y-6">
      <CrmPageHeader title={title} description={description} />
      {parsed.error ? (
        <p className="rounded-[8px] border border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] px-3 py-2 text-[13px] text-[var(--crm-danger)]">
          {parsed.error}
        </p>
      ) : null}
      <CrmReportsPanel
        snapshot={snapshot}
        filters={filters}
        sources={sources}
        assignees={assignees}
        canFilterAssignee={context.canReadBroad}
        analytics={
          <CrmManagementAnalyticsPanel
            bundle={analytics}
            filters={filters}
            isManagementView={isManagementView}
          />
        }
      />
    </div>
  );
}
