import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { CrmPipelineBoard } from "@/features/crm/components/pipeline/CrmPipelineBoard";
import { parseMyDayOwnerFilter } from "@/features/crm/contracts/my-day-contracts";
import { requireCrmReadAccess } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadClosureReasons,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { fetchCrmPipelineBoard } from "@/features/crm/server/crm-pipeline-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline | CRM | ONEDECORE",
  description: "Dedicated CRM pipeline workspace with urgency-first ordering.",
};

interface CrmPipelinePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmPipelinePage({
  searchParams,
}: CrmPipelinePageProps) {
  const context = await requireCrmReadAccess("/admin/crm/pipeline");
  const raw = await searchParams;
  const ownerFilter = parseMyDayOwnerFilter(raw.owner);

  const [board, assignees, closureReasons] = await Promise.all([
    fetchCrmPipelineBoard(context, { ownerId: ownerFilter }),
    context.canReadBroad
      ? fetchCrmAssigneeDirectory(context)
      : Promise.resolve([]),
    context.canTransitionLeads
      ? fetchActiveLeadClosureReasons()
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <CrmPageHeader
        title="Pipeline"
        description="Work the funnel by urgency. Move stages through the audited transition."
        actions={
          <Link
            href="/admin/crm/leads"
            className="crm-btn crm-btn-secondary w-full sm:w-auto"
          >
            Open Leads table
          </Link>
        }
      />
      <CrmPipelineBoard
        board={board}
        assignees={assignees}
        closureReasons={closureReasons}
        canFilterOwner={context.canReadBroad}
        canTransition={context.canTransitionLeads}
      />
    </div>
  );
}
