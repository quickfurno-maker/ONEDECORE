/**
 * Phase 9B migration-independent — landing lead intake boundary (prebuild only).
 */

import type { AttributionTouchpoint } from "../contracts/attribution.ts";
import type {
  PublicationContext,
  SignedPublicationContext,
} from "../contracts/publication-context.ts";
import type { FormSubmitSuccessEvent } from "../contracts/form-submit-success.ts";
import { verifyPublicationContext } from "../server/publication-context-crypto.ts";
import {
  buildCanonicalLeadPayloadHash,
  type CanonicalLeadPayload,
} from "./form-success-idempotency.ts";
import { normalizeAttributionParams } from "./normalize-attribution.ts";

export interface LandingLeadSubmissionContext {
  readonly publicationReference: string;
  readonly pageReference: string;
  readonly pageVersionNumber: number;
  readonly experimentReference: string | null;
  readonly variantKey: string | null;
  readonly signedPublicationContext: SignedPublicationContext;
  readonly canonicalPayloadHash: string;
  readonly fieldValues: Readonly<Record<string, string>>;
}

export interface LeadSuccessAttributionInput {
  readonly touchpointId: string;
  readonly occurredAt: string;
  readonly publicationContext: PublicationContext;
  readonly leadReference: string;
  readonly campaignReference: string | null;
  readonly campaignVersionNumber: number | null;
  readonly attribution: {
    readonly utmSource?: string | null;
    readonly utmMedium?: string | null;
    readonly utmCampaign?: string | null;
    readonly utmContent?: string | null;
    readonly utmTerm?: string | null;
    readonly fbclid?: string | null;
    readonly gclid?: string | null;
  };
}

export function validateSignedPublicationContext(
  secret: string,
  signed: SignedPublicationContext
): { valid: true; context: PublicationContext } | { valid: false; reason: string } {
  const result = verifyPublicationContext(secret, signed);
  if (!result.valid) {
    return result;
  }
  return { valid: true, context: signed.context };
}

export function buildLandingLeadSubmissionContext(input: {
  readonly secret: string;
  readonly signedPublicationContext: SignedPublicationContext;
  readonly fieldValues: Readonly<Record<string, string>>;
}): { ok: true; context: LandingLeadSubmissionContext } | { ok: false; reason: string } {
  const verification = validateSignedPublicationContext(
    input.secret,
    input.signedPublicationContext
  );
  if (!verification.valid) {
    return { ok: false, reason: verification.reason };
  }

  const publication = verification.context;
  const canonicalPayloadHash = buildCanonicalLeadPayloadHash({
    publicationReference: publication.publicationReference,
    pageReference: publication.pageReference,
    pageVersionNumber: publication.pageVersionNumber,
    experimentReference: publication.experimentReference,
    variantKey: publication.variantKey,
    fields: input.fieldValues,
  });

  return {
    ok: true,
    context: {
      publicationReference: publication.publicationReference,
      pageReference: publication.pageReference,
      pageVersionNumber: publication.pageVersionNumber,
      experimentReference: publication.experimentReference,
      variantKey: publication.variantKey,
      signedPublicationContext: input.signedPublicationContext,
      canonicalPayloadHash,
      fieldValues: input.fieldValues,
    },
  };
}

export function buildAttributionTouchpointAfterLeadSuccess(
  input: LeadSuccessAttributionInput
): AttributionTouchpoint {
  const normalized = normalizeAttributionParams(input.attribution);
  return {
    touchpointId: input.touchpointId,
    occurredAt: input.occurredAt,
    landingPageReference: input.publicationContext.pageReference,
    pageVersionNumber: input.publicationContext.pageVersionNumber,
    publicationReference: input.publicationContext.publicationReference,
    experimentReference: input.publicationContext.experimentReference,
    variantKey: input.publicationContext.variantKey,
    campaignReference: input.campaignReference,
    campaignVersionNumber: input.campaignVersionNumber,
    leadReference: input.leadReference,
    utmSource: normalized.utmSource,
    utmMedium: normalized.utmMedium,
    utmCampaign: normalized.utmCampaign,
    utmContent: normalized.utmContent,
    utmTerm: normalized.utmTerm,
    fbclid: normalized.fbclid,
    gclid: normalized.gclid,
    auxiliary: {},
  };
}

export function buildFormSubmitSuccessAfterLeadSuccess(input: {
  readonly submissionId: string;
  readonly leadReference: string;
  readonly recordedAt: string;
  readonly submissionContext: LandingLeadSubmissionContext;
}): FormSubmitSuccessEvent {
  return {
    submissionId: input.submissionId,
    canonicalPayloadHash: input.submissionContext.canonicalPayloadHash,
    publicationReference: input.submissionContext.publicationReference,
    leadReference: input.leadReference,
    recordedAt: input.recordedAt,
  };
}

export function assertNoFabricatedMarketingConsent(
  consent: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (!consent || typeof consent !== "object") {
    return "Service enquiry consent is required; marketing consent must not be fabricated.";
  }
  if (consent.marketing === true || consent.marketingEmail === true) {
    return "MARKETING consent cannot be fabricated for landing lab prebuild.";
  }
  if (consent.serviceEnquiry !== true) {
    return "Service enquiry consent must be explicitly true.";
  }
  return null;
}

export function buildCanonicalLeadPayloadFromContext(
  context: LandingLeadSubmissionContext
): CanonicalLeadPayload {
  return {
    publicationReference: context.publicationReference,
    pageReference: context.pageReference,
    pageVersionNumber: context.pageVersionNumber,
    experimentReference: context.experimentReference,
    variantKey: context.variantKey,
    fields: context.fieldValues,
  };
}
