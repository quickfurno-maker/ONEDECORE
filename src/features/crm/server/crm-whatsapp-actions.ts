"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CrmWhatsappStartResult =
  | {
      readonly success: true;
      readonly conversationId: string;
      readonly outcome: "created" | "linked" | "existing";
      readonly message: string;
    }
  | {
      readonly success: false;
      readonly code: string;
      readonly message: string;
    };

function describeStartFailure(message: string): {
  readonly code: string;
  readonly message: string;
} {
  if (message.includes("CRM_WHATSAPP_PRODUCTION_SENDER_NOT_READY")) {
    return {
      code: "PRODUCTION_SENDER_NOT_READY",
      message:
        "The real ONEDECORE WhatsApp number is not activated yet. Finish the Meta cutover before starting a new WhatsApp thread.",
    };
  }
  if (message.includes("CRM_WHATSAPP_CONTACT_CHANNEL_MISSING")) {
    return {
      code: "NO_WHATSAPP_NUMBER",
      message: "This lead has no active WhatsApp or phone number that can be used.",
    };
  }
  if (message.includes("CRM_WHATSAPP_LEAD_NOT_SENDABLE")) {
    return {
      code: "LEAD_NOT_SENDABLE",
      message: "This lead is not eligible to start a new WhatsApp thread in its current state.",
    };
  }
  if (
    message.includes("CRM_WHATSAPP_USE_REQUIRED") ||
    message.includes("CRM_WHATSAPP_AUTH_REQUIRED")
  ) {
    return {
      code: "ACCESS_DENIED",
      message: "You do not have permission to use WhatsApp for this lead.",
    };
  }
  if (
    message.includes("CRM_WHATSAPP_NUMBER_LINKED_TO_OTHER_LEAD") ||
    message.includes("CRM_WHATSAPP_NUMBER_LINKED_TO_OTHER_CONTACT")
  ) {
    return {
      code: "IDENTITY_CONFLICT",
      message:
        "That WhatsApp number is already linked to another CRM identity. Resolve it in the WhatsApp inbox before sending.",
    };
  }
  return {
    code: "RPC_FAILED",
    message: "The WhatsApp workspace could not be prepared for this lead.",
  };
}

/**
 * CRM quick-action preparation only.
 *
 * The database chooses the already-verified production sender and canonical
 * E.164 contact channel, creates/links a local conversation if needed and
 * returns its id. This action never calls Meta, never sends a template and
 * never changes marketing consent.
 */
export async function startCrmWhatsappConversationAction(
  leadId: string
): Promise<CrmWhatsappStartResult> {
  if (!UUID.test(leadId)) {
    return {
      success: false,
      code: "VALIDATION",
      message: "Unknown lead.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "ensure_whatsapp_conversation_for_crm_lead",
    { p_lead_id: leadId }
  );

  if (error) {
    return { success: false, ...describeStartFailure(error.message ?? "") };
  }

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const conversationId =
    typeof row?.conversation_id === "string" ? row.conversation_id : null;
  const outcome =
    row?.outcome === "created" ||
    row?.outcome === "linked" ||
    row?.outcome === "existing"
      ? row.outcome
      : null;

  if (!conversationId || !outcome) {
    return {
      success: false,
      code: "INVALID_RESULT",
      message: "The WhatsApp workspace returned an invalid conversation result.",
    };
  }

  revalidatePath(`/admin/crm/leads/${leadId}`);
  revalidatePath("/admin/whatsapp/inbox");
  revalidatePath(`/admin/whatsapp/inbox/${conversationId}`);

  return {
    success: true,
    conversationId,
    outcome,
    message:
      outcome === "created"
        ? "WhatsApp workspace prepared. No message has been sent yet."
        : "WhatsApp workspace opened. No message has been sent.",
  };
}
