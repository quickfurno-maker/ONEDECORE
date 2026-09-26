"use server";
import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isWhatsappMarketingPreferenceCategory,
  WHATSAPP_MARKETING_CONSENT_CHANNELS,
  WHATSAPP_MARKETING_CONSENT_INSTRUCTION_SOURCES,
  WHATSAPP_OPT_OUT_SOURCES,
  WHATSAPP_PREFERENCE_SOURCE,
  WHATSAPP_STAFF_MARKETING_CONSENT_COPY_VERSION,
  WHATSAPP_STAFF_MARKETING_CONSENT_NOTICE_VERSION,
} from "../contracts/contacts-compliance.ts";
import {
  describeWhatsappControlPlaneRpcError,
  isUuid,
  WHATSAPP_ADMIN_CONTACTS_PATH,
  type WhatsappControlPlaneActionState,
} from "../contracts/control-plane.ts";
import { WHATSAPP_ADMIN_INBOX_BASE_PATH } from "../contracts/inbox-surface.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";
import { canCurrentUserAccessConversation } from "./whatsapp-inbox-queries.ts";

/*
 * Compliance writes from staff. Both are RESTRICTIVE or narrowing:
 *
 *   - an opt-out appends a MARKETING `withdrawn` consent event;
 *   - a preference event narrows which marketing categories apply.
 *
 * Opt-out and preference actions only narrow eligibility. P5 additionally
 * exposes an evidence-backed MARKETING grant recorder for a customer instruction
 * that already happened; it cannot infer consent from service activity and never
 * touches WHATSAPP_SERVICE. Every action re-checks permission here, then the
 * SECURITY DEFINER RPC checks it again from `auth.uid()`; the caller's session
 * is the only client.
 */

const DENIED: WhatsappControlPlaneActionState = {
  success: false,
  code: "ACCESS_DENIED",
  message: "You are not allowed to record an opt-out for this contact.",
};

export async function recordWhatsappMarketingOptOutAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const contactId = String(formData.get("contactId") ?? "").trim();
  const conversationRaw = String(formData.get("conversationId") ?? "").trim();
  const confirmed = formData.get("confirm") === "yes";

  if (!isUuid(contactId) || (conversationRaw !== "" && !isUuid(conversationRaw))) {
    return { success: false, code: "VALIDATION", message: "Unknown contact." };
  }
  if (!confirmed) {
    return { success: false, code: "VALIDATION", field: "confirm", message: "Confirm the customer asked to stop marketing messages." };
  }

  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.opt_out.record"]) return DENIED;

  const conversationId = conversationRaw === "" ? null : conversationRaw;
  if (conversationId) {
    // Sales Executives record opt-outs only inside a conversation they may use.
    if (!(await canCurrentUserAccessConversation(conversationId, "use"))) return DENIED;
  } else if (!access.permissions["whatsapp.contacts.read"]) {
    // Outside a conversation this is the global contacts workspace.
    return DENIED;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_whatsapp_customer_opt_out", {
    p_contact_id: contactId,
    p_conversation_id: conversationId ?? undefined,
    p_source: conversationId ? WHATSAPP_OPT_OUT_SOURCES.inbox : WHATSAPP_OPT_OUT_SOURCES.contacts,
  });
  if (error) {
    const described = describeWhatsappControlPlaneRpcError(error, "opt_out");
    return { success: false, ...described };
  }

  revalidatePath(WHATSAPP_ADMIN_CONTACTS_PATH);
  if (conversationId) revalidatePath(`${WHATSAPP_ADMIN_INBOX_BASE_PATH}/${conversationId}`);

  const outcome = (data as { outcome?: unknown } | null)?.outcome;
  return {
    success: true,
    message:
      outcome === "already_withdrawn"
        ? "This contact had already opted out of marketing. Nothing changed."
        : "Marketing opt-out recorded. Campaigns will skip this contact.",
  };
}

export async function recordWhatsappMarketingConsentGrantAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const contactId = String(formData.get("contactId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const instructionSource = String(formData.get("instructionSource") ?? "").trim();
  const note = String(formData.get("note") ?? "").replace(/\s+/g, " ").trim();
  const confirmed = formData.get("confirmExplicit") === "yes";

  if (!isUuid(contactId)) {
    return { success: false, code: "VALIDATION", message: "Unknown contact." };
  }
  if (!(WHATSAPP_MARKETING_CONSENT_CHANNELS as readonly string[]).includes(channel)) {
    return { success: false, code: "VALIDATION", field: "channel", message: "Choose how the customer gave permission." };
  }
  if (!(WHATSAPP_MARKETING_CONSENT_INSTRUCTION_SOURCES as readonly string[]).includes(instructionSource)) {
    return { success: false, code: "VALIDATION", field: "instructionSource", message: "Choose the source of the customer instruction." };
  }
  if (!confirmed) {
    return {
      success: false,
      code: "VALIDATION",
      field: "confirmExplicit",
      message: "Confirm that the customer explicitly opted in to optional marketing.",
    };
  }
  if (note.length < 8 || note.length > 500) {
    return {
      success: false,
      code: "VALIDATION",
      field: "note",
      message: "Record 8–500 characters of evidence, without adding unnecessary personal data.",
    };
  }

  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.contacts.read"] || !access.permissions["marketing_consents.manage"]) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "You do not have permission to record marketing consent.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_marketing_consent_event", {
    p_contact_id: contactId,
    p_event_type: "granted",
    p_channel: channel,
    p_copy_version: WHATSAPP_STAFF_MARKETING_CONSENT_COPY_VERSION,
    p_notice_version: WHATSAPP_STAFF_MARKETING_CONSENT_NOTICE_VERSION,
    p_instruction_source: instructionSource,
    p_note: note,
    p_idempotency_key: randomUUID(),
  });
  if (error) {
    return { success: false, ...describeWhatsappControlPlaneRpcError(error, "consent") };
  }

  revalidatePath(WHATSAPP_ADMIN_CONTACTS_PATH);
  return {
    success: true,
    message: "Explicit MARKETING consent evidence recorded. No message was sent and all campaign safeguards still apply.",
  };
}

export async function recordWhatsappMarketingPreferenceAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const contactId = String(formData.get("contactId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "").trim();

  if (!isUuid(contactId)) return { success: false, code: "VALIDATION", message: "Unknown contact." };
  if (!isWhatsappMarketingPreferenceCategory(category)) {
    return { success: false, code: "VALIDATION", field: "category", message: "Choose a preference category." };
  }
  if (eventType !== "opted_out" && eventType !== "allowed") {
    return { success: false, code: "VALIDATION", field: "eventType", message: "Choose whether to stop or resume this category." };
  }

  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.contacts.read"] || !access.permissions["marketing_consents.manage"]) {
    return { success: false, code: "ACCESS_DENIED", message: "You do not have permission to record marketing preferences." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_whatsapp_marketing_preference", {
    p_contact_id: contactId,
    p_category: category,
    p_event_type: eventType,
    p_source: WHATSAPP_PREFERENCE_SOURCE,
  });
  if (error) {
    return { success: false, ...describeWhatsappControlPlaneRpcError(error, "preference") };
  }

  revalidatePath(WHATSAPP_ADMIN_CONTACTS_PATH);
  return {
    success: true,
    message:
      eventType === "opted_out"
        ? "Category stopped for this contact."
        : "Category resumed. Marketing still requires the contact's own MARKETING consent.",
  };
}
