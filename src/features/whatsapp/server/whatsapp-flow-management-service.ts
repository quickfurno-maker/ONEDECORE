import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import {
  describeWhatsappFlowRpcError,
  parseWhatsappFlowProviderRequest,
  WHATSAPP_FLOW_RPC,
  WHATSAPP_FLOW_SERVICE_RPC,
  type WhatsappFlowProviderAction,
} from "../contracts/flows.ts";
import { getWhatsappFlowManagementServerEnv, type WhatsappBusinessServerEnv } from "./whatsapp-business-env.ts";
import {
  createFakeWhatsappFlowProviderAdapter,
  createMetaWhatsappFlowProviderAdapter,
  type WhatsappFlowProviderAdapter,
  type WhatsappFlowProviderResult,
} from "./whatsapp-flow-provider-adapter.ts";

/**
 * WM-6 — official Flow provider workflow.
 *
 *   the staff session   records the human decision (request_whatsapp_flow_provider_action,
 *                       actor = auth.uid(), whatsapp.flows.manage re-checked in SQL)
 *   the provider        answers (official Flows API)
 *   service_role        records the answer (record_whatsapp_flow_provider_outcome),
 *                       then observes the Flow's status with a read
 *
 * A manager can ask for a publish but cannot tell the database a Flow is
 * published: only Meta's response, relayed here, can.
 */

type RpcClient = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type WhatsappFlowManagementDeps = {
  readonly getEnv?: () => WhatsappBusinessServerEnv;
  readonly createSessionClient?: () => Promise<RpcClient>;
  readonly createAdminClient?: (env: WhatsappBusinessServerEnv) => RpcClient;
  readonly createAdapter?: (env: WhatsappBusinessServerEnv) => WhatsappFlowProviderAdapter;
};

export type WhatsappFlowProviderOutcome =
  | { readonly outcome: "disabled"; readonly message: string }
  | { readonly outcome: "refused"; readonly code: string; readonly message: string }
  | { readonly outcome: "accepted"; readonly status: string; readonly message: string }
  | { readonly outcome: "failed"; readonly code: string; readonly message: string }
  | { readonly outcome: "ambiguous"; readonly message: string };

const LOCAL_TEST_FLOW_STORE = new Map<string, { status: string }>();

function adminClient(env: WhatsappBusinessServerEnv): RpcClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new Error("[ONEDECORE WhatsApp Flows] Admin client unavailable.");
  return createSupabaseClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RpcClient;
}

function readEnv(deps: WhatsappFlowManagementDeps): WhatsappBusinessServerEnv | null {
  try {
    return (deps.getEnv ?? getWhatsappFlowManagementServerEnv)();
  } catch {
    return null;
  }
}

async function call(
  adapter: WhatsappFlowProviderAdapter,
  action: WhatsappFlowProviderAction,
  input: { readonly wabaId: string; readonly providerFlowId: string | null; readonly name: string; readonly categories: readonly string[]; readonly flowJson: unknown }
): Promise<WhatsappFlowProviderResult> {
  if (action === "create") {
    const created = await adapter.createFlow({ wabaId: input.wabaId, name: input.name, categories: input.categories });
    if (created.kind !== "success" || !created.providerFlowId || input.flowJson === null) return created;
    // Create and first JSON upload are one decision; a failed upload leaves a DRAFT Flow to fix and re-upload.
    const uploaded = await adapter.uploadFlowJson({ providerFlowId: created.providerFlowId, flowJson: input.flowJson });
    return uploaded.kind === "success"
      ? { ...created, validationErrors: uploaded.validationErrors ?? created.validationErrors }
      : { kind: "success", providerFlowId: created.providerFlowId, rawStatus: created.rawStatus, validationErrors: uploaded.kind === "failed" ? uploaded.validationErrors ?? [{ error: uploaded.code }] : [{ error: "upload_ambiguous" }] };
  }
  if (!input.providerFlowId) return { kind: "failed", code: "provider_flow_id_missing", message: "The Flow is not at Meta yet.", validationErrors: null };
  switch (action) {
    case "update_json":
      return adapter.uploadFlowJson({ providerFlowId: input.providerFlowId, flowJson: input.flowJson });
    case "publish":
      return adapter.publishFlow({ providerFlowId: input.providerFlowId });
    case "deprecate":
      return adapter.deprecateFlow({ providerFlowId: input.providerFlowId });
    default:
      return adapter.getFlow({ providerFlowId: input.providerFlowId });
  }
}

