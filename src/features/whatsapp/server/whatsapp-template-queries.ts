import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";
import {
  parseWhatsappSendableTemplatesPayload,
  parseWhatsappTemplateRegistryPayload,
  type WhatsappSendableTemplateView,
  type WhatsappTemplateManagementStatusView,
  type WhatsappTemplateRegistryPage,
  type WhatsappTemplateRegistryQuery,
} from "../contracts/template-studio.ts";
import { getWhatsappTemplateManagementMode } from "./whatsapp-business-env.ts";
import { whatsappInboxErrorFromPostgresMessage } from "./whatsapp-inbox-errors.ts";

/*
 * Every read here goes through the CALLER's session and a database read model.
 * No service-role client: the registry, the selector and the evidence are
 * scoped by `whatsapp.templates.*`, `whatsapp.inbox.use` and the live CRM
 * predicate in SQL, not filtered in TypeScript.
 */

export const WHATSAPP_TEMPLATE_PERMISSION_CODES = [
  "whatsapp.templates.read",
  "whatsapp.templates.use",
  "whatsapp.templates.manage",
] as const;

export type WhatsappTemplatePermissionMap = Record<(typeof WHATSAPP_TEMPLATE_PERMISSION_CODES)[number], boolean>;

export async function probeWhatsappTemplatePermissions(): Promise<WhatsappTemplatePermissionMap> {
  const answers = await authorizeMany(WHATSAPP_TEMPLATE_PERMISSION_CODES);
  return {
    "whatsapp.templates.read": answers["whatsapp.templates.read"],
    "whatsapp.templates.use": answers["whatsapp.templates.use"],
    "whatsapp.templates.manage": answers["whatsapp.templates.manage"],
  };
}

export async function listWhatsappTemplateRegistryForCurrentUser(
  query: WhatsappTemplateRegistryQuery
): Promise<WhatsappTemplateRegistryPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_whatsapp_template_registry", {
    p_status: query.status ?? undefined,
    p_category: query.category ?? undefined,
    p_search: query.q ?? undefined,
    p_page: query.page,
    p_page_size: query.pageSize,
  });
  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
  return parseWhatsappTemplateRegistryPayload(data);
}

/**
 * The approved UTILITY templates the current user may send in ONE
 * conversation. A conversation outside scope answers an empty list, the same
 * as a conversation with no approved templates: the picker is not an oracle.
 */
export async function listSendableUtilityTemplatesForConversation(
  conversationId: string
): Promise<readonly WhatsappSendableTemplateView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_whatsapp_sendable_utility_templates", {
    p_conversation_id: conversationId,
  });
  if (error) {
    if (error.code === "P0002") return [];
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
  return parseWhatsappSendableTemplatesPayload(data);
}

export type WhatsappTemplateSubmissionView = {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly createdAt: string;
  readonly outcome: "accepted" | "failed" | "ambiguous" | "unresolved";
  readonly errorCode: string | null;
};

/** Recent Studio submissions with their single recorded outcome, through RLS. */
export async function listRecentWhatsappTemplateSubmissions(limit = 10): Promise<readonly WhatsappTemplateSubmissionView[]> {
  const supabase = await createClient();
  const { data: submissions, error } = await supabase
    .from("whatsapp_template_submissions")
    .select("id, name, language, category, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error || !submissions || submissions.length === 0) return [];

  const { data: events } = await supabase
    .from("whatsapp_template_status_events")
    .select("submission_id, event_kind, error_code")
    .in(
      "submission_id",
      submissions.map((s) => s.id)
    );

  return submissions.map((submission) => {
    const event = (events ?? []).find((e) => e.submission_id === submission.id);
    const outcome =
      event?.event_kind === "submission_accepted"
        ? "accepted"
        : event?.event_kind === "submission_failed"
          ? "failed"
          : event?.event_kind === "submission_ambiguous"
            ? "ambiguous"
            : "unresolved";
    return {
      id: submission.id,
      name: submission.name,
      language: submission.language,
      category: submission.category,
      createdAt: submission.created_at,
      outcome,
      errorCode: event?.error_code ?? null,
    };
  });
}

/**
 * How Template Studio reaches Meta here, in words. A mode, never an account
 * id, token presence or Graph version.
 */
export function getWhatsappTemplateManagementStatus(): WhatsappTemplateManagementStatusView {
  const mode = getWhatsappTemplateManagementMode();
  if (mode === "enabled") {
    return {
      mode,
      tone: "live",
      label: "Connected to WhatsApp",
      detail: "Sync and submit call the official WhatsApp Business Management API. Approval is decided by WhatsApp.",
      actionsAvailable: true,
    };
  }
  if (mode === "local-test") {
    return {
      mode,
      tone: "test",
      label: "Test provider",
      detail: "Sync and submit use a local test provider. It never approves a template and nothing reaches WhatsApp.",
      actionsAvailable: true,
    };
  }
  return {
    mode,
    tone: "off",
    label: "Provider off",
    detail: "Template management is turned off in this environment. The registry below is what ONEDECORE last recorded; sync and submit are unavailable.",
    actionsAvailable: false,
  };
}
