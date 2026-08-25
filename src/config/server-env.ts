import "server-only";

import { getMissingLeadIntakeActivationFields } from "../features/legal/business-identity.ts";
import { LEAD_INTAKE_ACTIVATION } from "../features/legal/lead-intake-activation.ts";
import type { LeadIntakeActivationInput } from "../features/legal/business-identity.ts";

export type LeadIntakeMode = "disabled" | "local-test" | "enabled";

export interface LeadIntakeServerEnv {
  readonly mode: LeadIntakeMode;
  readonly supabaseUrl: string | null;
  readonly serviceRoleKey: string | null;
  readonly hashSecret: string | null;
  readonly trustProxy: boolean;
}

const MODE_VALUES = new Set<LeadIntakeMode>([
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

function looksLikePublishableKey(key: string): boolean {
  return key.startsWith("sb_publishable_");
}

function safeUrlError(code: string): Error {
  // Never include URL or key material in errors.
  return new Error(`[ONEDECORE Lead Env] ${code}`);
}

/**
 * True only for strict loopback Supabase URLs (local-test).
 * Requires http:, loopback host, explicit valid port, root path only.
 * Rejects remote/managed hosts, credentials, query, fragment, and ambiguous URLs.
 */
export function isLoopbackSupabaseUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.search) return false;
  if (parsed.hash) return false;
  const path = parsed.pathname === "/" ? "/" : parsed.pathname;
  if (path !== "/" && path !== "") return false;
  if (!parsed.port) return false;
  const portNum = Number(parsed.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/**
 * True only for the ONEDECORE managed Supabase project over HTTPS.
 */
export function isManagedOneDecoreSupabaseUrl(urlStr: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hash) return false;
  if (parsed.search) return false;
  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  if (path !== "" && path !== "/") return false;
  return parsed.hostname.toLowerCase() === MANAGED_HOST;
}

/**
 * Server-only lead-intake environment.
 * Never logs secret values. Defaults to disabled.
 */
export function getLeadIntakeServerEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  activation: LeadIntakeActivationInput = LEAD_INTAKE_ACTIVATION
): LeadIntakeServerEnv {
  const rawMode = (env.ONEDECORE_LEAD_INTAKE_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(rawMode as LeadIntakeMode)) {
    throw safeUrlError("Invalid ONEDECORE_LEAD_INTAKE_MODE.");
  }
  const mode = rawMode as LeadIntakeMode;
  const trustProxy = (env.ONEDECORE_TRUST_PROXY ?? "false").trim() === "true";

  if (mode === "disabled") {
    return {
      mode,
      supabaseUrl: null,
      serviceRoleKey: null,
      hashSecret: null,
      trustProxy,
    };
  }

  if (mode === "local-test" && env.NODE_ENV === "production") {
    throw safeUrlError("local-test mode is forbidden in production.");
  }

  if (mode === "enabled") {
    const missing = getMissingLeadIntakeActivationFields(activation);
    if (missing.length > 0) {
      throw safeUrlError(
        "enabled mode blocked until lead activation gate is complete."
      );
    }
    if (!trustProxy) {
      throw safeUrlError(
        "enabled mode requires ONEDECORE_TRUST_PROXY=true with documented reverse-proxy header overwrite."
      );
    }
  }

  const supabaseUrl = readOptional(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    throw safeUrlError("Missing NEXT_PUBLIC_SUPABASE_URL for server admin client.");
  }

  if (mode === "local-test" && !isLoopbackSupabaseUrl(supabaseUrl)) {
    throw safeUrlError(
      "local-test requires a loopback Supabase URL (127.0.0.1, localhost, or ::1)."
    );
  }

  if (mode === "enabled" && !isManagedOneDecoreSupabaseUrl(supabaseUrl)) {
    throw safeUrlError(
      "enabled mode requires the managed ONEDECORE Supabase HTTPS project URL."
    );
  }

  const serviceRoleKey = readOptional(env, "SUPABASE_SERVICE_ROLE_KEY");
  const hashSecret = readOptional(env, "ONEDECORE_LEAD_HASH_SECRET");
  const publishable = readOptional(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!serviceRoleKey) {
    throw safeUrlError("SUPABASE_SERVICE_ROLE_KEY is required for this mode.");
  }
  if (
    looksLikePublishableKey(serviceRoleKey) ||
    (publishable != null && serviceRoleKey === publishable)
  ) {
    throw safeUrlError(
      "Publishable/public key rejected in SUPABASE_SERVICE_ROLE_KEY slot."
    );
  }
  if (!hashSecret || hashSecret.length < 32) {
    throw safeUrlError(
      "ONEDECORE_LEAD_HASH_SECRET must be at least 32 characters."
    );
  }

  return {
    mode,
    supabaseUrl,
    serviceRoleKey,
    hashSecret,
    trustProxy,
  };
}

export function getLeadIntakeMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): LeadIntakeMode {
  const raw = (env.ONEDECORE_LEAD_INTAKE_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(raw as LeadIntakeMode)) {
    return "disabled";
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    return "disabled";
  }
  return raw as LeadIntakeMode;
}
