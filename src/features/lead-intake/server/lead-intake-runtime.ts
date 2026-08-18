import "server-only";

import {
  getLeadIntakeServerEnv,
  type LeadIntakeMode,
} from "../../../config/server-env.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { LeadIntakeError, newCorrelationId } from "./lead-intake-errors.ts";
import {
  parseJsonBody,
  validateLeadIntakePayload,
} from "./lead-intake-validation.ts";
import { resolveTrustedLandingIdentity } from "../../landing-lab/server/verify-live-publication-context.ts";
import { getLandingLabHmacSecret } from "../../landing-lab/server/landing-lab-env.ts";
import type { ValidatedLeadIntake } from "../contracts.ts";
import { deriveNetworkIdentifier } from "./request-canonicalisation.ts";
import {
  submitValidatedLeadIntake,
  type LeadIntakeServiceResult,
} from "./lead-intake-service.ts";

export interface LeadIntakeRuntimeRequest {
  readonly method: string;
  readonly contentType: string | null;
  readonly origin: string | null;
  readonly host: string | null;
  readonly rawBody: string;
  readonly remoteAddress: string | null;
  readonly forwardedFor: string | null;
  readonly nodeEnv: string | undefined;
}

export interface LeadIntakeRuntimeDeps {
  readonly getEnv?: typeof getLeadIntakeServerEnv;
  readonly createAdminClient?: typeof createAdminClient;
  readonly getLandingLabHmacSecret?: typeof getLandingLabHmacSecret;
  readonly now?: () => number;
}

async function attachTrustedLandingAttribution(
  validated: ValidatedLeadIntake,
  hmacSecret: string | null,
  createAdmin: typeof createAdminClient
): Promise<{ readonly ok: true; readonly value: ValidatedLeadIntake } | { readonly ok: false }> {
  if (!validated.landingPublicationContext) {
    return { ok: true, value: validated };
  }
  try {
    const client = createAdmin();
    const resolved = await resolveTrustedLandingIdentity({
      signed: validated.landingPublicationContext,
      client,
      hmacSecret,
    });
    if (!resolved.ok) {
      return { ok: false };
    }
    return {
      ok: true,
      value: {
        ...validated,
        attribution: {
          ...validated.attribution,
          ...resolved.identity,
        },
      },
    };
  } catch {
    return { ok: false };
  }
}

function assertSameOrigin(origin: string | null, host: string | null): void {
  if (!origin || !host) {
    throw new LeadIntakeError({
      code: "ORIGIN_REQUIRED",
      message: "Same-origin requests only.",
      httpStatus: 403,
      correlationId: newCorrelationId(),
    });
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new LeadIntakeError({
      code: "ORIGIN_INVALID",
      message: "Same-origin requests only.",
      httpStatus: 403,
      correlationId: newCorrelationId(),
    });
  }
  if (originHost !== host) {
    throw new LeadIntakeError({
      code: "ORIGIN_MISMATCH",
      message: "Same-origin requests only.",
      httpStatus: 403,
      correlationId: newCorrelationId(),
    });
  }
}

/** Parse HTTP Host header to canonical hostname (loopback recognition only). */
export function parseLocalTestHostname(host: string | null): string | null {
  if (!host) {
    return null;
  }

  const raw = host.trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const bracketed = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) {
    return bracketed[1] ?? null;
  }

  const lastColon = raw.lastIndexOf(":");
  if (lastColon > 0) {
    const portPart = raw.slice(lastColon + 1);
    if (/^\d+$/.test(portPart)) {
      const hostname = raw.slice(0, lastColon);
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return hostname;
      }
      if (hostname.includes(".")) {
        return hostname;
      }
    }
  }

  return raw;
}

