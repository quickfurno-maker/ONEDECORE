import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { CrmReportsPanel } from "@/features/crm/components/reports/CrmReportsPanel";
import { parseReportFiltersFromSearchParams } from "@/features/crm/contracts/reporting-date-range.ts";
import { requireCrmReportingAccess } from "@/features/crm/server/crm-auth";
import { fetchCrmReportingSnapshot } from "@/features/crm/server/crm-reporting-queries";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Reports | ONEDECORE",
  description: "Non-commercial CRM reporting for leads, pipeline, and follow-ups.",
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

  const [snapshot, sources, assignees] = await Promise.all([
    fetchCrmReportingSnapshot(filters),
    fetchActiveLeadSources(),
    context.canReadBroad ? fetchCrmAssigneeDirectory(context) : Promise.resolve([]),
  ]);

  const title = context.canReadBroad ? "Reports" : "My Performance";
  const description =
    "Factual lead, pipeline, follow-up, and aging metrics. No commercial achievement or revenue won reporting.";

  return (
    <div className="space-y-6">
      <CrmPageHeader title={title} description={description} />
      {parsed.error ? (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {parsed.error}
        </p>
      ) : null}
      <CrmReportsPanel
        snapshot={snapshot}
        filters={filters}
        sources={sources}
        assignees={assignees}
        canFilterAssignee={context.canReadBroad}
      />
    </div>
  );
}
