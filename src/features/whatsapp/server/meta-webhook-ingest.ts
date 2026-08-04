import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  getMetaWebhookMode,
  getMetaWebhookServerEnv,
  type MetaWebhookServerEnv,
} from "./meta-webhook-env.ts";
import {
  computeEnvelopeHash,
  verifyMetaWebhookSignature,
} from "./meta-webhook-signature.ts";
import {
  META_WEBHOOK_OBJECT,
  normalizeMetaWebhookPayload,
  resolveBusinessRecipientE164,
  type NormalizedInboundMessage,
  type NormalizedMessageStatus,
  type NormalizedWebhookEvent,
} from "./meta-webhook-contract.ts";
import { parseLocalTestHostname } from "../../lead-intake/server/lead-intake-runtime.ts";

export class MetaWebhookError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly correlationId: string;

  constructor(params: {
    code: string;
    message: string;
    httpStatus: number;
    correlationId?: string;
  }) {
    super(params.message);
    this.name = "MetaWebhookError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.correlationId = params.correlationId ?? crypto.randomUUID();
  }
}

export interface MetaWebhookGetRequest {
  readonly mode: string;
  readonly verifyToken: string | null;
  readonly hubMode: string | null;
  readonly hubVerifyToken: string | null;
  readonly hubChallenge: string | null;
}

export interface MetaWebhookPostRequest {
  readonly contentType: string | null;
  readonly signatureHeader: string | null;
  readonly rawBody: Uint8Array;
  readonly host: string | null;
  readonly nodeEnv: string | undefined;
}

export interface MetaWebhookHandlerResult {
  readonly httpStatus: number;
  readonly body: string;
  readonly contentType: string;
  readonly correlationId: string;
  readonly outcome: string;
  readonly eventCount: number;
}

export interface MetaWebhookRuntimeDeps {
  readonly getEnv?: typeof getMetaWebhookServerEnv;
  readonly getMode?: typeof getMetaWebhookMode;
  readonly createAdminClient?: (env: MetaWebhookServerEnv) => ReturnType<typeof createWebhookAdminClient>;
}

function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function createWebhookAdminClient(env: MetaWebhookServerEnv) {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new MetaWebhookError({
      code: "WEBHOOK_UNAVAILABLE",
      message: "Webhook persistence unavailable.",
      httpStatus: 500,
    });
  }
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type WebhookRpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

function isLocalTestHost(host: string | null): boolean {
  const hostname = parseLocalTestHostname(host);
  if (!hostname) return false;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export function assertMetaWebhookPostActive(
  env: MetaWebhookServerEnv,
  host: string | null,
  nodeEnv: string | undefined
): void {
  if (env.mode === "disabled") {
    throw new MetaWebhookError({
      code: "WEBHOOK_DISABLED",
      message: "WhatsApp webhook is disabled.",
      httpStatus: 503,
    });
  }
  if (env.mode === "local-test") {
    if (nodeEnv === "production") {
      throw new MetaWebhookError({
        code: "WEBHOOK_DISABLED",
        message: "WhatsApp webhook is disabled.",
        httpStatus: 503,
      });
    }
    if (!isLocalTestHost(host)) {
      throw new MetaWebhookError({
        code: "LOCAL_TEST_HOST_REQUIRED",
        message: "local-test mode is limited to localhost.",
        httpStatus: 403,
      });
    }
  }
}

export function validateMetaWebhookJsonContentType(
  contentType: string | null
): void {
  if (!(contentType ?? "").toLowerCase().startsWith("application/json")) {
    throw new MetaWebhookError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "application/json required.",
      httpStatus: 400,
    });
  }
}

function assertWebhookActive(
  env: MetaWebhookServerEnv,
  host: string | null,
  nodeEnv: string | undefined
): void {
  assertMetaWebhookPostActive(env, host, nodeEnv);
}

function resolveAppSecret(env: MetaWebhookServerEnv): string {
  if (env.mode === "local-test") {
    return env.appSecret ?? "local-test-meta-app-secret-32chars";
  }
  if (!env.appSecret) {
    throw new MetaWebhookError({
      code: "WEBHOOK_MISCONFIGURED",
      message: "Webhook is misconfigured.",
      httpStatus: 500,
    });
  }
  return env.appSecret;
}

function resolveVerifyToken(env: MetaWebhookServerEnv): string {
  if (env.mode === "local-test") {
    return env.verifyToken ?? "local-test-verify-token";
  }
  if (!env.verifyToken) {
    throw new MetaWebhookError({
      code: "WEBHOOK_MISCONFIGURED",
      message: "Webhook is misconfigured.",
      httpStatus: 500,
    });
  }
  return env.verifyToken;
}

