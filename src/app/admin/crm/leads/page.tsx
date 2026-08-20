import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadListCards } from "@/features/crm/components/leads/LeadListCards";
import { LeadListEmpty } from "@/features/crm/components/leads/LeadListEmpty";
import { LeadListFilters } from "@/features/crm/components/leads/LeadListFilters";
import { parseLeadListQuery, buildLeadListHref } from "@/features/crm/contracts/lead-list-query";
import { LeadListPagination } from "@/features/crm/components/leads/LeadListPagination";
import { LeadListTable } from "@/features/crm/components/leads/LeadListTable";
import { LeadPipelineBoard } from "@/features/crm/components/leads/LeadPipelineBoard";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { getLeadListPageForCurrentUser } from "@/features/crm/server/crm-lead-repository";

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

  const listQuery =
    view === "pipeline"
      ? { ...query, status: null, pageSize: 50, page: 1 }
      : query;

  const [page, sources, assignees] = await Promise.all([
    getLeadListPageForCurrentUser(listQuery),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
  ]);

  const tableHref = buildLeadListHref(query, "table");
  const pipelineHref = buildLeadListHref(query, "pipeline");

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
        query={query}
        sources={sources}
        assignees={assignees}
        showBroadFilters={context.canReadBroad}
        view={view}
      />

      {page.items.length === 0 ? (
        <LeadListEmpty filtered={page.hasActiveFilters} canCreate={context.canCreateLeads} />
      ) : view === "pipeline" ? (
        <>
          <LeadPipelineBoard items={page.items} />
          <LeadListCards items={page.items} />
          <p className="text-xs text-[var(--od-muted)]">
            Read-only board of the current queue (max 50). Stages match canonical CRM statuses. Drag-and-drop is not enabled.
          </p>
        </>
      ) : (
        <>
          <LeadListTable items={page.items} />
          <LeadListCards items={page.items} />
          <LeadListPagination query={query} pagination={page.pagination} />
        </>
      )}
    </div>
  );
}
