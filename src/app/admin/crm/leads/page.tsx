import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadListCards } from "@/features/crm/components/leads/LeadListCards";
import { LeadListEmpty } from "@/features/crm/components/leads/LeadListEmpty";
import { LeadListFilters } from "@/features/crm/components/leads/LeadListFilters";
import { LeadListPagination } from "@/features/crm/components/leads/LeadListPagination";
import { LeadListTable } from "@/features/crm/components/leads/LeadListTable";
import { parseLeadListQuery } from "@/features/crm/contracts/lead-list-query";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { getLeadListPageForCurrentUser } from "@/features/crm/server/crm-lead-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Leads | ONEDECORE",
  description: "Read-only CRM lead workspace for authorized ONEDECORE staff.",
};

interface CrmLeadsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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
    <div className="space-y-6">
      <CrmPageHeader
        title="Leads"
        description="Read-only operational lead queue with role-scoped visibility enforced by database RLS."
      />

      <LeadListFilters
        query={query}
        sources={sources}
        assignees={assignees}
        showBroadFilters={context.canReadBroad}
      />

      {page.items.length === 0 ? (
        <LeadListEmpty filtered={page.hasActiveFilters} />
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
