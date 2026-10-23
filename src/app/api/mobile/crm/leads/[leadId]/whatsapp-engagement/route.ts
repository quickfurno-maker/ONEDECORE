import { NextResponse } from "next/server";
import {
  crmMobileAuthError, crmMobileError, isCrmLeadIdShape, resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { queryLeadIntelligence } from "@/features/crm/server/crm-lead-queries.ts";
import { CRM_EMPTY_WHATSAPP_ENGAGEMENT, fetchLeadScoreBatch } from "@/features/crm/server/crm-lead-score-batch.ts";

/**
 * CRM-authorized, content-free WhatsApp engagement evidence. Not an inbox,
 * message transcript, phone lookup, consent grant, or messaging permission.
 * Never expose productionConversationId or provider/sender credentials.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);
  if (auth.kind !== "granted") return crmMobileAuthError(auth.kind);
  const { leadId } = await params;
  if (!isCrmLeadIdShape(leadId))
    return crmMobileError("invalid_request", "That lead reference is not valid.");
  try {
    // Same no-existence-oracle rule as the existing per-lead intelligence route.
    const lead = await queryLeadIntelligence(auth.context, leadId.trim(), auth.db);
    if (!lead) return crmMobileError("not_found", "That lead is not available.");
    const batch = await fetchLeadScoreBatch([leadId.trim()], auth.db);
    const signal = batch.whatsapp[leadId.trim()] ?? CRM_EMPTY_WHATSAPP_ENGAGEMENT;
    return NextResponse.json({
      linked: signal.linked,
      hasCustomerReply: signal.hasCustomerReply,
      lastInboundAt: signal.lastInboundAt,
    });
  } catch (error) {
    console.error("[mobile/crm/leads/:leadId/whatsapp-engagement]", error);
    return crmMobileError("unavailable", "WhatsApp engagement is unavailable right now.");
  }
}
