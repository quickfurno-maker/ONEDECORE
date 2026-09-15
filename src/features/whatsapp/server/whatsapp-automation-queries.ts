import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseWhatsappAutomationDetail,
  parseWhatsappAutomationList,
  WHATSAPP_AUTOMATION_RPC,
  type WhatsappAutomationDetail,
  type WhatsappAutomationView,
} from "../contracts/automations.ts";
import { isUuid } from "../contracts/control-plane.ts";

/* Automation reads through the CALLER's session; the RPCs require whatsapp.automations.read. */

export async function listWhatsappAutomationsForCurrentUser(): Promise<readonly WhatsappAutomationView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_AUTOMATION_RPC.list);
  if (error) return [];
  return parseWhatsappAutomationList(data);
}

/** Missing and invisible automations both come back null. */
export async function getWhatsappAutomationForCurrentUser(automationId: string): Promise<WhatsappAutomationDetail | null> {
  if (!isUuid(automationId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_AUTOMATION_RPC.get, { p_automation_id: automationId });
  if (error) return null;
  return parseWhatsappAutomationDetail(data);
}
