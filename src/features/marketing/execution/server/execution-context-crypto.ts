import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";

export const CAMPAIGN_EXECUTION_CONTEXT_VERSION = 1 as const;

export interface CampaignExecutionContext {
  readonly version: typeof CAMPAIGN_EXECUTION_CONTEXT_VERSION;
  readonly runReference: string;
  readonly runTargetReference: string;
  readonly providerChannel: PaidAdsChannel;
  readonly campaignReference: string;
  readonly campaignVersionNumber: number;
  readonly landingPublicationReference: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface SignedCampaignExecutionContext {
  readonly context: CampaignExecutionContext;
  readonly signature: string;
}

export function buildCanonicalCampaignExecutionContextPayload(
  context: CampaignExecutionContext
): string {
  const payload = {
    campaignReference: context.campaignReference,
    campaignVersionNumber: context.campaignVersionNumber,
    expiresAt: context.expiresAt,
    issuedAt: context.issuedAt,
    landingPublicationReference: context.landingPublicationReference,
    providerChannel: context.providerChannel,
    runReference: context.runReference,
    runTargetReference: context.runTargetReference,
    version: context.version,
  };
  return JSON.stringify(payload);
}

export function signCampaignExecutionContext(
  secret: string,
  context: CampaignExecutionContext
): SignedCampaignExecutionContext {
  const payload = buildCanonicalCampaignExecutionContextPayload(context);
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return { context, signature };
}

export function verifyCampaignExecutionContext(
  secret: string,
  signed: SignedCampaignExecutionContext,
  nowMs: number = Date.now()
): { valid: true } | { valid: false; reason: string } {
  if (signed.context.version !== CAMPAIGN_EXECUTION_CONTEXT_VERSION) {
    return { valid: false, reason: "Unsupported campaign execution context version." };
  }

  const expected = signCampaignExecutionContext(secret, signed.context);
  try {
    const a = Buffer.from(expected.signature, "utf8");
    const b = Buffer.from(signed.signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: "Invalid campaign execution context signature." };
    }
  } catch {
    return { valid: false, reason: "Invalid campaign execution context signature." };
  }

  const expires = Date.parse(signed.context.expiresAt);
  if (Number.isNaN(expires) || nowMs > expires) {
    return { valid: false, reason: "Campaign execution context expired." };
  }

  return { valid: true };
}

/**
 * OD9C-B: never infer a run/target from wall-clock, UTM, or an unsigned query id.
 */
export function rejectUnsignedRunGuess(_input: {
  readonly utmCampaign?: string | null;
  readonly nowIso?: string | null;
  readonly queryRunId?: string | null;
}): never {
  throw new Error("CAMPAIGN_RUN_CONTEXT_REQUIRED");
}
