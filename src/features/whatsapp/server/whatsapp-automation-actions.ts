"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildWhatsappAutomationDraft,
  describeWhatsappAutomationRpcError,
  isWhatsappAutomationAction,
  WHATSAPP_AUTOMATION_RPC,
} from "../contracts/automations.ts";
import { isUuid, WHATSAPP_ADMIN_AUTOMATIONS_PATH, type WhatsappControlPlaneActionState } from "../contracts/control-plane.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";

/*
 * WM-6 automation actions. whatsapp.automations.manage is checked on the
 * caller's session FIRST; SQL re-checks it and, for activate/resume, the
 * approved version, independent operator, sendable MARKETING template,
 * complete button bindings and the execution gate. No action sends a message:
 * the internal worker does, one JIT-checked enrollment at a time. Kriti has no
 * path to any of these.
 */

const denied: WhatsappControlPlaneActionState = {
  success: false,
  code: "ACCESS_DENIED",
  message: "You do not have permission to manage WhatsApp automations.",
};

export async function saveWhatsappAutomationAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.automations.manage"]) return denied;

  const automationIdRaw = String(formData.get("automationId") ?? "").trim();
  if (automationIdRaw !== "" && !isUuid(automationIdRaw)) return { success: false, code: "VALIDATION", message: "Unknown automation." };
  const draft = buildWhatsappAutomationDraft({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    triggerType: String(formData.get("triggerType") ?? ""),
    toStage: String(formData.get("toStage") ?? ""),
    triggerCampaignVersionId: String(formData.get("triggerCampaignVersionId") ?? ""),
    flowId: String(formData.get("flowId") ?? ""),
    sourceId: String(formData.get("sourceId") ?? ""),
    campaignVersionId: String(formData.get("campaignVersionId") ?? ""),
    delayMinutes: String(formData.get("delayMinutes") ?? "0"),
    stopOnLeadStatuses: formData.getAll("stopOnLeadStatuses").map(String),
    stopOnReply: formData.get("stopOnReply") === "on",
  });
  if (!draft.ok) return { success: false, code: "VALIDATION", field: draft.field, message: draft.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_AUTOMATION_RPC.save, {
    p_name: draft.value.name,
    p_trigger_type: draft.value.triggerType,
    p_trigger_config: draft.value.triggerConfig,
    p_campaign_version_id: draft.value.campaignVersionId,
    p_delay_minutes: draft.value.delayMinutes,
    p_stop_on_lead_statuses: [...draft.value.stopOnLeadStatuses],
    p_stop_on_reply: draft.value.stopOnReply,
    ...(draft.value.description ? { p_description: draft.value.description } : {}),
    ...(automationIdRaw ? { p_automation_id: automationIdRaw } : {}),
  });
  if (error) return { success: false, ...describeWhatsappAutomationRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_AUTOMATIONS_PATH);
  return { success: true, message: "Automation draft saved. It sends nothing until activated." };
}

export async function setWhatsappAutomationStatusAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.automations.manage"]) return denied;

  const automationId = String(formData.get("automationId") ?? "").trim();
  const action = String(formData.get("action") ?? "");
  const lockVersion = Number(formData.get("lockVersion"));
  if (!isUuid(automationId) || !isWhatsappAutomationAction(action) || !Number.isInteger(lockVersion) || lockVersion < 1) {
    return { success: false, code: "VALIDATION", message: "Reload the page and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_AUTOMATION_RPC.setStatus, {
    p_automation_id: automationId,
    p_action: action,
    p_lock_version: lockVersion,
  });
  if (error) return { success: false, ...describeWhatsappAutomationRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_AUTOMATIONS_PATH);
  const status = String((data as { status?: unknown } | null)?.status ?? action);
  return { success: true, message: `Automation is now ${status}.` };
}

export async function resolveWhatsappAutomationReconcileAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  // The RPC also requires the super_admin role; the manage code alone is not enough.
  if (!access?.permissions["whatsapp.automations.manage"] || !access.permissions["whatsapp.campaigns.cancel"]) {
    return { success: false, code: "ACCESS_DENIED", message: "Only a Super Admin can resolve an ambiguous send." };
  }
  const enrollmentId = String(formData.get("jobId") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const providerMessageId = String(formData.get("providerMessageId") ?? "").trim();
  if (!isUuid(enrollmentId) || (resolution !== "sent" && resolution !== "not_sent")) {
    return { success: false, code: "VALIDATION", message: "Choose what the evidence shows." };
  }
  if (note.length < 8 || note.length > 500) {
    return { success: false, code: "VALIDATION", field: "note", message: "Write a note of 8–500 characters describing the evidence." };
  }
  if (resolution === "sent" && !/^[A-Za-z0-9._:=+-]{1,128}$/.test(providerMessageId)) {
    return { success: false, code: "VALIDATION", field: "providerMessageId", message: "A 'sent' decision needs the provider message id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_AUTOMATION_RPC.resolveReconcile, {
    p_enrollment_id: enrollmentId,
    p_resolution: resolution,
    p_note: note,
    ...(resolution === "sent" ? { p_provider_message_id: providerMessageId } : {}),
  });
  if (error) return { success: false, ...describeWhatsappAutomationRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_AUTOMATIONS_PATH);
  return { success: true, message: "Decision recorded in the append-only evidence." };
}