export function isLocalTestHost(host: string | null): boolean {
  const hostname = parseLocalTestHostname(host);
  if (!hostname) {
    return false;
  }

  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function assertLocalTestHost(host: string | null): void {
  if (!isLocalTestHost(host)) {
    throw new LeadIntakeError({
      code: "LOCAL_TEST_HOST_REQUIRED",
      message: "local-test mode is limited to localhost.",
      httpStatus: 403,
      correlationId: newCorrelationId(),
    });
  }
}

export async function handleLeadIntakeRequest(
  request: LeadIntakeRuntimeRequest,
  deps: LeadIntakeRuntimeDeps = {}
): Promise<LeadIntakeServiceResult & { correlationId: string }> {
  const correlationId = newCorrelationId();
  const started = (deps.now ?? Date.now)();

  if (request.method !== "POST") {
    throw new LeadIntakeError({
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
      httpStatus: 405,
      correlationId,
    });
  }

  const contentType = (request.contentType ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new LeadIntakeError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "JSON body required.",
      httpStatus: 415,
      correlationId,
    });
  }

  assertSameOrigin(request.origin, request.host);

  let mode: LeadIntakeMode = "disabled";
  let env;
  try {
    env = (deps.getEnv ?? getLeadIntakeServerEnv)();
    mode = env.mode;
  } catch {
    // Misconfiguration → fail closed as disabled for public callers.
    mode = "disabled";
  }

  if (mode === "disabled") {
    return {
      httpStatus: 503,
      outcome: "disabled",
      duplicate: false,
      correlationId,
      body: {
        ok: false,
        code: "LEAD_INTAKE_DISABLED",
        message: "Online enquiry submission is not available yet.",
      },
    };
  }

  if (mode === "local-test") {
    if (request.nodeEnv === "production") {
      return {
        httpStatus: 503,
        outcome: "disabled",
        duplicate: false,
        correlationId,
        body: {
          ok: false,
          code: "LEAD_INTAKE_DISABLED",
          message: "Online enquiry submission is not available yet.",
        },
      };
    }
    assertLocalTestHost(request.host);
  }

  if (!env || !env.hashSecret) {
    throw new LeadIntakeError({
      code: "LEAD_INTAKE_UNAVAILABLE",
      message: "Lead intake is temporarily unavailable.",
      httpStatus: 500,
      correlationId,
    });
  }

  const parsed = parseJsonBody(request.rawBody);
  if (!parsed.ok) {
    throw new LeadIntakeError({
      code: parsed.code,
      message:
        parsed.code === "BODY_TOO_LARGE"
          ? "Request body too large."
          : "Malformed JSON.",
      httpStatus: parsed.code === "BODY_TOO_LARGE" ? 413 : 400,
      correlationId,
    });
  }

  const validated = validateLeadIntakePayload(parsed.value);
  if (!validated.ok) {
    return {
      httpStatus: 400,
      outcome: "validation_rejected",
      duplicate: false,
      correlationId,
      body: {
        ok: false,
        code: "VALIDATION_REJECTED",
        message: "Request failed validation.",
        fields: validated.fields,
        correlationId,
      },
    };
  }

  const landingHmacSecret = (deps.getLandingLabHmacSecret ?? getLandingLabHmacSecret)();
  if (validated.value.landingPublicationContext && !landingHmacSecret) {
    return {
      httpStatus: 400,
      outcome: "validation_rejected",
      duplicate: false,
      correlationId,
      body: {
        ok: false,
        code: "VALIDATION_REJECTED",
        message: "Request failed validation.",
        fields: ["landingPublicationContext"],
        correlationId,
      },
    };
  }

  const trusted = await attachTrustedLandingAttribution(
    validated.value,
    landingHmacSecret,
    deps.createAdminClient ?? createAdminClient
  );
  if (!trusted.ok) {
    return {
      httpStatus: 400,
      outcome: "validation_rejected",
      duplicate: false,
      correlationId,
      body: {
        ok: false,
        code: "VALIDATION_REJECTED",
        message: "Request failed validation.",
        fields: ["landingPublicationContext"],
        correlationId,
      },
    };
  }

  const network = deriveNetworkIdentifier({
    mode,
    trustProxy: env.trustProxy,
    remoteAddress: request.remoteAddress,
    forwardedFor: request.forwardedFor,
  });

  const result = await submitValidatedLeadIntake(
    trusted.value,
    {
      mode,
      hashSecret: env.hashSecret,
      createAdminClient: deps.createAdminClient ?? createAdminClient,
      networkIdentifier: network.identifier,
    },
    correlationId
  );

  void started;
  return { ...result, correlationId };
}

/** Safe structured log fields only — never PII or secrets. */
export function safeLeadIntakeLog(input: {
  correlationId: string;
  outcome: string;
  durationMs: number;
  mode: LeadIntakeMode | "unknown";
  duplicate: boolean;
}): Record<string, string | number | boolean> {
  return {
    correlationId: input.correlationId,
    outcome: input.outcome,
    durationMs: input.durationMs,
    mode: input.mode,
    duplicate: input.duplicate,
  };
}
