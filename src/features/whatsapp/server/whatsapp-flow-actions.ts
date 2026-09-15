"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { isUuid, WHATSAPP_ADMIN_FLOWS_PATH, type WhatsappControlPlaneActionState } from "../contracts/control-plane.ts";
import {
  buildWhatsappFlowDraft,
  describeWhatsappFlowRpcError,
  isWhatsappFlowProviderAction,
  WHATSAPP_FLOW_RPC,
} from "../contracts/flows.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";
import { performWhatsappFlowProviderAction } from "./whatsapp-flow-management-service.ts";

/*
 * WM-6 Forms / Flows actions. whatsapp.flows.manage is checked on the caller's
 * session FIRST; the RPC re-checks it. A provider action records the human
 * decision through the session before any service-role write records Meta's
 * answer.
 */

const denied: WhatsappControlPlaneActionState = {
  success: false,
  code: "ACCESS_DENIED",
  message: "You do not have permission to manage WhatsApp Flows.",
};

export async function saveWhatsappFlowDraftAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.flows.manage"]) return denied;

  const flowIdRaw = String(formData.get("flowId") ?? "").trim();
  if (flowIdRaw !== "" && !isUuid(flowIdRaw)) return { success: false, code: "VALIDATION", message: "Unknown Flow." };
  const draft = buildWhatsappFlowDraft({
    name: String(formData.get("name") ?? ""),
    categories: formData.getAll("categories").map(String),
    purpose: String(formData.get("purpose") ?? ""),
    mappingKeys: formData.getAll("mappingKey").map(String),
    mappingTargets: formData.getAll("mappingTarget").map(String),
    flowJson: String(formData.get("flowJson") ?? ""),
  });
  if (!draft.ok) return { success: false, code: "VALIDATION", field: draft.field, message: draft.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_FLOW_RPC.saveDraft, {
    p_name: draft.value.name,
    p_categories: [...draft.value.categories],
    p_purpose: draft.value.purpose,
    p_field_mappings: draft.value.fieldMappings,
    ...(draft.value.flowJson ? { p_flow_json: draft.value.flowJson as Json } : {}),
    ...(flowIdRaw ? { p_flow_id: flowIdRaw } : {}),
    ...(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ? { p_waba_id: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID } : {}),
  });
  if (error) return { success: false, ...describeWhatsappFlowRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_FLOWS_PATH);
  const savedId = (data as { flow_id?: unknown } | null)?.flow_id;
  return { success: true, message: typeof savedId === "string" && !flowIdRaw ? "Flow draft created locally. Nothing was sent to Meta." : "Flow draft saved." };
}

export async function requestWhatsappFlowProviderActionAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.flows.manage"]) return denied;

  const flowId = String(formData.get("flowId") ?? "").trim();
  const action = String(formData.get("action") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  if (!isUuid(flowId) || !isWhatsappFlowProviderAction(action) || !isUuid(idempotencyKey)) {
    return { success: false, code: "VALIDATION", message: "Reload the page and try again." };
  }

  const result = await performWhatsappFlowProviderAction({ flowId, action, idempotencyKey });
  revalidatePath(WHATSAPP_ADMIN_FLOWS_PATH);
  switch (result.outcome) {
    case "accepted":
      return { success: true, message: result.message };
    case "disabled":
      return { success: false, code: "DISABLED", message: result.message };
    case "ambiguous":
      return { success: false, code: "AMBIGUOUS", message: result.message };
    default:
      return { success: false, code: result.code, message: result.message };
  }
}
