import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadListCards } from "@/features/crm/components/leads/LeadListCards";
import { LeadListEmpty } from "@/features/crm/components/leads/LeadListEmpty";
import { LeadListFilters } from "@/features/crm/components/leads/LeadListFilters";
import {
  parseLeadListQuery,
  buildLeadListHref,
  PIPELINE_STAGE_PREVIEW_SIZE,
} from "@/features/crm/contracts/lead-list-query";
import { LeadListPagination } from "@/features/crm/components/leads/LeadListPagination";
import { LeadListTable } from "@/features/crm/components/leads/LeadListTable";
import { LeadPipelineBoard } from "@/features/crm/components/leads/LeadPipelineBoard";
import { LEAD_STAGE_CODES } from "@/features/crm/contracts/lead-stages";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import {
  countLeadListForCurrentUser,
  getLeadListPageForCurrentUser,
} from "@/features/crm/server/crm-lead-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Leads | ONEDECORE",
  description: "Operational lead queue for authorized ONEDECORE staff.",
};

interface CrmLeadsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmLeadsPage({ searchParams }: CrmLeadsPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = parseLeadListQuery(resolvedSearchParams);
  const view =
    (Array.isArray(resolvedSearchParams.view)
      ? resolvedSearchParams.view[0]
      : resolvedSearchParams.view) === "pipeline"
      ? "pipeline"
      : "table";
  const context = await getCrmAccessContext();

  if (!context) {
    return null;
  }

  const pipelineBase = { ...query, status: null, page: 1, pageSize: PIPELINE_STAGE_PREVIEW_SIZE };
  const [page, sources, assignees, pipelineStages] = await Promise.all([
    view === "pipeline"
      ? Promise.resolve(null)
      : getLeadListPageForCurrentUser(query),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
    view === "pipeline"
      ? Promise.all(
          LEAD_STAGE_CODES.map(async (status) => {
            const stageQuery = { ...pipelineBase, status };
            const [total, preview] = await Promise.all([
              countLeadListForCurrentUser(stageQuery),
              getLeadListPageForCurrentUser(stageQuery),
            ]);
            return { status, total, items: preview.items };
          })
        )
      : Promise.resolve([]),
  ]);

  const tableHref = buildLeadListHref(query, "table");
  const pipelineHref = buildLeadListHref(query, "pipeline");
  const pipelineEmpty = pipelineStages.every((stage) => stage.total === 0);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Leads"
        description="Track, qualify and move opportunities forward."
        actions={
          context.canCreateLeads ? (
            <Link
              href="/admin/crm/leads/new"
              className="inline-flex min-h-11 items-center rounded-[8px] bg-[var(--od-gold)] px-4 py-2 text-sm font-semibold text-[#1a1408] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
            >
              + New Lead
            </Link>
          ) : null
        }
      />

      <div className="flex justify-end gap-1">
        <Link
          href={tableHref}
          className={`inline-flex min-h-9 items-center rounded-[8px] px-3 text-sm ${view === "table" ? "bg-[var(--od-gold)]/15 text-[var(--od-text)]" : "text-[var(--od-muted)]"}`}
        >
          Table
        </Link>
        <Link
          href={pipelineHref}
          className={`inline-flex min-h-9 items-center rounded-[8px] px-3 text-sm ${view === "pipeline" ? "bg-[var(--od-gold)]/15 text-[var(--od-text)]" : "text-[var(--od-muted)]"}`}
        >
          Pipeline
        </Link>
      </div>

      <LeadListFilters
        query={view === "pipeline" ? pipelineBase : query}
        sources={sources}
        assignees={assignees}
        showBroadFilters={context.canReadBroad}
        view={view}
      />

      {view === "pipeline" ? (
        pipelineEmpty ? (
          <LeadListEmpty filtered={Boolean(pipelineBase.q || pipelineBase.sourceId || pipelineBase.assignment || pipelineBase.assigneeId || pipelineBase.followUpDue)} canCreate={context.canCreateLeads} />
        ) : (
          <>
            <LeadPipelineBoard stages={pipelineStages} />
            <p className="text-xs text-[var(--od-muted)]">
              Stage totals are RLS-scoped counts. Cards are a preview of {PIPELINE_STAGE_PREVIEW_SIZE} per stage. Drag-and-drop is not enabled.
            </p>
          </>
        )
      ) : page && page.items.length === 0 ? (
        <LeadListEmpty filtered={page.hasActiveFilters} canCreate={context.canCreateLeads} />
      ) : page ? (
        <>
          <LeadListTable items={page.items} />
          <LeadListCards items={page.items} />
          <LeadListPagination query={query} pagination={page.pagination} />
        </>
      ) : null}
    </div>
  );
}
