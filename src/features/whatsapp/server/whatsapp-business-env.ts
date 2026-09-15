import "server-only";

import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../../../config/server-env.ts";
import { META_WHATSAPP_GRAPH_API_VERSION_DEFAULT } from "../contracts/provider-dispatch.ts";
import type { WhatsappTemplateManagementMode } from "../contracts/template-studio.ts";

/**
 * WM-2 — server-only environment for the two WhatsApp Business Management
 * surfaces that are NOT message sending:
 *
 *   ONEDECORE_WHATSAPP_TEMPLATE_MODE   Template Studio sync/create/refresh
 *   ONEDECORE_WHATSAPP_MEDIA_MODE      inbound media view (and the outbound upload contract)
 *   ONEDECORE_WHATSAPP_FLOW_MODE       WM-6 official Flows create/update/publish/deprecate/sync
 *
 * Both default to `disabled` and fail closed on anything unrecognised, exactly
 * like `ONEDECORE_WHATSAPP_OUTBOUND_MODE`. Template SENDS are messages and stay
 * under the outbound mode.
 *
 * `local-test` binds to a loopback Supabase stack and a fake provider that
 * never approves anything and never fabricates media. `enabled` requires the
 * managed ONEDECORE project, the Graph credential and, for templates, the WABA
 * id. No value is logged and nothing here is importable from a client.
 */

export type WhatsappBusinessMode = WhatsappTemplateManagementMode;

export interface WhatsappBusinessServerEnv {
  readonly mode: WhatsappBusinessMode;
  readonly providerCode: "fake" | "meta";
  readonly supabaseUrl: string | null;
  readonly serviceRoleKey: string | null;
  readonly graphApiVersion: string;
  readonly accessToken: string | null;
  /** The WhatsApp Business Account id (templates only). */
  readonly wabaId: string | null;
}

type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

const MODES = new Set<WhatsappBusinessMode>(["disabled", "local-test", "enabled"]);

function readOptional(env: EnvSource, name: string): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE WhatsApp Business Env] ${code}`);
}

function modeFrom(raw: string | null, env: EnvSource): WhatsappBusinessMode {
  const value = (raw ?? "disabled") as WhatsappBusinessMode;
  if (!MODES.has(value)) return "disabled";
  if (value === "local-test" && env.NODE_ENV === "production") return "disabled";
  return value;
}

export function getWhatsappTemplateManagementMode(env: EnvSource = process.env): WhatsappBusinessMode {
  return modeFrom(readOptional(env, "ONEDECORE_WHATSAPP_TEMPLATE_MODE"), env);
}

export function getWhatsappFlowManagementMode(env: EnvSource = process.env): WhatsappBusinessMode {
  return modeFrom(readOptional(env, "ONEDECORE_WHATSAPP_FLOW_MODE"), env);
}

export function getWhatsappMediaMode(env: EnvSource = process.env): WhatsappBusinessMode {
  return modeFrom(readOptional(env, "ONEDECORE_WHATSAPP_MEDIA_MODE"), env);
}

/** A Graph API version shaped like `v22.0`; anything else falls back to the reviewed default. */
export function resolveMetaGraphApiVersion(env: EnvSource = process.env): string {
  const configured = readOptional(env, "META_WHATSAPP_GRAPH_API_VERSION");
  return configured && /^v\d{1,3}\.\d{1,2}$/.test(configured)
    ? configured
    : META_WHATSAPP_GRAPH_API_VERSION_DEFAULT;
}

function resolveServerEnv(
  mode: WhatsappBusinessMode,
  env: EnvSource,
  requireWaba: boolean
): WhatsappBusinessServerEnv {
  const graphApiVersion = resolveMetaGraphApiVersion(env);
  if (mode === "disabled") {
    return {
      mode,
      providerCode: "fake",
      supabaseUrl: null,
      serviceRoleKey: null,
      graphApiVersion,
      accessToken: null,
      wabaId: null,
    };
  }

  const supabaseUrl = readOptional(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) throw safeEnvError("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (mode === "local-test" && !isLoopbackSupabaseUrl(supabaseUrl)) {
    throw safeEnvError("local-test requires a loopback Supabase URL.");
  }
  if (mode === "enabled" && !isManagedOneDecoreSupabaseUrl(supabaseUrl)) {
    throw safeEnvError("enabled mode requires the managed ONEDECORE Supabase HTTPS project URL.");
  }

  const serviceRoleKey = readOptional(env, "SUPABASE_SERVICE_ROLE_KEY");
  const publishable = readOptional(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!serviceRoleKey) throw safeEnvError("SUPABASE_SERVICE_ROLE_KEY is required for this mode.");
  if (serviceRoleKey.startsWith("sb_publishable_") || (publishable != null && serviceRoleKey === publishable)) {
    throw safeEnvError("Publishable/public key rejected in SUPABASE_SERVICE_ROLE_KEY slot.");
  }

  const accessToken = readOptional(env, "META_WHATSAPP_ACCESS_TOKEN");
  const wabaId = readOptional(env, "META_WHATSAPP_BUSINESS_ACCOUNT_ID");

  if (requireWaba && (!wabaId || !/^[0-9]{1,64}$/.test(wabaId))) {
    throw safeEnvError("META_WHATSAPP_BUSINESS_ACCOUNT_ID is required for this mode.");
  }
  if (mode === "enabled" && (!accessToken || accessToken.length < 16)) {
    throw safeEnvError("META_WHATSAPP_ACCESS_TOKEN is required for enabled mode.");
  }

  return {
    mode,
    providerCode: mode === "local-test" ? "fake" : "meta",
    supabaseUrl,
    serviceRoleKey,
    graphApiVersion,
    accessToken: mode === "enabled" ? accessToken : null,
    wabaId: requireWaba ? wabaId : null,
  };
}

export function getWhatsappTemplateManagementServerEnv(env: EnvSource = process.env): WhatsappBusinessServerEnv {
  const raw = readOptional(env, "ONEDECORE_WHATSAPP_TEMPLATE_MODE") ?? "disabled";
  if (!MODES.has(raw as WhatsappBusinessMode)) {
    throw safeEnvError("Invalid ONEDECORE_WHATSAPP_TEMPLATE_MODE.");
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }
  return resolveServerEnv(raw as WhatsappBusinessMode, env, true);
}

export function getWhatsappMediaServerEnv(env: EnvSource = process.env): WhatsappBusinessServerEnv {
  const raw = readOptional(env, "ONEDECORE_WHATSAPP_MEDIA_MODE") ?? "disabled";
  if (!MODES.has(raw as WhatsappBusinessMode)) {
    throw safeEnvError("Invalid ONEDECORE_WHATSAPP_MEDIA_MODE.");
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }
  return resolveServerEnv(raw as WhatsappBusinessMode, env, false);
}

export function getWhatsappFlowManagementServerEnv(env: EnvSource = process.env): WhatsappBusinessServerEnv {
  const raw = readOptional(env, "ONEDECORE_WHATSAPP_FLOW_MODE") ?? "disabled";
  if (!MODES.has(raw as WhatsappBusinessMode)) {
    throw safeEnvError("Invalid ONEDECORE_WHATSAPP_FLOW_MODE.");
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }
  return resolveServerEnv(raw as WhatsappBusinessMode, env, true);
}
