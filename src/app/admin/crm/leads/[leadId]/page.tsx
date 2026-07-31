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
import { LeadStatusBadge } from "@/features/crm/components/leads/LeadStatusBadge";
import type { LeadStageCode } from "@/features/crm/contracts/lead-stages";
import { getLeadDetailForCurrentUser } from "@/features/crm/server/crm-lead-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Detail | ONEDECORE CRM",
  description: "Read-only CRM lead detail workspace.",
};

interface CrmLeadDetailPageProps {
  readonly params: Promise<{ leadId: string }>;
}

export default async function CrmLeadDetailPage({ params }: CrmLeadDetailPageProps) {
  const { leadId } = await params;
  const lead = await getLeadDetailForCurrentUser(leadId);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={lead.overview.submittedName}
        description="Read-only lead workspace. Mutation controls are intentionally unavailable in Phase 5C1."
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
        <LeadStatusBadge status={lead.overview.status as LeadStageCode} />
        <span className="text-sm text-neutral-400">
          Updated{" "}
          {new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(lead.overview.updatedAt))}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <LeadDetailOverview overview={lead.overview} />
        <LeadDetailContact contact={lead.contact} />
        <LeadDetailSourcePanel source={lead.source} />
        <LeadDetailAssignmentPanel assignment={lead.assignment} />
        <LeadDetailTimeline timeline={lead.timeline} />
        <LeadDetailNotes notes={lead.notes} />
        <LeadDetailFollowUps followUps={lead.followUps} />
        <LeadDetailConsentSummary items={lead.consentSummary} />
        <LeadDetailStatusSummary summary={lead.statusSummary} />
      </div>
    </div>
  );
}
