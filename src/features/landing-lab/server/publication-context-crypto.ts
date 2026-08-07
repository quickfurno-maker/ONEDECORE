/**
 * Phase 9 migration-independent — publication context HMAC signing (server-only).
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PublicationContext,
  SignedPublicationContext,
} from "../../landing-lab/contracts/publication-context.ts";

export function buildCanonicalPublicationContextPayload(
  context: PublicationContext
): string {
  const payload = {
    experimentReference: context.experimentReference,
    expiresAt: context.expiresAt,
    issuedAt: context.issuedAt,
    pageReference: context.pageReference,
    pageVersionNumber: context.pageVersionNumber,
    publicationReference: context.publicationReference,
    variantKey: context.variantKey,
  };
  return JSON.stringify(payload);
}

export function signPublicationContext(
  secret: string,
  context: PublicationContext
): SignedPublicationContext {
  const payload = buildCanonicalPublicationContextPayload(context);
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return { context, signature };
}

export function verifyPublicationContext(
  secret: string,
  signed: SignedPublicationContext
): { valid: true } | { valid: false; reason: string } {
  const expected = signPublicationContext(secret, signed.context);
  try {
    const a = Buffer.from(expected.signature, "utf8");
    const b = Buffer.from(signed.signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: "Invalid publication context signature." };
    }
  } catch {
    return { valid: false, reason: "Invalid publication context signature." };
  }

  if (signed.context.expiresAt) {
    const expires = Date.parse(signed.context.expiresAt);
    if (!Number.isNaN(expires) && Date.now() > expires) {
      return { valid: false, reason: "Publication context expired." };
    }
  }

  return { valid: true };
}
