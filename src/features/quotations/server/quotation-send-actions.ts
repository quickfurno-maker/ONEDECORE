"use server";
import "server-only";

import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { deriveQuotationCapabilityToken, hashCapabilityToken } from "./quotation-capability";
import { createQuotationWhatsappSendIntentAction } from "@/features/whatsapp/server/whatsapp-send-actions";
import { dispatchWhatsappSendIntent } from "@/features/whatsapp/server/whatsapp-dispatch-service";

export async function sendQuotationAction(params: {
  quotationId: string;
  versionId: string;
  reissueToken?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  sendIntentId?: string;
  grantId?: string;
}> {
  const supabase = await createClient();

  // Fetch version & quotation details
  const { data: versionData, error: versionErr } = await supabase
    .from("quotation_versions")
    .select(`
      id,
      status,
      version_number,
      grand_total_paise,
      quotations!inner(id, quotation_number, lead_id)
    `)
    .eq("id", params.versionId)
    .single();

  if (versionErr || !versionData) {
    return { success: false, message: versionErr?.message || "Quotation version not found." };
  }

  if (versionData.status !== "finalized") {
    return { success: false, message: "INVALID_STATE: Only finalized quotation versions can be sent." };
  }

  const quotationObj = (versionData as Record<string, unknown>).quotations as Record<string, unknown>;

  // Check PDF is READY
  const { data: pdfDoc } = await supabase
    .from("quotation_pdf_documents")
    .select("id, status")
    .eq("quotation_version_id", params.versionId)
    .single();

  if (!pdfDoc || pdfDoc.status !== "ready") {
    return { success: false, message: "PDF_NOT_READY: Quotation PDF artifact must be ready before sending." };
  }

  // Get lead customer contact info
  const leadId = String(quotationObj.lead_id || "");
  const { data: lead } = await supabase
    .from("leads")
    .select("id, submitted_name, contacts!contact_id(phone_e164)")
    .eq("id", leadId)
    .single();

  const customerPhone = (lead as unknown as { contacts: { phone_e164: string } })?.contacts?.phone_e164;
  if (!lead || !customerPhone) {
    return { success: false, message: "CUSTOMER_CONTACT_MISSING: Lead has no valid phone number for WhatsApp delivery." };
  }

  // Capability Grant Generation
  let grantId: string;
  let nonce: string;
  let tokenHash: string;

  // Check if active grant exists unless reissue is requested
  const { data: existingGrant } = await supabase
    .from("quotation_access_grants")
    .select("id, derivation_nonce, capability_token_hash")
    .eq("quotation_version_id", params.versionId)
    .is("revoked_at", null)
    .single();

  if (existingGrant && !params.reissueToken) {
    grantId = existingGrant.id;
  } else {
    // Generate new nonce & token hash
    nonce = crypto.randomBytes(16).toString("hex");
    const tempGrantId = crypto.randomUUID();
    const token = deriveQuotationCapabilityToken(params.versionId, tempGrantId, nonce);
    tokenHash = hashCapabilityToken(token);

    const { data: issueResult, error: grantErr } = await supabase.rpc("issue_quotation_access_grant", {
      p_version_id: params.versionId,
      p_derivation_nonce: nonce,
      p_capability_token_hash: tokenHash,
    });

    const issueObj = issueResult as Record<string, unknown> | null;
    if (grantErr || !issueObj || typeof issueObj.grant_id !== "string") {
      return { success: false, message: grantErr?.message || "Failed to issue access grant capability." };
    }

    grantId = issueObj.grant_id;
  }

  // Create Phase 6B Secure Send Intent
  // Note: bodyText contains REDACTED internal text ONLY (0 bearer token)
  const redactedBodyText = `Your ONEDECORE commercial quotation ${quotationObj.quotation_number} (v${versionData.version_number}) is ready. Open your secure link to view details.`;

  const sendIntentResult = await createQuotationWhatsappSendIntentAction({
    customerE164: customerPhone,
    bodyText: redactedBodyText,
    leadId: leadId,
    secureContentKind: "quotation_link",
    secureContentRef: grantId,
  });

  if (!sendIntentResult.success || !sendIntentResult.sendIntentId) {
    return { success: false, message: sendIntentResult.message || "Failed to enqueue WhatsApp send intent." };
  }

  const sendIntentId = sendIntentResult.sendIntentId;

  // Trigger Phase 6B dispatch service asynchronously/in-line
  try {
    await dispatchWhatsappSendIntent(sendIntentId);
  } catch (dispatchErr) {
    console.warn("WhatsApp dispatch warning (intent enqueued):", dispatchErr);
  }

  // Log send_requested audit event using canonical quotation_events schema
  const { data: userAuth } = await supabase.auth.getUser();
  if (userAuth?.user?.id) {
    await supabase.from("quotation_events").insert({
      quotation_id: params.quotationId,
      quotation_version_id: params.versionId,
      lead_id: leadId,
      event_type: "quotation.send_requested",
      actor_id: userAuth.user.id,
      details: {
        send_intent_id: sendIntentId,
        grant_id: grantId,
        version_number: versionData.version_number,
      },
    });
  }

  return {
    success: true,
    sendIntentId,
    grantId,
    message: "Commercial quotation sent via secure WhatsApp link.",
  };
}
