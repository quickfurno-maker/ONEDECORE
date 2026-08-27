import "server-only";

import { createClient } from "@/lib/supabase/server";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

export interface CrmWhatsappSendIntentOption {
  readonly intentId: string;
  readonly createdAt: string;
  readonly lifecycleStatus: string;
  readonly purposeCode: string;
  readonly label: string;
}

function formatIntentLabel(purposeCode: string, createdAt: string): string {
  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(createdAt));
  const purpose = purposeCode.replace(/_/g, " ");
  return `${purpose} · ${when}`;
}

/**
 * Lists recent governed outbound send intents for a lead's WhatsApp conversation(s).
 * RLS on whatsapp_send_intents / whatsapp_conversations is authoritative; returns [] when
 * the actor cannot view the conversation.
 */
export async function fetchGovernedWhatsappSendIntentsForLead(
  leadId: string
): Promise<readonly CrmWhatsappSendIntentOption[]> {
  const supabase = await createClient();

  const { data: conversations, error: conversationError } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("lead_id", leadId);

  if (conversationError) {
    throw crmErrorFromPostgresMessage(conversationError.message, "RPC_FAILED");
  }

  const conversationIds = (conversations ?? []).map((row) => row.id);
  if (conversationIds.length === 0) {
    return [];
  }

  const { data: intents, error: intentError } = await supabase
    .from("whatsapp_send_intents")
    .select("id, created_at, lifecycle_status, purpose_code")
    .in("conversation_id", conversationIds)
    .eq("lifecycle_status", "dispatch_bound")
    .not("outbound_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (intentError) {
    throw crmErrorFromPostgresMessage(intentError.message, "RPC_FAILED");
  }

  return (intents ?? []).map((row) => ({
    intentId: row.id,
    createdAt: row.created_at,
    lifecycleStatus: row.lifecycle_status,
    purposeCode: row.purpose_code,
    label: formatIntentLabel(row.purpose_code, row.created_at),
  }));
}
