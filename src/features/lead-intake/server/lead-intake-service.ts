import "server-only";

import type { LeadIntakeMode } from "../../../config/server-env.ts";
import type { LeadIntakeRpcResult, ValidatedLeadIntake } from "../contracts.ts";
import { LeadIntakeError } from "./lead-intake-errors.ts";
import { callSubmitLeadIntakeRpc } from "./lead-intake-repository.ts";
import {
  fingerprintNetwork,
  fingerprintPhone,
  fingerprintRequest,
} from "./request-fingerprints.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.generated.ts";

export interface LeadIntakeServiceDeps {
  readonly mode: LeadIntakeMode;
  readonly hashSecret: string;
  readonly createAdminClient: () => SupabaseClient<Database>;
  readonly networkIdentifier: string;
}

export interface LeadIntakeServiceResult {
  readonly httpStatus: number;
  readonly body: {
    readonly ok: boolean;
    readonly code: string;
    readonly message: string;
    readonly submissionReference?: string;
    readonly duplicate?: boolean;
    readonly fields?: readonly string[];
    readonly correlationId?: string;
  };
  readonly retryAfterSeconds?: number;
  readonly outcome: string;
  readonly duplicate: boolean;
}

export async function submitValidatedLeadIntake(
  validated: ValidatedLeadIntake,
  deps: LeadIntakeServiceDeps,
  correlationId: string
): Promise<LeadIntakeServiceResult> {
  const source = deps.mode === "local-test" ? "local-test" : "website-planner";
  const requestHash = fingerprintRequest(deps.hashSecret, validated);
  const phoneFingerprintHash = fingerprintPhone(
    deps.hashSecret,
    validated.phoneE164
  );
  const networkFingerprintHash = fingerprintNetwork(
    deps.hashSecret,
    deps.networkIdentifier
  );

  let rpc: LeadIntakeRpcResult;
  try {
    const client = deps.createAdminClient();
    rpc = await callSubmitLeadIntakeRpc(client, {
      validated,
      requestHash,
      networkFingerprintHash,
      phoneFingerprintHash,
      source,
    });
  } catch {
    throw new LeadIntakeError({
      code: "LEAD_INTAKE_UNAVAILABLE",
      message: "Lead intake is temporarily unavailable.",
      httpStatus: 500,
      correlationId,
    });
  }

  switch (rpc.outcome) {
    case "created":
      return {
        httpStatus: 201,
        outcome: rpc.outcome,
        duplicate: false,
        body: {
          ok: true,
          code: "LEAD_CREATED",
          message: "Enquiry received.",
          submissionReference: rpc.submission_reference ?? undefined,
          duplicate: false,
        },
      };
    case "idempotent_replay":
      return {
        httpStatus: 200,
        outcome: rpc.outcome,
        duplicate: true,
        body: {
          ok: true,
          code: "LEAD_ALREADY_RECEIVED",
          message: "Enquiry already received.",
          submissionReference: rpc.submission_reference ?? undefined,
          duplicate: true,
        },
      };
    case "idempotency_conflict":
      return {
        httpStatus: 409,
        outcome: rpc.outcome,
        duplicate: false,
        body: {
          ok: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key was reused with a different payload.",
        },
      };
    case "network_rate_limited":
    case "phone_rate_limited":
      return {
        httpStatus: 429,
        outcome: rpc.outcome,
        duplicate: false,
        retryAfterSeconds: rpc.retry_after_seconds ?? 900,
        body: {
          ok: false,
          code:
            rpc.outcome === "network_rate_limited"
              ? "NETWORK_RATE_LIMIT"
              : "PHONE_RATE_LIMIT",
          message: "Too many requests. Please try again later.",
        },
      };
    case "validation_rejected":
      return {
        httpStatus: 400,
        outcome: rpc.outcome,
        duplicate: false,
        body: {
          ok: false,
          code: "VALIDATION_REJECTED",
          message: "Request failed validation.",
        },
      };
    default:
      throw new LeadIntakeError({
        code: "LEAD_INTAKE_UNAVAILABLE",
        message: "Lead intake is temporarily unavailable.",
        httpStatus: 500,
        correlationId,
      });
  }
}
