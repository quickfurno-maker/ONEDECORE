import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ValidatedLeadIntake } from "../contracts.ts";

export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function fingerprintPhone(secret: string, phoneE164: string): string {
  return hmacSha256Hex(secret, `phone:${phoneE164}`);
}

export function fingerprintNetwork(
  secret: string,
  networkIdentifier: string
): string {
  return hmacSha256Hex(secret, `network:${networkIdentifier}`);
}

/**
 * Canonical business payload for request hashing.
 * Excludes honeypot / transport noise. Field order is deterministic.
 */
export function buildCanonicalRequestPayload(
  validated: ValidatedLeadIntake
): string {
  const payload = {
    budgetComfort: validated.budgetComfort,
    consent: {
      marketing: validated.consentMarketing,
      marketingCopyVersion: validated.copyMarketing,
      noticeVersion: validated.noticeVersion,
      serviceCommunication: true,
      serviceCommunicationCopyVersion: validated.copyServiceCommunication,
      serviceEnquiry: true,
      serviceEnquiryCopyVersion: validated.copyServiceEnquiry,
      whatsappCopyVersion: validated.copyWhatsapp,
      whatsappService: validated.consentWhatsapp,
    },
    contact: {
      email: validated.email,
      name: validated.name,
      phoneE164: validated.phoneE164,
    },
    estimate: validated.estimateSnapshot,
    landingPath: validated.landingPath,
    locality: validated.locality,
    message: validated.message,
    plannerVersion: validated.plannerVersion,
    property: validated.property,
    rooms: [...validated.rooms].sort(),
    service: validated.service,
    timeline: validated.timeline,
    attribution: Object.fromEntries(
      Object.entries(validated.attribution).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    ),
  };
  return JSON.stringify(payload);
}

export function fingerprintRequest(
  secret: string,
  validated: ValidatedLeadIntake
): string {
  return hmacSha256Hex(secret, buildCanonicalRequestPayload(validated));
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
