import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadActionsProvider } from "@/features/crm/components/leads/LeadActionsProvider";
import { LeadCommandHeader } from "@/features/crm/components/leads/LeadCommandHeader";
import { LeadQuickActions } from "@/features/crm/components/leads/LeadQuickActions";
import { LeadDetailAssignmentPanel } from "@/features/crm/components/leads/LeadDetailAssignmentPanel";
import { LeadDetailConsentSummary, LeadDetailStatusSummary } from "@/features/crm/components/leads/LeadDetailConsentSummary";
import { MarketingConsentPanel } from "@/features/marketing/components/MarketingConsentPanel";
import { probeCampaignPermissions } from "@/features/marketing/server/campaign-permissions";
import { getMarketingConsentState } from "@/features/marketing/server/campaign-queries";
import { LeadDetailContact } from "@/features/crm/components/leads/LeadDetailContact";
import { LeadActivityWorkspace } from "@/features/crm/components/activities/LeadActivityWorkspace.tsx";
import { LeadCadencePanel } from "@/features/crm/components/leads/LeadCadencePanel";
import { LeadDetailNotes } from "@/features/crm/components/leads/LeadDetailNotes";
import { LeadDetailOverview } from "@/features/crm/components/leads/LeadDetailOverview";
import { LeadDetailSourcePanel } from "@/features/crm/components/leads/LeadDetailSourcePanel";
import { LeadDetailTimeline } from "@/features/crm/components/leads/LeadDetailTimeline";
import { LeadDetailQuotationPanel } from "@/features/crm/components/leads/LeadDetailQuotationPanel";
import { LeadStatusTransitionPanel } from "@/features/crm/components/leads/LeadStatusTransitionPanel";
import type { LeadStageCode } from "@/features/crm/contracts/lead-stages";
import { isTerminalLeadStage } from "@/features/crm/contracts/lead-stages";
import { deriveLeadScore } from "@/features/crm/contracts/lead-score-contracts";
import { getLeadDetailForCurrentUser } from "@/features/crm/server/crm-lead-repository";
import { fetchLeadCommercialState } from "@/features/crm/server/crm-lead-commercial-queries";
import { buildLeadScoreSignalsFromDetail } from "@/features/crm/server/crm-lead-score-signals";
import { listActivityOutcomeOptionsForCurrentUser } from "@/features/crm/server/crm-activity-service.ts";
import { fetchGovernedWhatsappSendIntentsForLead } from "@/features/crm/server/crm-whatsapp-evidence-queries.ts";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import {
  fetchEnrollableCadenceTemplates,
  fetchLeadCadenceState,
} from "@/features/crm/server/crm-cadence-queries";
import {
  fetchActiveLeadClosureReasons,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { getQuotationDraftByLeadId } from "@/features/quotations/server/quotation-queries";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions";

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

  const [
    assigneeDirectory,
    closureReasons,
    existingDraft,
    quotationPermissions,
    campaignPermissions,
    outcomeOptions,
    whatsappSendIntents,
    leadCadence,
    enrollableCadences,
    commercialState,
  ] =
    await Promise.all([
      needsDirectory ? fetchCrmAssigneeDirectory(context!) : Promise.resolve([]),
      context?.canTransitionLeads
        ? fetchActiveLeadClosureReasons()
        : Promise.resolve([]),
      getQuotationDraftByLeadId(lead.id).catch(() => null),
      probeQuotationPermissions(),
      probeCampaignPermissions(),
      context?.canManageLeadFollowUps
        ? listActivityOutcomeOptionsForCurrentUser()
        : Promise.resolve([]),
      context?.canManageLeadFollowUps
        ? fetchGovernedWhatsappSendIntentsForLead(lead.id)
        : Promise.resolve([]),
      context?.canManageLeadFollowUps
        ? fetchLeadCadenceState(lead.id)
        : Promise.resolve(null),
      context?.canManageLeadFollowUps
        ? fetchEnrollableCadenceTemplates()
        : Promise.resolve([]),
      // Canonical deal value + commercial state. The RPC is the only path able
      // to distinguish an ISSUED quotation from a merely FINALIZED one.
      fetchLeadCommercialState(lead.id),
    ]);

  // Only an ACTIVE enrollment with a further step may offer CADENCE_NEXT.
  const activeCadenceEnrollmentId =
    leadCadence?.status === "active" ? leadCadence.enrollmentId : null;
  const hasNextCadenceStep = leadCadence?.upcomingStepTitle != null;

  const marketingConsentState = campaignPermissions.canManageMarketingConsent
    ? await getMarketingConsentState(lead.contact.id)
    : null;

  const quotationId = existingDraft?.quotationId ?? null;
  const quotationLabel = existingDraft?.version?.title ?? existingDraft?.quotationNumber ?? null;

  // One server-captured `now` for the whole render, so the score, risk flags
  // and due states can never disagree — and the render stays pure.
  const nowMs = Date.parse(lead.capturedAt);
  const leadScore = deriveLeadScore(
    buildLeadScoreSignalsFromDetail({
      status: leadStatus,
      assignedTo: lead.assignment.currentAssigneeId,
      receivedAt: lead.overview.createdAt,
      followUps: lead.followUps,
      notes: lead.notes,
      timeline: lead.timeline,
      slaClock: lead.slaClock,
      commercialState: commercialState.state,
    }),
    nowMs
  );

  const primaryNextAction =
    lead.followUps.find(
      (entry) => entry.status === "open" && entry.isPrimaryNextAction
    ) ?? null;

  // Consent is a secondary header fact unless outreach is actually blocked.
  const consentBlocked = lead.consentSummary.some(
    (entry) => entry.eventType === "withdrawn" || entry.eventType === "denied"
  );

  return (
    <LeadActionsProvider>
    <div className="space-y-5">
      <LeadCommandHeader
        leadId={lead.id}
        overview={lead.overview}
        manualSalesTemperature={lead.overview.manualSalesTemperature}
        canSetTemperature={context?.canTransitionLeads ?? false}
        ownerLabel={lead.assignment.currentAssigneeLabel}
        primaryNextAction={primaryNextAction}
        score={leadScore}
        commercial={commercialState}
        cadence={leadCadence}
        consentBlocked={consentBlocked}
        canReadConsents={context?.canReadConsents ?? false}
        quickActions={
          <LeadQuickActions
            leadId={lead.id}
            submittedName={lead.overview.submittedName}
            leadStatus={leadStatus}
            canManageLeadFollowUps={context?.canManageLeadFollowUps ?? false}
            canManageLeadNotes={context?.canManageLeadNotes ?? false}
            hasOpenPrimaryNextAction={primaryNextAction !== null}
            quotationId={quotationId}
            canCreateQuotation={quotationPermissions.canCreateQuotations}
            canEditQuotation={quotationPermissions.canEditQuotations}
          />
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(18rem,1fr)]">
        <div className="flex flex-col gap-4 sm:gap-5">
          <LeadStatusTransitionPanel
            leadId={lead.id}
            currentStatus={leadStatus}
            resumeTargetStatus={lead.statusSummary.resumeTargetStatus}
            canTransitionLeads={context?.canTransitionLeads ?? false}
            closureReasons={closureReasons}
          />
          <div className="xl:hidden">
            <LeadDetailContact contact={lead.contact} />
          </div>
          <div className="xl:hidden">
            <LeadDetailAssignmentPanel
              assignment={lead.assignment}
              leadId={lead.id}
              leadStatus={leadStatus}
              leadUpdatedAt={lead.overview.updatedAt}
              canAssignLeads={context?.canAssignLeads ?? false}
              assigneeDirectory={assigneeDirectory}
            />
          </div>
          <LeadActivityWorkspace
            leadId={lead.id}
            leadStatus={leadStatus}
            isAssigned={lead.assignment.currentAssigneeId !== null}
            followUps={lead.followUps}
            canManageLeadFollowUps={context?.canManageLeadFollowUps ?? false}
            canChooseFollowUpOwner={context?.canReadBroad ?? false}
            showComposer={!isTerminal}
            assigneeDirectory={assigneeDirectory}
            outcomeOptions={outcomeOptions}
            closureReasons={closureReasons}
            whatsappSendIntents={whatsappSendIntents}
            quotationId={quotationId}
            quotationLabel={quotationLabel}
            activeCadenceEnrollmentId={activeCadenceEnrollmentId}
            hasNextCadenceStep={hasNextCadenceStep}
          />
          <LeadCadencePanel
            leadId={lead.id}
            leadStatus={leadStatus}
            isAssigned={lead.assignment.currentAssigneeId !== null}
            canManage={context?.canManageLeadFollowUps ?? false}
            cadence={leadCadence}
            enrollableTemplates={enrollableCadences}
          />
          <LeadDetailOverview overview={lead.overview} />
          <LeadDetailTimeline timeline={lead.timeline} />
          <LeadDetailNotes
            leadId={lead.id}
            canManageLeadNotes={context?.canManageLeadNotes ?? false}
            showComposer={!isTerminal}
          />
          <LeadDetailQuotationPanel
            leadId={lead.id}
            submittedName={lead.overview.submittedName}
            existingDraft={existingDraft}
            canCreateQuotation={quotationPermissions.canCreateQuotations}
            canEditQuotation={quotationPermissions.canEditQuotations}
          />
          <div className="space-y-4 xl:hidden sm:space-y-5">
            <LeadDetailSourcePanel source={lead.source} />
            <LeadDetailStatusSummary summary={lead.statusSummary} />
            <LeadDetailConsentSummary items={lead.consentSummary} />
            <MarketingConsentPanel
              leadId={lead.id}
              contactId={lead.contact.id}
              canManage={campaignPermissions.canManageMarketingConsent}
              state={marketingConsentState}
            />
          </div>
        </div>

        <aside className="hidden space-y-5 xl:sticky xl:top-20 xl:block xl:self-start">
          <LeadDetailContact contact={lead.contact} />
          <LeadDetailAssignmentPanel
            assignment={lead.assignment}
            leadId={lead.id}
            leadStatus={leadStatus}
            leadUpdatedAt={lead.overview.updatedAt}
            canAssignLeads={context?.canAssignLeads ?? false}
            assigneeDirectory={assigneeDirectory}
          />
          <LeadDetailSourcePanel source={lead.source} />
          <LeadDetailStatusSummary summary={lead.statusSummary} />
          <LeadDetailConsentSummary items={lead.consentSummary} />
          <MarketingConsentPanel
            leadId={lead.id}
            contactId={lead.contact.id}
            canManage={campaignPermissions.canManageMarketingConsent}
            state={marketingConsentState}
          />
        </aside>
      </div>
    </div>
    </LeadActionsProvider>
  );
}
