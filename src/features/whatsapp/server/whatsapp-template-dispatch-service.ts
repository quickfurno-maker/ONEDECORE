import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  WhatsappTemplateClaimRow,
  WhatsappTemplateDispatchServiceResult,
} from "../contracts/template-studio.ts";
import { createFakeWhatsappTemplateMessageAdapter } from "./whatsapp-fake-template-adapters.ts";
import { createMetaWhatsappTemplateMessageAdapter } from "./whatsapp-meta-provider-adapter.ts";
import {
  getWhatsappOutboundServerEnv,
  type WhatsappOutboundServerEnv,
} from "./whatsapp-outbound-env.ts";
import type { WhatsappTemplateMessageAdapter } from "./whatsapp-template-provider-adapter.ts";

/**
 * WM-2 — dispatch ONE governed UTILITY template send intent.
 *
 *   claim     service RPC re-proves the whole send gate for the requester and
 *             creates the single provider attempt (or refuses, with evidence)
 *   send      official Cloud API `type: "template"`, parameters from SQL
 *   complete  success binds the canonical outbound message; failed ends the
 *             intent; ambiguous parks it for reconciliation
 *
 * IDEMPOTENCY AND AMBIGUITY
 *
 * The provider attempt key is derived from the intent, and the database holds
 * one attempt per intent. A second call for the same intent never reaches the
 * provider: an in-flight claim answers `in_flight`, an unclear result answers
 * `needs_reconcile`. If Meta accepted the message but binding it locally fails,
 * the attempt is recorded ambiguous rather than failed, so nobody resends a
 * message the customer may already have.
 */

export type WhatsappTemplateDispatchDeps = {
  readonly getEnv?: () => WhatsappOutboundServerEnv;
  readonly createAdminClient?: (env: WhatsappOutboundServerEnv) => TemplateDispatchAdminClient;
  readonly createAdapter?: (env: WhatsappOutboundServerEnv) => WhatsappTemplateMessageAdapter;
};

export type TemplateDispatchAdminClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function createAdminClient(env: WhatsappOutboundServerEnv): TemplateDispatchAdminClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE WhatsApp Template Dispatch] Admin client unavailable.");
  }
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as TemplateDispatchAdminClient;
}

function resolveAdapter(
  env: WhatsappOutboundServerEnv,
  factory: WhatsappTemplateDispatchDeps["createAdapter"]
): WhatsappTemplateMessageAdapter {
  if (factory) return factory(env);
  return env.providerCode === "fake"
    ? createFakeWhatsappTemplateMessageAdapter()
    : createMetaWhatsappTemplateMessageAdapter(env);
}

/** Only these keys from a provider response are kept, and only as scalars. */
function boundedSnapshot(snapshot: Record<string, unknown>): Json {
  const out: Record<string, string | number | null> = {};
  for (const key of ["provider", "httpStatus", "errorType", "errorCode", "type", "messaging_product"]) {
    const value = snapshot[key];
    if (typeof value === "number" || value === null) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 64);
  }
  return out;
}

function firstClaimRow(data: unknown): WhatsappTemplateClaimRow | null {
  return Array.isArray(data) && data.length > 0 ? (data[0] as WhatsappTemplateClaimRow) : null;
}

