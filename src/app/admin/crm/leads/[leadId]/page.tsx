import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadDetailAssignmentPanel } from "@/features/crm/components/leads/LeadDetailAssignmentPanel";
import {
  LeadDetailConsentSummary,
  LeadDetailStatusSummary,
} from "@/features/crm/components/leads/LeadDetailConsentSummary";
import { LeadDetailContact } from "@/features/crm/components/leads/LeadDetailContact";
import { LeadDetailFollowUps } from "@/features/crm/components/leads/LeadDetailFollowUps";
import { LeadDetailNotes } from "@/features/crm/components/leads/LeadDetailNotes";
import { LeadDetailOverview } from "@/features/crm/components/leads/LeadDetailOverview";
import { LeadDetailSourcePanel } from "@/features/crm/components/leads/LeadDetailSourcePanel";
import { LeadDetailTimeline } from "@/features/crm/components/leads/LeadDetailTimeline";
import { LeadDetailQuotationPanel } from "@/features/crm/components/leads/LeadDetailQuotationPanel";
import { LeadStatusBadge } from "@/features/crm/components/leads/LeadStatusBadge";
import { LeadStatusTransitionPanel } from "@/features/crm/components/leads/LeadStatusTransitionPanel";
import type { LeadStageCode } from "@/features/crm/contracts/lead-stages";
import { isTerminalLeadStage } from "@/features/crm/contracts/lead-stages";
import { getLeadDetailForCurrentUser } from "@/features/crm/server/crm-lead-repository";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import {
  fetchActiveLeadClosureReasons,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { getQuotationDraftByLeadId } from "@/features/quotations/server/quotation-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Detail | ONEDECORE CRM",
  description:
    "CRM lead detail workspace with assignment and lifecycle collaboration controls for authorized staff.",
};

interface CrmLeadDetailPageProps {
  readonly params: Promise<{ leadId: string }>;
}

export default async function CrmLeadDetailPage({ params }: CrmLeadDetailPageProps) {
  const { leadId } = await params;
  const context = await getCrmAccessContext();
  const lead = await getLeadDetailForCurrentUser(leadId);

  if (!lead) {
    notFound();
  }

  const leadStatus = lead.overview.status as LeadStageCode;
  const isTerminal = isTerminalLeadStage(leadStatus);
  const needsDirectory =
    context?.canReadBroad &&
    (context.canAssignLeads || context.canManageLeadFollowUps);

  const [assigneeDirectory, closureReasons, existingDraft] = await Promise.all([
    needsDirectory ? fetchCrmAssigneeDirectory(context!) : Promise.resolve([]),
    context?.canTransitionLeads
      ? fetchActiveLeadClosureReasons()
      : Promise.resolve([]),
    getQuotationDraftByLeadId(lead.id).catch(() => null),
  ]);

  // Authorization check for commercial quotation creation/editing (sales_executive, sales_manager, super_admin, management, sales)
  const canCreateOrEditQuotation = Boolean(context?.canReadAssigned || context?.canReadBroad);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={lead.overview.submittedName}
        description="Lead workspace with assignment controls and lifecycle collaboration for authorized staff."
        actions={
          <Link
            href="/admin/crm/leads"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Back to leads
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <LeadStatusBadge status={leadStatus} />
        <span className="text-sm text-neutral-400">
          Updated{" "}
          {new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(lead.overview.updatedAt))}
        </span>
      </div>

      <LeadStatusTransitionPanel
        leadId={lead.id}
        currentStatus={leadStatus}
        resumeTargetStatus={lead.statusSummary.resumeTargetStatus}
        canTransitionLeads={context?.canTransitionLeads ?? false}
        closureReasons={closureReasons}
      />

      {/* Commercial Quotation Workspace Integration Card */}
      <LeadDetailQuotationPanel
        leadId={lead.id}
        submittedName={lead.overview.submittedName}
        existingDraft={existingDraft}
        canCreateOrEditQuotation={canCreateOrEditQuotation}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <LeadDetailOverview overview={lead.overview} />
        <LeadDetailContact contact={lead.contact} />
        <LeadDetailSourcePanel source={lead.source} />
        <LeadDetailAssignmentPanel
          assignment={lead.assignment}
          leadId={lead.id}
          leadStatus={leadStatus}
          leadUpdatedAt={lead.overview.updatedAt}
          canAssignLeads={context?.canAssignLeads ?? false}
          assigneeDirectory={assigneeDirectory}
        />
        <LeadDetailTimeline timeline={lead.timeline} />
        <LeadDetailNotes
          notes={lead.notes}
          leadId={lead.id}
          canManageLeadNotes={context?.canManageLeadNotes ?? false}
          showComposer={!isTerminal}
        />
        <LeadDetailFollowUps
          leadId={lead.id}
          followUps={lead.followUps}
          canManageLeadFollowUps={context?.canManageLeadFollowUps ?? false}
          canChooseFollowUpOwner={context?.canReadBroad ?? false}
          showComposer={!isTerminal}
          assigneeDirectory={assigneeDirectory}
        />
        <LeadDetailConsentSummary items={lead.consentSummary} />
        <LeadDetailStatusSummary summary={lead.statusSummary} />
      </div>
    </div>
  );
}
