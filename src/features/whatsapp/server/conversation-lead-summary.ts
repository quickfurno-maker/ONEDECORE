import "server-only";

import { getLeadDetailForCurrentUser } from "@/features/crm/server/crm-lead-repository";
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

export async function loadConversationLeadSummary(
  leadId: string | null
): Promise<ConversationLeadSummaryResult> {
  if (!leadId) {
    return { lead: null, hidden: false };
  }

  try {
    const detail = await getLeadDetailForCurrentUser(leadId);
    if (!detail) {
      return { lead: null, hidden: true };
    }

    const overview = detail.overview;

    return {
      lead: {
        leadId,
        name: overview.submittedName,
        status: humanise(overview.status),
        service: humanise(overview.serviceCode),
        scope: humanise(overview.projectScopeCode ?? overview.propertyCode),
        budget: humanise(overview.budgetRangeCode ?? overview.budgetComfortCode),
        timeline: humanise(overview.timelineCode),
        locality: overview.locality,
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
