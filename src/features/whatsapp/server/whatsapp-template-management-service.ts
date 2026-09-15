import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { WhatsappTemplateStudioSubmission } from "../contracts/template-components.ts";
import type { WhatsappProviderTemplateRecord } from "../contracts/template-studio.ts";
import {
  getWhatsappTemplateManagementServerEnv,
  type WhatsappBusinessServerEnv,
} from "./whatsapp-business-env.ts";
import { createFakeWhatsappTemplateManagementAdapter } from "./whatsapp-fake-template-adapters.ts";
import { createMetaWhatsappTemplateManagementAdapter } from "./whatsapp-meta-template-management-adapter.ts";
import type { WhatsappTemplateManagementAdapter } from "./whatsapp-template-provider-adapter.ts";

/**
 * WM-2 — Template Studio provider workflows.
 *
 * WHO WRITES WHAT
 *
 *   the staff session   records the human decision: request a sync, submit a
 *                       template (authenticated RPCs, actor = auth.uid()).
 *   the provider        answers.
 *   service_role        records the answer (apply_whatsapp_template_sync_item,
 *                       record_whatsapp_template_submission_outcome).
 *
 * A manager can therefore start a sync but cannot tell the database a template
 * is approved: only a provider response, relayed by the server, can.
 */

type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type WhatsappTemplateManagementDeps = {
  readonly getEnv?: () => WhatsappBusinessServerEnv;
  readonly createSessionClient?: () => Promise<RpcClient>;
  readonly createAdminClient?: (env: WhatsappBusinessServerEnv) => RpcClient;
  readonly createAdapter?: (env: WhatsappBusinessServerEnv) => WhatsappTemplateManagementAdapter;
};

export type WhatsappTemplateSyncOutcome =
  | { readonly outcome: "disabled"; readonly message: string }
  | { readonly outcome: "refused"; readonly code: string; readonly message: string }
  | { readonly outcome: "provider_failed"; readonly code: string; readonly message: string }
  | {
      readonly outcome: "synced";
      readonly applied: number;
      readonly changed: number;
      readonly rejected: number;
      readonly skipped: number;
      readonly truncated: boolean;
      readonly message: string;
    };

export type WhatsappTemplateSubmitOutcome =
  | { readonly outcome: "disabled"; readonly message: string }
  | { readonly outcome: "refused"; readonly code: string; readonly message: string }
  | { readonly outcome: "accepted"; readonly status: string; readonly message: string }
  | { readonly outcome: "failed"; readonly code: string; readonly message: string }
  | { readonly outcome: "ambiguous"; readonly message: string }
  | { readonly outcome: "unresolved"; readonly message: string };

/**
 * One fake store per process in local-test, so a template created from the
 * Studio is visible to the next sync. Still PENDING forever: see the fake.
 */
const LOCAL_TEST_TEMPLATE_STORE = new Map<string, WhatsappProviderTemplateRecord>();

function adminClient(env: WhatsappBusinessServerEnv): RpcClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE WhatsApp Templates] Admin client unavailable.");
  }
  return createSupabaseClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RpcClient;
}

function adapterFor(
  env: WhatsappBusinessServerEnv,
  factory: WhatsappTemplateManagementDeps["createAdapter"]
): WhatsappTemplateManagementAdapter {
  if (factory) return factory(env);
  return env.providerCode === "fake"
    ? createFakeWhatsappTemplateManagementAdapter(LOCAL_TEST_TEMPLATE_STORE)
    : createMetaWhatsappTemplateManagementAdapter(env);
}

