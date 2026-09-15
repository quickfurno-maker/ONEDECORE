"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsappTemplateStudioSubmission } from "../contracts/template-components.ts";
import {
  describeWhatsappTemplateRefusal,
  type WhatsappTemplateSendActionState,
  type WhatsappTemplateStudioActionState,
} from "../contracts/template-studio.ts";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import { canCurrentUserAccessConversation } from "./whatsapp-inbox-queries.ts";
import { getWhatsappOutboundMode } from "./whatsapp-outbound-env.ts";
import { dispatchWhatsappTemplateSendIntent } from "./whatsapp-template-dispatch-service.ts";
import {
  submitWhatsappTemplateToProvider,
  syncWhatsappTemplatesFromProvider,
} from "./whatsapp-template-management-service.ts";
import { probeWhatsappTemplatePermissions } from "./whatsapp-template-queries.ts";

const TEMPLATES_PATH = "/admin/whatsapp/templates";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireManage(): Promise<WhatsappTemplateStudioActionState | null> {
  const context = await getWhatsappInboxAccessContext();
  const permissions = context ? await probeWhatsappTemplatePermissions() : null;
  if (!context || !permissions?.["whatsapp.templates.manage"]) {
    return { success: false, code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp templates." };
  }
  return null;
}

export async function syncWhatsappTemplatesAction(
  _previous: WhatsappTemplateStudioActionState,
  formData: FormData
): Promise<WhatsappTemplateStudioActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  const templateIdRaw = String(formData.get("templateId") ?? "").trim();
  if (templateIdRaw && !UUID.test(templateIdRaw)) {
    return { success: false, code: "VALIDATION", message: "Unknown template." };
  }

  const result = await syncWhatsappTemplatesFromProvider({ templateId: templateIdRaw || null });
  revalidatePath(TEMPLATES_PATH);

  switch (result.outcome) {
    case "synced":
      return { success: true, message: result.message };
    case "disabled":
      return { success: false, code: "DISABLED", message: result.message };
    default:
      return { success: false, code: result.code, message: result.message };
  }
}

export async function submitWhatsappTemplateAction(
  _previous: WhatsappTemplateStudioActionState,
  formData: FormData
): Promise<WhatsappTemplateStudioActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  if (!UUID.test(idempotencyKey)) {
    return { success: false, code: "VALIDATION", message: "Missing request key. Reload and try again." };
  }

  const examples: string[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const value = formData.get(`bodyExample${index}`);
    if (value === null) break;
    examples.push(String(value));
  }

  const draft = buildWhatsappTemplateStudioSubmission({
    name: String(formData.get("name") ?? ""),
    language: String(formData.get("language") ?? ""),
    category: String(formData.get("category") ?? ""),
    headerText: String(formData.get("headerText") ?? ""),
    bodyText: String(formData.get("bodyText") ?? ""),
    footerText: String(formData.get("footerText") ?? ""),
    bodyExamples: examples,
    headerExample: String(formData.get("headerExample") ?? ""),
  });
  if (!draft.ok) {
    return { success: false, code: "VALIDATION", field: draft.field, message: draft.message };
  }

  const result = await submitWhatsappTemplateToProvider(draft.submission, idempotencyKey);
  revalidatePath(TEMPLATES_PATH);

  switch (result.outcome) {
    case "accepted":
      return { success: true, message: result.message };
    case "disabled":
    case "ambiguous":
    case "unresolved":
      return { success: false, code: result.outcome.toUpperCase(), message: result.message };
    default:
      return { success: false, code: result.code, message: result.message };
  }
}

function readTemplateParameters(formData: FormData): Record<string, Record<string, string>> {
  const parameters: Record<string, Record<string, string>> = {};
  for (const [name, value] of formData.entries()) {
    const match = /^param:(header|body):([A-Za-z0-9_]{1,64})$/.exec(name);
    if (!match || typeof value !== "string") continue;
    const component = match[1]!;
    parameters[component] ??= {};
    parameters[component]![match[2]!] = value;
  }
  return parameters;
}

/**
 * Explicit human send of ONE approved UTILITY template. Kriti never calls
 * this, and nothing else sends a template on a person's behalf.
 */
export async function sendWhatsappUtilityTemplateAction(
  _previous: WhatsappTemplateSendActionState,
  formData: FormData
): Promise<WhatsappTemplateSendActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const snapshotId = String(formData.get("templateSnapshotId") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

  if (!UUID.test(conversationId) || !UUID.test(snapshotId) || !UUID.test(idempotencyKey)) {
    return { success: false, code: "VALIDATION", message: "Choose a template before sending." };
  }

  const context = await getWhatsappInboxAccessContext();
  const permissions = context?.canUse ? await probeWhatsappTemplatePermissions() : null;
  if (!context?.canUse || !permissions?.["whatsapp.templates.use"]) {
    return { success: false, code: "ACCESS_DENIED", message: "You do not have permission to send WhatsApp templates." };
  }
  if (!(await canCurrentUserAccessConversation(conversationId, "use"))) {
    return { success: false, code: "ACCESS_DENIED", message: describeWhatsappTemplateRefusal("denied_scope") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_whatsapp_utility_template_send_intent", {
    p_conversation_id: conversationId,
    p_template_snapshot_id: snapshotId,
    p_template_parameters: readTemplateParameters(formData),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const gateCode =
      /template_not_sendable: ([a-z_]+)/.exec(error.message)?.[1] ??
      /^(denied_[a-z_]+)/.exec(error.message)?.[1] ??
      (error.code === "P0002" ? "denied_scope" : null);
    if (error.message.includes("validation: template_parameters")) {
      return { success: false, code: "VALIDATION", message: "Fill every template value on one line, within the length limit." };
    }
    if (error.message.includes("idempotency_conflict")) {
      return { success: false, code: "IDEMPOTENCY_CONFLICT", message: "This send was already submitted with different values." };
    }
    return { success: false, code: gateCode ?? "RPC_FAILED", message: describeWhatsappTemplateRefusal(gateCode) };
  }

  const intentId = (data as { intent_id?: unknown } | null)?.intent_id;
  if (typeof intentId !== "string") {
    return { success: false, code: "RPC_FAILED", message: "The template send could not be recorded." };
  }

  revalidatePath(`/admin/whatsapp/inbox/${conversationId}`);
  revalidatePath("/admin/whatsapp/inbox");

  if (getWhatsappOutboundMode() === "disabled") {
    return {
      success: true,
      intentId,
      dispatchOutcome: "disabled",
      message: "Template recorded. Outbound WhatsApp is turned off in this environment, so nothing was sent.",
    };
  }

  const result = await dispatchWhatsappTemplateSendIntent(intentId);
  revalidatePath(`/admin/whatsapp/inbox/${conversationId}`);

  if (result.outcome === "bound" || result.outcome === "already_bound") {
    return { success: true, intentId, dispatchOutcome: result.outcome, message: result.message };
  }
  if (result.outcome === "ineligible") {
    return {
      success: false,
      intentId,
      code: result.reason ?? "INELIGIBLE",
      dispatchOutcome: result.outcome,
      message: describeWhatsappTemplateRefusal(result.reason),
    };
  }
  return {
    success: false,
    intentId,
    code: result.outcome === "ambiguous" || result.outcome === "needs_reconcile" ? "DISPATCH_AMBIGUOUS" : "DISPATCH_FAILED",
    dispatchOutcome: result.outcome,
    message: result.message,
  };
}
