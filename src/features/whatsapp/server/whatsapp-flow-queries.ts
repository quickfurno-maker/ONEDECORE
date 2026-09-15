import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../contracts/control-plane.ts";
import {
  parseWhatsappFlowDetail,
  parseWhatsappFlowList,
  WHATSAPP_FLOW_RPC,
  type WhatsappFlowDetail,
  type WhatsappFlowSummary,
} from "../contracts/flows.ts";
import { getWhatsappFlowManagementMode, type WhatsappBusinessMode } from "./whatsapp-business-env.ts";

/* Flow registry reads through the CALLER's session; the RPCs require whatsapp.flows.read. */

export async function listWhatsappFlowsForCurrentUser(): Promise<readonly WhatsappFlowSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_FLOW_RPC.list);
  if (error) return [];
  return parseWhatsappFlowList(data);
}

export async function getWhatsappFlowForCurrentUser(flowId: string): Promise<WhatsappFlowDetail | null> {
  if (!isUuid(flowId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_FLOW_RPC.get, { p_flow_id: flowId });
  if (error) return null;
  return parseWhatsappFlowDetail(data);
}

/** Configuration truth without secrets: which provider path a Flow action would take. */
export function getWhatsappFlowProviderMode(): WhatsappBusinessMode {
  return getWhatsappFlowManagementMode();
}