export function handleMetaWebhookVerification(
  request: MetaWebhookGetRequest & { readonly host?: string | null },
  deps: MetaWebhookRuntimeDeps = {}
): MetaWebhookHandlerResult {
  const correlationId = newCorrelationId();
  const getMode = deps.getMode ?? getMetaWebhookMode;
  const getEnv = deps.getEnv ?? getMetaWebhookServerEnv;

  const mode = getMode();
  if (mode === "disabled") {
    throw new MetaWebhookError({
      code: "WEBHOOK_DISABLED",
      message: "WhatsApp webhook is disabled.",
      httpStatus: 503,
      correlationId,
    });
  }

  const env = getEnv();
  assertWebhookActive(env, request.host ?? "localhost", process.env.NODE_ENV);

  if (request.hubMode !== "subscribe") {
    throw new MetaWebhookError({
      code: "VERIFY_MALFORMED",
      message: "Malformed verification request.",
      httpStatus: 400,
      correlationId,
    });
  }

  if (
    !request.hubChallenge ||
    request.hubChallenge.length < 1 ||
    request.hubChallenge.length > 256 ||
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(request.hubChallenge)
  ) {
    throw new MetaWebhookError({
      code: "VERIFY_MALFORMED",
      message: "Malformed verification request.",
      httpStatus: 400,
      correlationId,
    });
  }

  const expectedToken = resolveVerifyToken(env);
  if (!request.hubVerifyToken || request.hubVerifyToken !== expectedToken) {
    throw new MetaWebhookError({
      code: "VERIFY_FORBIDDEN",
      message: "Verification token rejected.",
      httpStatus: 403,
      correlationId,
    });
  }

  return {
    httpStatus: 200,
    body: request.hubChallenge,
    contentType: "text/plain; charset=utf-8",
    correlationId,
    outcome: "verified",
    eventCount: 0,
  };
}