export async function performWhatsappFlowProviderAction(
  input: { readonly flowId: string; readonly action: WhatsappFlowProviderAction; readonly idempotencyKey: string },
  deps: WhatsappFlowManagementDeps = {}
): Promise<WhatsappFlowProviderOutcome> {
  const env = readEnv(deps);
  if (!env) return { outcome: "refused", code: "MISCONFIGURED", message: "WhatsApp Flows are not configured correctly in this environment." };
  if (env.mode === "disabled" || !env.wabaId) {
    return { outcome: "disabled", message: "WhatsApp Flows provider calls are turned off in this environment. Nothing was sent to Meta." };
  }

  const session = deps.createSessionClient ? await deps.createSessionClient() : ((await createSessionClient()) as unknown as RpcClient);
  const requested = await session.rpc(WHATSAPP_FLOW_RPC.requestProviderAction, {
    p_flow_id: input.flowId,
    p_action: input.action,
    p_idempotency_key: input.idempotencyKey,
  });
  if (requested.error) return { outcome: "refused", ...describeWhatsappFlowRpcError(requested.error) };
  const request = parseWhatsappFlowProviderRequest(requested.data);
  if (!request) return { outcome: "refused", code: "RPC_FAILED", message: "The Flow request could not be recorded." };
  if (request.reused) {
    return request.resolved
      ? { outcome: "accepted", status: "recorded", message: "This request was already answered by Meta." }
      : { outcome: "ambiguous", message: "This request has no recorded answer. Sync the Flow instead of repeating it." };
  }

  const admin = (deps.createAdminClient ?? adminClient)(env);
  const adapter = deps.createAdapter
    ? deps.createAdapter(env)
    : env.providerCode === "fake"
      ? createFakeWhatsappFlowProviderAdapter(LOCAL_TEST_FLOW_STORE)
      : createMetaWhatsappFlowProviderAdapter(env);

  const result = await call(adapter, request.action, {
    wabaId: env.wabaId,
    providerFlowId: request.providerFlowId,
    name: request.name,
    categories: request.categories,
    flowJson: request.flowJson,
  });

  if (result.kind === "ambiguous") {
    await admin.rpc(WHATSAPP_FLOW_SERVICE_RPC.recordOutcome, { p_request_id: request.requestId, p_outcome: "ambiguous", p_error_code: result.code.slice(0, 128) });
    return { outcome: "ambiguous", message: "Meta's answer was unclear. Sync the Flow to see what happened; the request is not repeated automatically." };
  }
  if (result.kind === "failed") {
    await admin.rpc(WHATSAPP_FLOW_SERVICE_RPC.recordOutcome, {
      p_request_id: request.requestId,
      p_outcome: "failed",
      p_error_code: result.code.slice(0, 128),
      ...(result.validationErrors ? { p_validation_errors: result.validationErrors as unknown as Json } : {}),
    });
    return { outcome: "failed", code: result.code.slice(0, 64), message: `Meta refused: ${result.message.slice(0, 200)}` };
  }

  // Observe the status Meta now reports; a publish response carries none of its own.
  const providerFlowId = result.providerFlowId ?? request.providerFlowId;
  let rawStatus = result.rawStatus;
  let validationErrors = result.validationErrors;
  if (providerFlowId && request.action !== "sync") {
    const observed = await adapter.getFlow({ providerFlowId });
    if (observed.kind === "success") {
      rawStatus = observed.rawStatus ?? rawStatus;
      validationErrors = request.action === "update_json" || request.action === "create" ? validationErrors ?? observed.validationErrors : observed.validationErrors;
    }
  }

  const recorded = await admin.rpc(WHATSAPP_FLOW_SERVICE_RPC.recordOutcome, {
    p_request_id: request.requestId,
    p_outcome: request.action === "sync" ? "observed" : "accepted",
    ...(providerFlowId ? { p_provider_flow_id: providerFlowId } : {}),
    ...(rawStatus ? { p_provider_status_raw: rawStatus } : {}),
    ...(validationErrors ? { p_validation_errors: validationErrors as unknown as Json } : {}),
  });
  if (recorded.error) {
    return { outcome: "ambiguous", message: "Meta answered but ONEDECORE could not record it. Sync the Flow to reconcile." };
  }
  const status = String((recorded.data as { provider_status?: unknown } | null)?.provider_status ?? "unknown");
  return { outcome: "accepted", status, message: `Meta reports this Flow as ${status}.` };
}