function refusal(message: string): { code: string; message: string } {
  if (message.includes("denied_templates_manage")) {
    return { code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp templates." };
  }
  if (message.includes("whatsapp_business_account_not_registered")) {
    return { code: "WABA_NOT_REGISTERED", message: "The WhatsApp Business Account is not registered." };
  }
  if (message.includes("whatsapp_template_not_found")) {
    return { code: "NOT_FOUND", message: "That template is not in the registry." };
  }
  if (message.includes("template_name_language_exists")) {
    return { code: "EXISTS", message: "A live template already uses this name and language." };
  }
  if (message.includes("template_submission_unresolved")) {
    return {
      code: "UNRESOLVED",
      message: "An earlier submission for this name and language has no confirmed outcome. Sync templates first.",
    };
  }
  if (message.includes("idempotency_conflict")) {
    return { code: "IDEMPOTENCY_CONFLICT", message: "This request was already used for different content." };
  }
  const validation = /validation: components \(([a-z_]+)\)/.exec(message);
  if (validation) {
    return { code: "VALIDATION", message: `The template is not valid: ${validation[1]!.replace(/_/g, " ")}.` };
  }
  if (message.includes("validation:")) {
    return { code: "VALIDATION", message: "The template request is not valid." };
  }
  return { code: "RPC_FAILED", message: "The request could not be recorded." };
}

/** The session's own answer, before any service-role write happens on its behalf. */
async function holdsManage(session: RpcClient): Promise<boolean> {
  const { data, error } = await session.rpc("authorize", { requested_permission: "whatsapp.templates.manage" });
  return !error && data === true;
}

async function sessionClient(deps: WhatsappTemplateManagementDeps): Promise<RpcClient> {
  return deps.createSessionClient ? deps.createSessionClient() : ((await createSessionClient()) as unknown as RpcClient);
}

function readEnv(deps: WhatsappTemplateManagementDeps): WhatsappBusinessServerEnv | null {
  try {
    return (deps.getEnv ?? getWhatsappTemplateManagementServerEnv)();
  } catch {
    return null;
  }
}

/**
 * Pull templates from the provider into the registry. `templateId` limits the
 * run to one registry row: a status refresh.
 */
export async function syncWhatsappTemplatesFromProvider(
  input: { readonly templateId?: string | null } = {},
  deps: WhatsappTemplateManagementDeps = {}
): Promise<WhatsappTemplateSyncOutcome> {
  const env = readEnv(deps);
  if (!env) {
    return { outcome: "refused", code: "MISCONFIGURED", message: "Template management is not configured correctly in this environment." };
  }
  if (env.mode === "disabled" || !env.wabaId) {
    return { outcome: "disabled", message: "Template management is turned off in this environment. Nothing was requested from WhatsApp." };
  }

  const session = await sessionClient(deps);
  if (!(await holdsManage(session))) {
    return { outcome: "refused", code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp templates." };
  }
  const admin = (deps.createAdminClient ?? adminClient)(env);

  const ensured = await admin.rpc("ensure_whatsapp_business_account", { p_waba_id: env.wabaId });
  if (ensured.error) {
    return { outcome: "refused", code: "RPC_FAILED", message: "The WhatsApp Business Account could not be registered." };
  }

  const requested = await session.rpc("request_whatsapp_template_sync", {
    p_waba_id: env.wabaId,
    p_template_id: input.templateId ?? undefined,
  });
  if (requested.error) {
    return { outcome: "refused", ...refusal(requested.error.message) };
  }
  const run = requested.data as { sync_run_id?: string; provider_template_id?: string | null } | null;
  if (!run?.sync_run_id) {
    return { outcome: "refused", code: "RPC_FAILED", message: "The sync request could not be recorded." };
  }

  const adapter = adapterFor(env, deps.createAdapter);
  let templates: readonly WhatsappProviderTemplateRecord[];
  let skipped = 0;
  let truncated = false;

  if (input.templateId) {
    if (!run.provider_template_id) {
      return { outcome: "refused", code: "NOT_FOUND", message: "That template has no provider id to refresh." };
    }
    const got = await adapter.getTemplate({ providerTemplateId: run.provider_template_id });
    if (got.kind !== "success") {
      return { outcome: "provider_failed", code: got.code, message: "WhatsApp did not return the template status." };
    }
    templates = [got.template];
  } else {
    const listed = await adapter.listTemplates({ wabaId: env.wabaId });
    if (listed.kind !== "success") {
      return { outcome: "provider_failed", code: listed.code, message: "WhatsApp did not return the template list." };
    }
    templates = listed.templates;
    skipped = listed.skipped;
    truncated = listed.truncated;
  }

  let applied = 0;
  let changed = 0;
  let rejected = 0;
  for (const template of templates) {
    const { data, error } = await admin.rpc("apply_whatsapp_template_sync_item", {
      p_sync_run_id: run.sync_run_id,
      p_provider_template_id: template.providerTemplateId,
      p_name: template.name,
      p_language: template.language,
      p_raw_status: template.rawStatus ?? undefined,
      p_raw_category: template.rawCategory ?? undefined,
      p_raw_quality_rating: template.rawQualityRating ?? undefined,
      p_parameter_format: template.parameterFormat ?? undefined,
      p_components: template.components as unknown as Json,
      p_rejected_reason: template.rejectedReason ?? undefined,
    });
    if (error) {
      rejected += 1;
      continue;
    }
    applied += 1;
    if ((data as { changed?: unknown } | null)?.changed === true) changed += 1;
  }

  return {
    outcome: "synced",
    applied,
    changed,
    rejected: rejected + skipped,
    skipped,
    truncated,
    message:
      `${applied} template${applied === 1 ? "" : "s"} checked, ${changed} changed` +
      (rejected + skipped > 0 ? `, ${rejected + skipped} could not be read` : "") +
      (truncated ? ". The provider list was longer than one sync reads" : "") +
      ".",
  };
}

/**
 * Create a template on the WABA (Meta's create is submit-for-review). The
 * request is recorded BEFORE the provider call; a replayed key returns the
 * recorded outcome and never calls the provider again.
 */
export async function submitWhatsappTemplateToProvider(
  submission: WhatsappTemplateStudioSubmission,
  idempotencyKey: string,
  deps: WhatsappTemplateManagementDeps = {}
): Promise<WhatsappTemplateSubmitOutcome> {
  const env = readEnv(deps);
  if (!env) {
    return { outcome: "refused", code: "MISCONFIGURED", message: "Template management is not configured correctly in this environment." };
  }
  if (env.mode === "disabled" || !env.wabaId) {
    return { outcome: "disabled", message: "Template management is turned off in this environment. Nothing was submitted to WhatsApp." };
  }

  const session = await sessionClient(deps);
  if (!(await holdsManage(session))) {
    return { outcome: "refused", code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp templates." };
  }
  const admin = (deps.createAdminClient ?? adminClient)(env);

  const ensured = await admin.rpc("ensure_whatsapp_business_account", { p_waba_id: env.wabaId });
  if (ensured.error) {
    return { outcome: "refused", code: "RPC_FAILED", message: "The WhatsApp Business Account could not be registered." };
  }

  const recorded = await session.rpc("request_whatsapp_template_submission", {
    p_waba_id: env.wabaId,
    p_idempotency_key: idempotencyKey,
    p_name: submission.name,
    p_language: submission.language,
    p_category: submission.category,
    p_parameter_format: submission.parameterFormat,
    p_components: submission.components as unknown as Json,
  });
  if (recorded.error) {
    return { outcome: "refused", ...refusal(recorded.error.message) };
  }

  const request = recorded.data as { submission_id?: string; reused?: boolean; outcome?: string | null } | null;
  if (!request?.submission_id) {
    return { outcome: "refused", code: "RPC_FAILED", message: "The submission could not be recorded." };
  }
  if (request.reused) {
    return request.outcome === "submission_accepted"
      ? { outcome: "accepted", status: "recorded", message: "This template was already submitted." }
      : request.outcome === "submission_failed"
        ? { outcome: "failed", code: "ALREADY_FAILED", message: "This submission already failed. Start a new one." }
        : { outcome: "unresolved", message: "This submission has no confirmed outcome. Sync templates before trying again." };
  }

  const adapter = adapterFor(env, deps.createAdapter);
  const result = await adapter.createTemplate({
    wabaId: env.wabaId,
    name: submission.name,
    language: submission.language,
    category: submission.category,
    parameterFormat: submission.parameterFormat,
    components: submission.components,
  });

  if (result.kind === "success") {
    const { data, error } = await admin.rpc("record_whatsapp_template_submission_outcome", {
      p_submission_id: request.submission_id,
      p_outcome: "accepted",
      p_provider_template_id: result.providerTemplateId,
      p_raw_status: result.rawStatus ?? undefined,
      p_raw_category: result.rawCategory ?? undefined,
      p_http_status: result.httpStatus,
    });
    if (error) {
      await admin.rpc("record_whatsapp_template_submission_outcome", {
        p_submission_id: request.submission_id,
        p_outcome: "ambiguous",
        p_http_status: result.httpStatus,
        p_error_code: "local_record_failed",
      });
      return { outcome: "ambiguous", message: "WhatsApp accepted the template but ONEDECORE could not record it. Sync templates to reconcile." };
    }
    const status = String((data as { status?: unknown } | null)?.status ?? "unknown");
    return {
      outcome: "accepted",
      status,
      message: `Submitted to WhatsApp for review. Current status: ${status}. Approval is WhatsApp's decision.`,
    };
  }

  if (result.kind === "ambiguous") {
    await admin.rpc("record_whatsapp_template_submission_outcome", {
      p_submission_id: request.submission_id,
      p_outcome: "ambiguous",
      p_http_status: result.httpStatus ?? undefined,
      p_error_code: result.code.slice(0, 64),
    });
    return { outcome: "ambiguous", message: "WhatsApp's answer was unclear. Sync templates to see whether it was created; it will not be resubmitted automatically." };
  }

  await admin.rpc("record_whatsapp_template_submission_outcome", {
    p_submission_id: request.submission_id,
    p_outcome: "failed",
    p_http_status: result.httpStatus ?? undefined,
    p_error_code: result.code.slice(0, 64),
  });
  return { outcome: "failed", code: result.code.slice(0, 64), message: `WhatsApp rejected the template: ${result.message.slice(0, 200)}` };
}