async function persistInboundMessage(
  client: ReturnType<typeof createWebhookAdminClient>,
  event: NormalizedInboundMessage,
  envelopeHash: string
): Promise<string> {
  const recipientE164 = resolveBusinessRecipientE164(
    event.displayPhoneNumber,
    event.phoneNumberId
  );
  if (!recipientE164) {
    throw new MetaWebhookError({
      code: "NORMALIZATION_FAILED",
      message: "Unable to normalize webhook event.",
      httpStatus: 400,
    });
  }

  const { data, error } = await (client as unknown as WebhookRpcClient).rpc(
    "ingest_meta_whatsapp_message",
    {
      p_event_key: event.eventKey,
      p_event_hash: event.eventHash,
      p_envelope_hash: envelopeHash,
      p_waba_id: event.wabaId,
      p_phone_number_id: event.phoneNumberId,
      p_display_phone_number: event.displayPhoneNumber,
      p_provider_message_id: event.providerMessageId,
      p_customer_e164: event.customerE164,
      p_recipient_e164: recipientE164,
      p_display_name_snapshot: event.displayNameSnapshot,
      p_provider_message_type: event.providerMessageType,
      p_normalized_message_type: event.normalizedMessageType,
      p_body_text: event.bodyText,
      p_content: event.content,
      p_context_provider_message_id: event.contextProviderMessageId,
      p_provider_timestamp: event.providerTimestamp,
    }
  );

  if (error) {
    if (error.code === "23505") {
      throw new MetaWebhookError({
        code: "WEBHOOK_CONFLICT",
        message: "Webhook event conflict.",
        httpStatus: 409,
      });
    }
    throw new MetaWebhookError({
      code: "WEBHOOK_PERSISTENCE_FAILED",
      message: "Webhook persistence failed.",
      httpStatus: 500,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as { outcome_code?: string } | null)?.outcome_code ?? "persisted";
}

async function persistMessageStatus(
  client: ReturnType<typeof createWebhookAdminClient>,
  event: NormalizedMessageStatus,
  envelopeHash: string
): Promise<string> {
  const { data, error } = await (client as unknown as WebhookRpcClient).rpc(
    "ingest_meta_whatsapp_status",
    {
      p_event_key: event.eventKey,
      p_event_hash: event.eventHash,
      p_envelope_hash: envelopeHash,
      p_waba_id: event.wabaId,
      p_phone_number_id: event.phoneNumberId,
      p_display_phone_number: event.displayPhoneNumber,
      p_provider_message_id: event.providerMessageId,
      p_status: event.status,
      p_provider_timestamp: event.providerTimestamp,
      p_details: event.details,
    }
  );

  if (error) {
    if (error.code === "23505") {
      throw new MetaWebhookError({
        code: "WEBHOOK_CONFLICT",
        message: "Webhook event conflict.",
        httpStatus: 409,
      });
    }
    throw new MetaWebhookError({
      code: "WEBHOOK_PERSISTENCE_FAILED",
      message: "Webhook persistence failed.",
      httpStatus: 500,
    });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as { outcome_code?: string } | null)?.outcome_code ?? "persisted";
}

async function persistEvent(
  client: ReturnType<typeof createWebhookAdminClient>,
  event: NormalizedWebhookEvent,
  envelopeHash: string
): Promise<string> {
  if (event.kind === "inbound_message") {
    return persistInboundMessage(client, event, envelopeHash);
  }
  return persistMessageStatus(client, event, envelopeHash);
}

export interface MetaWebhookSignedBodyRequest {
  readonly env: MetaWebhookServerEnv;
  readonly signatureHeader: string | null;
  readonly rawBody: Uint8Array;
  readonly host: string | null;
  readonly nodeEnv: string | undefined;
}

export async function handleMetaWebhookSignedBody(
  request: MetaWebhookSignedBodyRequest,
  deps: MetaWebhookRuntimeDeps = {}
): Promise<MetaWebhookHandlerResult> {
  const correlationId = newCorrelationId();
  const createAdmin = deps.createAdminClient ?? createWebhookAdminClient;
  const env = request.env;

  const appSecret = resolveAppSecret(env);
  const signature = verifyMetaWebhookSignature(
    request.rawBody,
    request.signatureHeader,
    appSecret
  );
  if (!signature.ok) {
    throw new MetaWebhookError({
      code: "SIGNATURE_INVALID",
      message: "Webhook signature invalid.",
      httpStatus: 401,
      correlationId,
    });
  }

  const envelopeHash = computeEnvelopeHash(request.rawBody);
  let payload: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(request.rawBody);
    payload = JSON.parse(text);
  } catch {
    throw new MetaWebhookError({
      code: "JSON_INVALID",
      message: "Malformed JSON payload.",
      httpStatus: 400,
      correlationId,
    });
  }

  const normalized = normalizeMetaWebhookPayload(payload);
  if (normalized.ignored) {
    return {
      httpStatus: 200,
      body: JSON.stringify({ ok: true, outcome: "ignored" }),
      contentType: "application/json; charset=utf-8",
      correlationId,
      outcome: "ignored",
      eventCount: 0,
    };
  }

  if (normalized.events.length === 0) {
    return {
      httpStatus: 200,
      body: JSON.stringify({ ok: true, outcome: "ignored" }),
      contentType: "application/json; charset=utf-8",
      correlationId,
      outcome: "ignored",
      eventCount: 0,
    };
  }

  const client = createAdmin(env);
  let lastOutcome = "persisted";
  for (const event of normalized.events) {
    lastOutcome = await persistEvent(client, event, envelopeHash);
  }

  return {
    httpStatus: 200,
    body: JSON.stringify({
      ok: true,
      outcome: lastOutcome,
      object: META_WEBHOOK_OBJECT,
    }),
    contentType: "application/json; charset=utf-8",
    correlationId,
    outcome: lastOutcome,
    eventCount: normalized.events.length,
  };
}

export async function handleMetaWebhookPost(
  request: MetaWebhookPostRequest,
  deps: MetaWebhookRuntimeDeps = {}
): Promise<MetaWebhookHandlerResult> {
  const getEnv = deps.getEnv ?? getMetaWebhookServerEnv;
  const env = getEnv();
  assertWebhookActive(env, request.host, request.nodeEnv);
  validateMetaWebhookJsonContentType(request.contentType);

  return handleMetaWebhookSignedBody(
    {
      env,
      signatureHeader: request.signatureHeader,
      rawBody: request.rawBody,
      host: request.host,
      nodeEnv: request.nodeEnv,
    },
    deps
  );
}

export function safeMetaWebhookLog(input: {
  correlationId: string;
  outcome: string;
  durationMs: number;
  mode: string;
  eventCount: number;
}): Record<string, unknown> {
  return {
    correlationId: input.correlationId,
    outcome: input.outcome,
    durationMs: input.durationMs,
    mode: input.mode,
    eventCount: input.eventCount,
  };
}
