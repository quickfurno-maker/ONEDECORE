"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  describeWhatsappControlPlaneRpcError,
  WHATSAPP_ADMIN_SETTINGS_PATH,
  type WhatsappControlPlaneActionState,
} from "../contracts/control-plane.ts";
import { buildWhatsappSendPolicySubmission } from "../contracts/send-policy.ts";
import { isUuid } from "../contracts/control-plane.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";

/*
 * Append a new send-policy version. Super Admin only: whatsapp.settings.manage
 * is granted to no other role, and `set_whatsapp_marketing_send_policy` also
 * requires the super_admin role itself.
 */

export async function saveWhatsappSendPolicyAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.settings.manage"]) {
    return { success: false, code: "ACCESS_DENIED", message: "Only a Super Admin can change the WhatsApp marketing send policy." };
  }

  const draft = buildWhatsappSendPolicySubmission({
    windowHours: formData.getAll("windowHours").map(String),
    maxMessages: formData.getAll("maxMessages").map(String),
    startLocal: String(formData.get("startLocal") ?? ""),
    endLocal: String(formData.get("endLocal") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    executionEnabled: formData.get("executionEnabled") === "on",
    confirmExecution: formData.get("confirmExecution") === "on",
  });
  if (!draft.ok) return { success: false, code: "VALIDATION", field: draft.field, message: draft.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_whatsapp_marketing_send_policy", {
    p_frequency_rules: draft.submission.frequencyRules,
    p_quiet_hours: draft.submission.quietHours,
    p_timezone: draft.submission.timezone,
    p_execution_enabled: draft.submission.executionEnabled,
  });
  if (error) return { success: false, ...describeWhatsappControlPlaneRpcError(error, "policy") };

  revalidatePath(WHATSAPP_ADMIN_SETTINGS_PATH);
  const version = (data as { version?: unknown } | null)?.version;
  return {
    success: true,
    message: typeof version === "number" ? `Policy version ${version} is now in effect.` : "Policy saved.",
  };
}

/*
 * WM-5 tracked-link destinations. Super Admin only (whatsapp.settings.manage;
 * the RPC also requires the role). A destination already used by sent links
 * keeps its URL; it can only be deactivated.
 */
export async function saveWhatsappClickDestinationAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.settings.manage"]) {
    return { success: false, code: "ACCESS_DENIED", message: "Only a Super Admin can manage tracked-link destinations." };
  }
  const destinationId = String(formData.get("destinationId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const url = String(formData.get("destinationUrl") ?? "").trim();
  const active = formData.get("isActive") !== "off";
  if (destinationId !== "" && !isUuid(destinationId)) return { success: false, code: "VALIDATION", message: "Unknown destination." };
  if (label.length < 2 || label.length > 80) return { success: false, code: "VALIDATION", field: "label", message: "Label must be 2–80 characters." };
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.protocol !== "https:" || parsed.username || parsed.password || url.length > 2048) {
    return { success: false, code: "VALIDATION", field: "destinationUrl", message: "Use an https link without credentials." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_whatsapp_click_destination", {
    p_label: label,
    p_destination_url: url,
    p_active: active,
    p_destination_id: destinationId === "" ? null : destinationId,
  });
  if (error) {
    if ((error.message ?? "").includes("WHATSAPP_CLICK_DESTINATION_IN_USE")) {
      return { success: false, code: "IN_USE", message: "Links already sent point here, so the URL cannot change. Deactivate it and add a new one." };
    }
    return { success: false, ...describeWhatsappControlPlaneRpcError(error, "policy") };
  }
  revalidatePath(WHATSAPP_ADMIN_SETTINGS_PATH);
  return { success: true, message: "Destination saved." };
}