export async function dispatchWhatsappTemplateSendIntent(
  intentId: string,
  deps: WhatsappTemplateDispatchDeps = {}
): Promise<WhatsappTemplateDispatchServiceResult> {
  const env = (deps.getEnv ?? getWhatsappOutboundServerEnv)();
  if (env.mode === "disabled") {
    return {
      outcome: "disabled",
      intentId,
      message: "Template recorded. Outbound WhatsApp is turned off in this environment, so nothing was sent.",
    };
  }

  const admin = (deps.createAdminClient ?? createAdminClient)(env);
  const adapter = resolveAdapter(env, deps.createAdapter);
  const providerAttemptKey = `${intentId}:${adapter.providerCode}`;

  const { data: claimData, error: claimError } = await admin.rpc("claim_whatsapp_template_send_intent", {
    p_intent_id: intentId,
    p_provider_code: adapter.providerCode,
    p_provider_attempt_key: providerAttemptKey,
  });
  if (claimError) {
    return { outcome: "failed", intentId, reason: "claim_failed", message: "The template send could not be claimed." };
  }

  const claim = firstClaimRow(claimData);
  if (!claim) {
    return { outcome: "failed", intentId, reason: "claim_empty", message: "The template send could not be claimed." };
  }

  switch (claim.outcome_code) {
    case "claimed":
      break;
    case "already_bound":
      return { outcome: "already_bound", intentId, message: "This template was already sent." };
    case "in_flight":
      return { outcome: "in_flight", intentId, message: "This template send is already in progress." };
    case "needs_reconcile":
      return {
        outcome: "needs_reconcile",
        intentId,
        message: "WhatsApp's answer to this send was unclear. It will not be resent automatically.",
      };
    case "not_claimable":
    case "not_found":
      return { outcome: "not_claimable", intentId, reason: claim.outcome_code, message: "This template send is closed." };
    default:
      return { outcome: "ineligible", intentId, reason: claim.outcome_code, message: "The template send was refused at send time." };
  }

  if (
    !claim.dispatch_attempt_id ||
    !claim.phone_number_id ||
    !claim.customer_e164 ||
    !claim.template_name ||
    !claim.template_language ||
    !Array.isArray(claim.send_components)
  ) {
    // The attempt exists; recording it failed keeps the intent out of any retry.
    if (claim.dispatch_attempt_id) {
      await admin.rpc("complete_whatsapp_template_send_intent", {
        p_dispatch_attempt_id: claim.dispatch_attempt_id,
        p_outcome: "failed",
        p_error_class: "terminal",
        p_error_code: "claim_fields_missing",
        p_response_snapshot: {},
      });
    }
    return { outcome: "failed", intentId, reason: "claim_fields_missing", message: "The template send could not be prepared." };
  }

  const result = await adapter.dispatchTemplateMessage({
    phoneNumberId: claim.phone_number_id,
    customerE164: claim.customer_e164,
    templateName: claim.template_name,
    templateLanguage: claim.template_language,
    components: claim.send_components,
    providerAttemptKey,
  });

  if (result.kind === "success") {
    const { error: bindError } = await admin.rpc("complete_whatsapp_template_send_intent", {
      p_dispatch_attempt_id: claim.dispatch_attempt_id,
      p_outcome: "success",
      p_provider_message_id: result.providerMessageId,
      p_provider_timestamp: result.providerTimestamp,
      p_http_status: result.httpStatus,
      p_response_snapshot: boundedSnapshot(result.responseSnapshot),
    });

    if (bindError) {
      const { data: parked } = await admin.rpc("complete_whatsapp_template_send_intent", {
        p_dispatch_attempt_id: claim.dispatch_attempt_id,
        p_outcome: "ambiguous",
        p_error_class: "ambiguous",
        p_error_code: "local_bind_failed",
        p_http_status: result.httpStatus,
        p_response_snapshot: boundedSnapshot(result.responseSnapshot),
      });
      // The bind call may have committed before its reply was lost.
      if (typeof parked === "object" && parked !== null && (parked as { outcome?: unknown }).outcome === "already_bound") {
        return {
          outcome: "bound",
          intentId,
          providerMessageId: result.providerMessageId,
          message: "Template handed to WhatsApp. Delivery status follows WhatsApp's own reports.",
        };
      }
      return {
        outcome: "ambiguous",
        intentId,
        reason: "local_bind_failed",
        message: "WhatsApp accepted the template but ONEDECORE could not record it. It needs reconciliation and will not be resent.",
      };
    }

    return {
      outcome: "bound",
      intentId,
      providerMessageId: result.providerMessageId,
      message: "Template handed to WhatsApp. Delivery status follows WhatsApp's own reports.",
    };
  }

  if (result.kind === "ambiguous") {
    await admin.rpc("complete_whatsapp_template_send_intent", {
      p_dispatch_attempt_id: claim.dispatch_attempt_id,
      p_outcome: "ambiguous",
      p_error_class: "ambiguous",
      p_error_code: result.code.slice(0, 64),
      p_http_status: result.httpStatus ?? undefined,
      p_response_snapshot: boundedSnapshot(result.responseSnapshot),
    });
    return {
      outcome: "ambiguous",
      intentId,
      reason: result.code.slice(0, 64),
      message: "WhatsApp's answer was unclear. The send is held for reconciliation and will not be resent automatically.",
    };
  }

  await admin.rpc("complete_whatsapp_template_send_intent", {
    p_dispatch_attempt_id: claim.dispatch_attempt_id,
    p_outcome: "failed",
    p_error_class: result.errorClass,
    p_error_code: result.code.slice(0, 64),
    p_http_status: result.httpStatus ?? undefined,
    p_response_snapshot: boundedSnapshot(result.responseSnapshot),
  });
  return {
    outcome: "failed",
    intentId,
    reason: result.code.slice(0, 64),
    message: "WhatsApp rejected the template send.",
  };
}
