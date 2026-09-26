"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  describeWhatsappCampaignRpcError,
  isWhatsappCampaignRunOperation,
  parseWhatsappCampaignScheduledFor,
  parseWhatsappCampaignTestSendPayload,
  parseWhatsappCampaignVersionDetail,
  readWhatsappCampaignButtonBindings,
  readWhatsappCampaignSpecParameters,
  WHATSAPP_CAMPAIGN_EXECUTION_RPC,
  WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION,
  WHATSAPP_CAMPAIGN_RUN_OPERATION_RPC,
  whatsappTemplateButtonSlots,
} from "../contracts/campaign-execution.ts";
import { isWhatsappMarketingPreferenceCategory } from "../contracts/contacts-compliance.ts";
import {
  isUuid,
  WHATSAPP_ADMIN_CAMPAIGNS_PATH,
  WHATSAPP_ADMIN_SCHEDULER_PATH,
  type WhatsappControlPlaneActionState,
} from "../contracts/control-plane.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";

/*
 * WM-4 campaign actions. Every action authorizes the caller's own permission
 * FIRST, then calls its RPC through the caller's cookie session, where SQL
 * re-checks the permission, the generic campaign approval, independent
 * operator, the frozen spec, the send policy and the run state. Nothing here
 * approves a campaign, and nothing here reaches the service role.
 */

const denied = (message: string): WhatsappControlPlaneActionState => ({ success: false, code: "ACCESS_DENIED", message });

function versionIdFrom(formData: FormData): string | null {
  const raw = String(formData.get("campaignVersionId") ?? "").trim();
  return isUuid(raw) ? raw : null;
}

export async function saveWhatsappCampaignSpecAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["campaigns.draft"] || !access.permissions["whatsapp.templates.read"]) {
    return denied("Only a Super Admin drafting the campaign can edit its WhatsApp spec.");
  }

  const versionId = versionIdFrom(formData);
  if (!versionId) return { success: false, code: "VALIDATION", message: "Unknown campaign version." };
  const snapshotId = String(formData.get("templateSnapshotId") ?? "").trim();
  if (!isUuid(snapshotId)) {
    return { success: false, code: "VALIDATION", field: "templateSnapshotId", message: "Choose an approved MARKETING template." };
  }
  const category = String(formData.get("preferenceCategory") ?? "").trim();
  if (!isWhatsappMarketingPreferenceCategory(category)) {
    return { success: false, code: "VALIDATION", field: "preferenceCategory", message: "Choose a preference category." };
  }
  const segmentRaw = String(formData.get("segmentId") ?? "").trim();
  if (segmentRaw !== "" && !isUuid(segmentRaw)) {
    return { success: false, code: "VALIDATION", field: "segmentId", message: "Unknown segment." };
  }
  const { defaults, bindings } = readWhatsappCampaignSpecParameters(formData.entries() as Iterable<[string, FormDataEntryValue]>);

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.saveSpec, {
    p_campaign_version_id: versionId,
    p_template_snapshot_id: snapshotId,
    p_preference_category: category,
    p_default_parameters: defaults,
    p_parameter_bindings: bindings,
    ...(segmentRaw ? { p_segment_id: segmentRaw } : {}),
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  return { success: true, message: "Campaign spec saved. Submit the version for approval to freeze it." };
}

export async function saveWhatsappCampaignButtonBindingsAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["campaigns.draft"] || !access.permissions["whatsapp.templates.read"]) {
    return denied("Only a Super Admin drafting the campaign can map template buttons.");
  }
  const versionId = versionIdFrom(formData);
  if (!versionId) return { success: false, code: "VALIDATION", message: "Unknown campaign version." };

  const supabase = await createClient();
  const { data: versionData, error: versionError } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.getVersion, {
    p_campaign_version_id: versionId,
  });
  const detail = versionError ? null : parseWhatsappCampaignVersionDetail(versionData);
  if (!detail?.spec) return { success: false, code: "NOT_FOUND", message: "Save the spec before mapping its buttons." };

  const slots = whatsappTemplateButtonSlots(detail.spec.components);
  const buttonBindings = readWhatsappCampaignButtonBindings(formData.entries() as Iterable<[string, FormDataEntryValue]>, slots);
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.setButtonBindings, {
    p_campaign_version_id: versionId,
    p_button_bindings: buttonBindings,
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  const complete = (data as { complete?: unknown } | null)?.complete === true;
  return { success: true, message: complete ? "Every template button is mapped." : "Saved. Some buttons still need a destination." };
}

export async function createWhatsappCampaignRunAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.execute"]) {
    return denied("You do not have permission to run WhatsApp campaigns.");
  }

  const versionId = versionIdFrom(formData);
  if (!versionId) return { success: false, code: "VALIDATION", message: "Unknown campaign version." };
  const scheduled = parseWhatsappCampaignScheduledFor(String(formData.get("scheduledFor") ?? ""));
  if (!scheduled.ok) return { success: false, code: "VALIDATION", field: "scheduledFor", message: scheduled.message };
  const autoStart = formData.get("autoStart") !== "off";

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.createRun, {
    p_campaign_version_id: versionId,
    p_auto_start: autoStart,
    ...(scheduled.value ? { p_scheduled_for: scheduled.value } : {}),
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  revalidatePath(WHATSAPP_ADMIN_SCHEDULER_PATH);
  return {
    success: true,
    message: scheduled.value
      ? "Run scheduled. Recipients are re-checked just before each send."
      : "Run created. The worker materialises it on its next tick.",
  };
}

export async function rescheduleWhatsappCampaignRunAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.execute"]) {
    return denied("You do not have permission to reschedule WhatsApp campaigns.");
  }

  const runId = String(formData.get("runId") ?? "").trim();
  if (!isUuid(runId)) {
    return { success: false, code: "VALIDATION", message: "Unknown campaign run." };
  }
  const scheduled = parseWhatsappCampaignScheduledFor(String(formData.get("scheduledFor") ?? ""));
  if (!scheduled.ok || !scheduled.value) {
    return {
      success: false,
      code: "VALIDATION",
      field: "scheduledFor",
      message: scheduled.ok ? "Choose a future schedule time." : scheduled.message,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.rescheduleRun, {
    p_run_id: runId,
    p_scheduled_for: scheduled.value,
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_SCHEDULER_PATH);
  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  return {
    success: true,
    message: "Campaign rescheduled. The live CRM audience will still be calculated only when the run becomes due.",
  };
}

export async function transitionWhatsappCampaignRunAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const operation = String(formData.get("operation") ?? "");
  if (!isWhatsappCampaignRunOperation(operation)) {
    return { success: false, code: "VALIDATION", message: "Unknown run action." };
  }

  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions[WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION[operation]]) {
    return denied(
      operation === "cancel"
        ? "Only a Super Admin can cancel a WhatsApp campaign run."
        : "You do not have permission to run WhatsApp campaigns."
    );
  }

  const runId = String(formData.get("runId") ?? "").trim();
  if (!isUuid(runId)) return { success: false, code: "VALIDATION", message: "Unknown run." };

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_CAMPAIGN_RUN_OPERATION_RPC[operation], { p_run_id: runId });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  return { success: true, message: "Run updated." };
}

export async function createWhatsappCampaignTestSendAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.test_send"]) {
    return denied("You do not have permission to send campaign tests.");
  }

  const versionId = versionIdFrom(formData);
  if (!versionId) return { success: false, code: "VALIDATION", message: "Unknown campaign version." };
  const destinationRaw = String(formData.get("destinationProfileId") ?? "").trim();
  const destination = destinationRaw === "" ? access.userId : destinationRaw;
  if (!isUuid(destination)) {
    return { success: false, code: "VALIDATION", field: "destinationProfileId", message: "Choose a registered internal test recipient." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.createTestSend, {
    p_campaign_version_id: versionId,
    p_destination_profile_id: destination,
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  const testSend = parseWhatsappCampaignTestSendPayload(data);
  if (!testSend) return { success: false, code: "RPC_FAILED", message: "The test send could not be recorded." };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  return { success: true, message: "Test queued for the internal staff number. The worker sends it on its next tick." };
}

export async function resolveWhatsappCampaignReconcileAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.campaigns.cancel"]) {
    return denied("Only a Super Admin can resolve an ambiguous send.");
  }
  const jobId = String(formData.get("jobId") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const providerMessageId = String(formData.get("providerMessageId") ?? "").trim();
  if (!isUuid(jobId) || (resolution !== "sent" && resolution !== "not_sent")) {
    return { success: false, code: "VALIDATION", message: "Choose what the evidence shows." };
  }
  if (note.length < 8 || note.length > 500) {
    return { success: false, code: "VALIDATION", field: "note", message: "Write a note of 8–500 characters describing the evidence." };
  }
  if (resolution === "sent" && !/^[A-Za-z0-9._:=+-]{1,128}$/.test(providerMessageId)) {
    return { success: false, code: "VALIDATION", field: "providerMessageId", message: "A 'sent' decision needs the provider message id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.resolveReconcile, {
    p_job_id: jobId,
    p_resolution: resolution,
    p_note: note,
    ...(resolution === "sent" ? { p_provider_message_id: providerMessageId } : {}),
  });
  if (error) return { success: false, ...describeWhatsappCampaignRpcError(error) };

  revalidatePath(WHATSAPP_ADMIN_CAMPAIGNS_PATH);
  return { success: true, message: "Decision recorded in the append-only evidence." };
}
