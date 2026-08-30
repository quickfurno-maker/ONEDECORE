import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadListCards } from "@/features/crm/components/leads/LeadListCards";
import { LeadListEmpty } from "@/features/crm/components/leads/LeadListEmpty";
import { LeadListFilters } from "@/features/crm/components/leads/LeadListFilters";
import { parseLeadListQuery } from "@/features/crm/contracts/lead-list-query";
import { LeadListPagination } from "@/features/crm/components/leads/LeadListPagination";
import { LeadListTable } from "@/features/crm/components/leads/LeadListTable";
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

/**
 * Canonical table/list workspace. The board lives at `/admin/crm/pipeline`
 * (CRM 2B) — this page deliberately keeps no second pipeline implementation.
 */
export default async function CrmLeadsPage({ searchParams }: CrmLeadsPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = parseLeadListQuery(resolvedSearchParams);
  const context = await getCrmAccessContext();

  if (!context) {
    return null;
  }

  const [page, sources, assignees] = await Promise.all([
    getLeadListPageForCurrentUser(query),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
  ]);

  return (
    <div className="space-y-5">
      <CrmPageHeader
        title="Leads"
        description="Track, qualify and move opportunities forward."
        actions={
          <>
            <Link
              href="/admin/crm/pipeline"
              className="crm-btn crm-btn-secondary w-full sm:w-auto"
              data-testid="crm-leads-pipeline-link"
            >
              Open Pipeline
            </Link>
            {context.canCreateLeads ? (
              <Link
                href="/admin/crm/leads/new"
                className="crm-btn crm-btn-primary w-full sm:w-auto"
              >
                + New Lead
              </Link>
            ) : null}
          </>
        }
      />

      <LeadListFilters
        query={query}
        sources={sources}
        assignees={assignees}
        showBroadFilters={context.canReadBroad}
      />

      {page.items.length === 0 ? (
        <LeadListEmpty
          filtered={page.hasActiveFilters}
          canCreate={context.canCreateLeads}
        />
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
