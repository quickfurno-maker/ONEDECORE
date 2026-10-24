import { NextResponse } from "next/server";
import {
  crmMobileAuthError, crmMobileError, isCrmLeadIdShape, resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { CRM_EMPTY_WHATSAPP_ENGAGEMENT, fetchWhatsappEngagementSignals } from "@/features/crm/server/crm-lead-score-batch.ts";

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
    // Check an RLS-visible lead FIRST. This is identical for absent and hidden IDs,
    // and avoids doing the entire CRM scoring fan-out for an engagement-only read.
    const { data: visibleLead, error: leadError } = await auth.db
      .from("leads")
      .select("id")
      .eq("id", leadId.trim())
      .maybeSingle();
    if (leadError) throw leadError;
    if (!visibleLead) return crmMobileError("not_found", "That lead is not available.");

    // Restrict the governed RPC to the same one caller-visible lead ID.
    const signals = await fetchWhatsappEngagementSignals([visibleLead.id], auth.db);
    const signal = signals[visibleLead.id] ?? CRM_EMPTY_WHATSAPP_ENGAGEMENT;
    return NextResponse.json({
      linked: signal.linked,
      hasCustomerReply: signal.hasCustomerReply,
      lastInboundAt: signal.lastInboundAt,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("[mobile/crm/leads/:leadId/whatsapp-engagement]", error);
    return crmMobileError("unavailable", "WhatsApp engagement is unavailable right now.");
  }
}
