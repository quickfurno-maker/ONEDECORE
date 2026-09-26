import "server-only";

import { getCrmAccessContext } from "@/features/crm/server/crm-auth.ts";
import { getLeadDetailForCurrentUser } from "@/features/crm/server/crm-lead-repository";
import { fetchDealValues } from "@/features/crm/server/crm-lead-score-batch.ts";
import { resolveEffectiveSalesBucket } from "@/features/crm/contracts/lead-sales-bucket.ts";
import {
  CRM_SALES_BUCKET_SOURCE_LABELS,
  parseManualSalesTemperature,
} from "@/features/crm/contracts/lead-sales-temperature.ts";
import { formatLeadQuotationState } from "@/features/crm/contracts/lead-milestones.ts";
import { getQuotationDraftByLeadId } from "@/features/quotations/server/quotation-queries.ts";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions.ts";
import type { ConversationLeadSummary } from "../components/inbox/ConversationDetailsPanel.tsx";

/**
 * The CRM fields shown beside a conversation.
 *
 * WHY THIS GOES THROUGH THE CRM'S OWN ACCESSOR.
 *
 * `getLeadDetailForCurrentUser` resolves the CRM access context and returns
 * null when the signed-in user may not read that lead. Querying the leads table
 * from this feature would have produced the same fields while quietly skipping
 * that check — a WhatsApp pane that shows a manager's lead to whoever happens
 * to be answering the message.
 *
 * The two permission systems overlap but are not the same: WhatsApp scope is
 * "the executive this lead is assigned to, plus managers", CRM scope has its
 * own rules. Where they disagree, CRM wins for CRM data.
 *
 * WHY A FAILURE IS NOT AN ERROR.
 *
 * `getLeadDetailForCurrentUser` throws when there is no CRM context at all.
 * That must not take down a conversation someone is legitimately reading, so
 * it is caught and reported as "hidden" — the panel then says the lead exists
 * but is not visible, which is true and discloses nothing about it.
 */

export interface ConversationLeadSummaryResult {
  readonly lead: ConversationLeadSummary | null;
  /** A lead is linked, but this user may not read it. */
  readonly hidden: boolean;
}

/** Turns a stored code into something a person reads. */
function humanise(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (trimmed.length === 0) return null;
  const words = trimmed.replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function latestWhatsappConsent(
  items: readonly {
    readonly purposeCode: string;
    readonly channel: string;
    readonly eventType: string;
    readonly occurredAt: string;
  }[],
  purposeCode: string
): string {
  const latest = [...items]
    .filter(
      (item) =>
        item.channel.toLowerCase() === "whatsapp" &&
        item.purposeCode.toUpperCase() === purposeCode
    )
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
    )[0];

  return latest?.eventType.toLowerCase() === "granted"
    ? "Granted"
    : "Not granted";
}

export async function loadConversationLeadSummary(
  leadId: string | null
): Promise<ConversationLeadSummaryResult> {
  if (!leadId) {
    return { lead: null, hidden: false };
  }

  try {
    const [detail, crmContext, dealValues, quotationDraft, quotationPermissions] =
      await Promise.all([
        getLeadDetailForCurrentUser(leadId),
        getCrmAccessContext(),
        fetchDealValues([leadId]),
        getQuotationDraftByLeadId(leadId).catch(() => null),
        probeQuotationPermissions().catch(() => ({
          canReadQuotations: false,
          canCreateQuotations: false,
          canEditQuotations: false,
          canSendQuotations: false,
        })),
      ]);

    if (!detail) {
      return { lead: null, hidden: true };
    }

    const overview = detail.overview;
    const manual = parseManualSalesTemperature(
      overview.manualSalesTemperature
    );
    const effective = resolveEffectiveSalesBucket(
      overview.status,
      "COLD",
      manual
    );
    const primaryNextAction =
      detail.followUps
        .filter(
          (item) =>
            item.status === "open" && item.isPrimaryNextAction
        )
        .sort(
          (left, right) =>
            Date.parse(left.dueAt) - Date.parse(right.dueAt)
        )[0] ?? null;
    const quotation = dealValues[leadId];

    return {
      lead: {
        leadId,
        name: overview.submittedName,
        status: humanise(overview.status),
        statusCode: overview.status,
        resumeTargetStatus: detail.statusSummary.resumeTargetStatus,
        service: humanise(overview.serviceCode),
        scope: humanise(overview.projectScopeCode ?? overview.propertyCode),
        budget: humanise(
          overview.budgetRangeCode ?? overview.budgetComfortCode
        ),
        timeline: humanise(overview.timelineCode),
        locality: overview.locality,
        owner: detail.assignment.currentAssigneeLabel || "Unassigned",
        ownerId: detail.assignment.currentAssigneeId,
        manualSalesTemperature: manual,
        salesBucket: effective.bucket,
        salesBucketSource:
          CRM_SALES_BUCKET_SOURCE_LABELS[effective.source],
        nextActionId: primaryNextAction?.id ?? null,
        nextActionTitle: primaryNextAction?.title ?? null,
        nextActionDueAt: primaryNextAction?.dueAt ?? null,
        slaDueAt: detail.slaClock.slaDueAt,
        firstContactAttemptAt: detail.slaClock.firstContactAttemptAt,
        quotation: formatLeadQuotationState(
          quotation?.state ?? "unknown"
        ),
        quotationId: quotationDraft?.quotationId ?? null,
        canReadQuotation: quotationPermissions.canReadQuotations,
        canCreateQuotation: quotationPermissions.canCreateQuotations,
        canEditQuotation: quotationPermissions.canEditQuotations,
        canTransitionLeads: crmContext?.canTransitionLeads ?? false,
        canManageLeadNotes: crmContext?.canManageLeadNotes ?? false,
        canManageLeadFollowUps: crmContext?.canManageLeadFollowUps ?? false,
        canSetSalesTemperature:
          (crmContext?.canTransitionLeads ?? false) &&
          !["closed_lost", "closed_won", "on_hold"].includes(overview.status),
        canReadConsents: crmContext?.canReadConsents ?? false,
        whatsappServiceConsent: crmContext?.canReadConsents
          ? latestWhatsappConsent(
              detail.consentSummary,
              "WHATSAPP_SERVICE"
            )
          : null,
        whatsappMarketingConsent: crmContext?.canReadConsents
          ? latestWhatsappConsent(
              detail.consentSummary,
              "MARKETING"
            )
          : null,
      },
      hidden: false,
    };
  } catch {
    /*
     * Access refused, or CRM unavailable. Either way the conversation stays
     * readable and the panel says the lead is not visible rather than
     * presenting a blank section that looks like missing data.
     */
    return { lead: null, hidden: true };
  }
}
