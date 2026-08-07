import "server-only";

import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../../../config/server-env.ts";
import {
  META_WHATSAPP_GRAPH_API_VERSION_DEFAULT,
  type WhatsappOutboundMode,
  type WhatsappProviderCode,
} from "../contracts/provider-dispatch.ts";

export interface WhatsappOutboundServerEnv {
  readonly mode: WhatsappOutboundMode;
  readonly providerCode: WhatsappProviderCode;
  readonly supabaseUrl: string | null;
  readonly serviceRoleKey: string | null;
  readonly graphApiVersion: string;
  readonly accessToken: string | null;
  readonly phoneNumberId: string | null;
}

const MODE_VALUES = new Set<WhatsappOutboundMode>([
  "disabled",
  "local-test",
  "enabled",
]);

function readOptional(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  name: string
): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE WhatsApp Outbound Env] ${code}`);
}

function looksLikePublishableKey(key: string): boolean {
  return key.startsWith("sb_publishable_");
}

export function getWhatsappOutboundMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): WhatsappOutboundMode {
  const raw = (env.ONEDECORE_WHATSAPP_OUTBOUND_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(raw as WhatsappOutboundMode)) {
    return "disabled";
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    return "disabled";
  }
  return raw as WhatsappOutboundMode;
}

export function resolveWhatsappProviderCode(
  mode: WhatsappOutboundMode
): WhatsappProviderCode {
  return mode === "local-test" ? "fake" : "meta";
}

/**
 * Server-only WhatsApp outbound dispatch environment.
 * Never logs secret values. Defaults to disabled.
 */
export function getWhatsappOutboundServerEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): WhatsappOutboundServerEnv {
  const rawMode = (env.ONEDECORE_WHATSAPP_OUTBOUND_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(rawMode as WhatsappOutboundMode)) {
    throw safeEnvError("Invalid ONEDECORE_WHATSAPP_OUTBOUND_MODE.");
  }
  const mode = rawMode as WhatsappOutboundMode;
  const graphApiVersion =
    readOptional(env, "META_WHATSAPP_GRAPH_API_VERSION") ??
    META_WHATSAPP_GRAPH_API_VERSION_DEFAULT;

  if (mode === "disabled") {
    return {
      mode,
      providerCode: "fake",
      supabaseUrl: null,
      serviceRoleKey: null,
      graphApiVersion,
      accessToken: null,
      phoneNumberId: null,
    };
  }

  if (mode === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }

  const supabaseUrl = readOptional(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    throw safeEnvError("Missing NEXT_PUBLIC_SUPABASE_URL for outbound admin client.");
  }

  if (mode === "local-test" && !isLoopbackSupabaseUrl(supabaseUrl)) {
    throw safeEnvError(
      "local-test requires a loopback Supabase URL (127.0.0.1, localhost, or ::1)."
    );
  }

  if (mode === "enabled" && !isManagedOneDecoreSupabaseUrl(supabaseUrl)) {
    throw safeEnvError(
      "enabled mode requires the managed ONEDECORE Supabase HTTPS project URL."
    );
  }

  const serviceRoleKey = readOptional(env, "SUPABASE_SERVICE_ROLE_KEY");
  const publishable = readOptional(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!serviceRoleKey) {
    throw safeEnvError("SUPABASE_SERVICE_ROLE_KEY is required for this mode.");
  }

  if (
    looksLikePublishableKey(serviceRoleKey) ||
    (publishable != null && serviceRoleKey === publishable)
  ) {
    throw safeEnvError(
      "Publishable/public key rejected in SUPABASE_SERVICE_ROLE_KEY slot."
    );
  }

  const accessToken = readOptional(env, "META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = readOptional(env, "META_WHATSAPP_PHONE_NUMBER_ID");

  if (mode === "enabled") {
    if (!accessToken || accessToken.length < 16) {
      throw safeEnvError("META_WHATSAPP_ACCESS_TOKEN is required for enabled mode.");
    }
    if (!phoneNumberId || !/^[0-9]+$/.test(phoneNumberId)) {
      throw safeEnvError("META_WHATSAPP_PHONE_NUMBER_ID is required for enabled mode.");
    }
  }

  return {
    mode,
    providerCode: resolveWhatsappProviderCode(mode),
    supabaseUrl,
    serviceRoleKey,
    graphApiVersion,
    accessToken: mode === "enabled" ? accessToken : null,
    phoneNumberId: mode === "enabled" ? phoneNumberId : null,
  };
}
