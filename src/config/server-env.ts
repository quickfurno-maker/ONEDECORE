import "server-only";

import { getMissingLeadIntakeActivationFields } from "../features/legal/business-identity.ts";
import { areLeadPathConsentVersionsEffective } from "../features/legal/consent-registry.ts";
import { LEAD_INTAKE_ACTIVATION } from "../features/legal/lead-intake-activation.ts";
import {
  LEGAL_PUBLICATION_MODE,
  canRenderPublishedLegalDocument,
} from "../features/legal/legal-publication.ts";
import {
  PRIVACY_NOTICE_EFFECTIVE_DATE,
} from "../features/legal/privacy-policy-content.ts";
import {
  TERMS_OF_USE_EFFECTIVE_DATE,
} from "../features/legal/terms-content.ts";
import { areWebsiteLeadProcessorsReady } from "../features/legal/processor-register.ts";
import type { LeadIntakeActivationInput } from "../features/legal/business-identity.ts";
/*
 * Supabase TARGET identity is a runtime property, not a lead-intake one, so it
 * is owned by `lib/supabase/runtime-target.ts` and merely composed here. This
 * module keeps what is genuinely its own: consent versions, processor
 * diligence, published legal documents, the hash secret and trust-proxy.
 *
 * The two predicates are re-exported because callers and tests already import
 * them from here, and moving a definition should not move its address.
 */
import {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../lib/supabase/runtime-target.ts";

export {
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../lib/supabase/runtime-target.ts";

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

function safeUrlError(code: string): Error {
  // Never include URL or key material in errors.
  return new Error(`[ONEDECORE Lead Env] ${code}`);
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
    if (!areWebsiteLeadProcessorsReady()) {
      throw safeUrlError(
        "enabled mode blocked until website lead processor diligence is complete."
      );
    }
    if (!areLeadPathConsentVersionsEffective()) {
      throw safeUrlError(
        "enabled mode blocked until lead-path consent versions are effective."
      );
    }
    if (
      LEGAL_PUBLICATION_MODE !== "published" ||
      !canRenderPublishedLegalDocument({
        mode: LEGAL_PUBLICATION_MODE,
        effectiveDate: PRIVACY_NOTICE_EFFECTIVE_DATE,
      }) ||
      !canRenderPublishedLegalDocument({
        mode: LEGAL_PUBLICATION_MODE,
        effectiveDate: TERMS_OF_USE_EFFECTIVE_DATE,
      })
    ) {
      throw safeUrlError(
        "enabled mode blocked until Privacy/Terms are published with real effective dates."
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
