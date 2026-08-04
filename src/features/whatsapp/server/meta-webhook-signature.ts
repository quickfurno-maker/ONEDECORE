import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const HEX_PATTERN = /^[a-f0-9]{64}$/i;

export type SignatureVerificationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "MISSING" | "MALFORMED" | "INVALID" };

/**
 * Parse X-Hub-Signature-256 header value.
 * Accepts sha256=<64 hex> (case-insensitive hex).
 */
export function parseHubSignature256Header(
  headerValue: string | null
): { readonly ok: true; readonly digestHex: string } | { readonly ok: false } {
  if (headerValue == null) {
    return { ok: false };
  }
  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith(SIGNATURE_PREFIX)) {
    return { ok: false };
  }
  const digestHex = trimmed.slice(SIGNATURE_PREFIX.length);
  if (!HEX_PATTERN.test(digestHex)) {
    return { ok: false };
  }
  return { ok: true, digestHex: digestHex.toLowerCase() };
}

/**
 * Verify Meta webhook signature on exact raw POST bytes.
 * Must run before JSON.parse.
 */
export function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  headerValue: string | null,
  appSecret: string
): SignatureVerificationResult {
  const parsed = parseHubSignature256Header(headerValue);
  if (!parsed.ok) {
    return {
      ok: false,
      code: headerValue == null || headerValue.trim() === "" ? "MISSING" : "MALFORMED",
    };
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(parsed.digestHex, "hex");
  } catch {
    return { ok: false, code: "MALFORMED" };
  }

  if (provided.length !== expected.length) {
    return { ok: false, code: "INVALID" };
  }

  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, code: "INVALID" };
  }

  return { ok: true };
}

export function computeEnvelopeHash(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
