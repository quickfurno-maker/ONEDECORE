import "server-only";

import { getMissingLeadIntakeActivationFields } from "../features/legal/business-identity.ts";

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

/**
 * Server-only lead-intake environment.
 * Never logs secret values. Defaults to disabled.
 */
export function getLeadIntakeServerEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): LeadIntakeServerEnv {
  const rawMode = (env.ONEDECORE_LEAD_INTAKE_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(rawMode as LeadIntakeMode)) {
    throw new Error("[ONEDECORE Lead Env] Invalid ONEDECORE_LEAD_INTAKE_MODE.");
  }
  const mode = rawMode as LeadIntakeMode;
  const trustProxy = (env.ONEDECORE_TRUST_PROXY ?? "false").trim() === "true";

  if (mode === "disabled") {
    return {
      mode,
      supabaseUrl: readOptional(env, "NEXT_PUBLIC_SUPABASE_URL"),
      serviceRoleKey: null,
      hashSecret: null,
      trustProxy,
    };
  }

  if (mode === "local-test" && env.NODE_ENV === "production") {
    throw new Error(
      "[ONEDECORE Lead Env] local-test mode is forbidden in production."
    );
  }

  if (mode === "enabled") {
    const missing = getMissingLeadIntakeActivationFields();
    if (missing.length > 0) {
      throw new Error(
        "[ONEDECORE Lead Env] enabled mode blocked until lead activation gate is complete."
      );
    }
    if (!trustProxy) {
      throw new Error(
        "[ONEDECORE Lead Env] enabled mode requires ONEDECORE_TRUST_PROXY=true with documented reverse-proxy header overwrite."
      );
    }
  }

  const supabaseUrl = readOptional(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error(
      "[ONEDECORE Lead Env] Missing NEXT_PUBLIC_SUPABASE_URL for server admin client."
    );
  }

  const serviceRoleKey = readOptional(env, "SUPABASE_SERVICE_ROLE_KEY");
  const hashSecret = readOptional(env, "ONEDECORE_LEAD_HASH_SECRET");
  const publishable = readOptional(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!serviceRoleKey) {
    throw new Error(
      "[ONEDECORE Lead Env] SUPABASE_SERVICE_ROLE_KEY is required for this mode."
    );
  }
  if (
    looksLikePublishableKey(serviceRoleKey) ||
    (publishable != null && serviceRoleKey === publishable)
  ) {
    throw new Error(
      "[ONEDECORE Lead Env] Publishable/public key rejected in SUPABASE_SERVICE_ROLE_KEY slot."
    );
  }
  if (!hashSecret || hashSecret.length < 32) {
    throw new Error(
      "[ONEDECORE Lead Env] ONEDECORE_LEAD_HASH_SECRET must be at least 32 characters."
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
