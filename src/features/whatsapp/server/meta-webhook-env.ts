import "server-only";

import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../../../config/server-env.ts";

export type MetaWebhookMode = "disabled" | "local-test" | "enabled";

export interface MetaWebhookServerEnv {
  readonly mode: MetaWebhookMode;
  readonly supabaseUrl: string | null;
  readonly serviceRoleKey: string | null;
  readonly verifyToken: string | null;
  readonly appSecret: string | null;
}

const MODE_VALUES = new Set<MetaWebhookMode>([
  "disabled",
  "local-test",
  "enabled",
]);

const MANAGED_HOST = "lpurlfmpvriyvpkujvyl.supabase.co";

function readOptional(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  name: string
): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE WhatsApp Webhook Env] ${code}`);
}

function looksLikePublishableKey(key: string): boolean {
  return key.startsWith("sb_publishable_");
}

export function getMetaWebhookMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): MetaWebhookMode {
  const raw = (env.ONEDECORE_WHATSAPP_WEBHOOK_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(raw as MetaWebhookMode)) {
    return "disabled";
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    return "disabled";
  }
  return raw as MetaWebhookMode;
}

/**
 * Server-only Meta WhatsApp webhook environment.
 * Never logs secret values. Defaults to disabled.
 */
export function getMetaWebhookServerEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): MetaWebhookServerEnv {
  const rawMode = (env.ONEDECORE_WHATSAPP_WEBHOOK_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(rawMode as MetaWebhookMode)) {
    throw safeEnvError("Invalid ONEDECORE_WHATSAPP_WEBHOOK_MODE.");
  }
  const mode = rawMode as MetaWebhookMode;

  if (mode === "disabled") {
    return {
      mode,
      supabaseUrl: null,
      serviceRoleKey: null,
      verifyToken: null,
      appSecret: null,
    };
  }

  if (mode === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }

  const supabaseUrl = readOptional(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    throw safeEnvError("Missing NEXT_PUBLIC_SUPABASE_URL for webhook admin client.");
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
  const verifyToken = readOptional(env, "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  const appSecret = readOptional(env, "META_WHATSAPP_APP_SECRET");
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

  if (mode === "enabled") {
    if (!verifyToken || verifyToken.length < 8 || verifyToken.length > 256) {
      throw safeEnvError("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is required for enabled mode.");
    }
    if (!appSecret || appSecret.length < 16 || appSecret.length > 256) {
      throw safeEnvError("META_WHATSAPP_APP_SECRET is required for enabled mode.");
    }
  }

  return {
    mode,
    supabaseUrl,
    serviceRoleKey,
    verifyToken,
    appSecret,
  };
}

export { isLoopbackSupabaseUrl, isManagedOneDecoreSupabaseUrl, MANAGED_HOST };
