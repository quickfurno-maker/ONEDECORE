import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseWhatsappSendPolicyPayload, type WhatsappSendPolicyRead } from "../contracts/send-policy.ts";

/*
 * Send-policy reads through the CALLER's session. The RPC and the table's RLS
 * both require whatsapp.settings.read (Super Admin, Sales Manager).
 */

export async function getWhatsappSendPolicyForCurrentUser(): Promise<WhatsappSendPolicyRead> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_whatsapp_marketing_send_policy");
  if (error) return { kind: "unreadable" };
  return parseWhatsappSendPolicyPayload(data);
}

export interface WhatsappSendPolicyVersionView {
  readonly version: number;
  readonly executionEnabled: boolean;
  readonly effectiveFrom: string;
}

export async function listWhatsappSendPolicyVersionsForCurrentUser(limit = 8): Promise<readonly WhatsappSendPolicyVersionView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_marketing_send_policies")
    .select("version, execution_enabled, effective_from")
    .order("version", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 25));
  if (error || !data) return [];
  return data.map((row) => ({
    version: row.version,
    executionEnabled: row.execution_enabled,
    effectiveFrom: row.effective_from,
  }));
}
