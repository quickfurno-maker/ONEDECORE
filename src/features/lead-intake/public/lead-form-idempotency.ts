/**
 * Session-scoped idempotency keys for public lead intake (in-memory, not localStorage).
 */

import type { LeadIntakeRequestBody } from "../contracts.ts";

let currentKey: string | null = null;
let currentFingerprint: string | null = null;

export function stablePayloadStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stablePayloadStringify(entry)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stablePayloadStringify(obj[key])}`)
    .join(",")}}`;
}

/** Fingerprint business payload excluding the idempotency key. */
export function fingerprintLeadPayload(body: LeadIntakeRequestBody): string {
  const { idempotencyKey, ...rest } = body;
  void idempotencyKey;
  return stablePayloadStringify(rest);
}

export function getOrCreateKey(payloadFingerprint: string): string {
  if (
    currentKey &&
    currentFingerprint === payloadFingerprint
  ) {
    return currentKey;
  }
  currentKey = crypto.randomUUID();
  currentFingerprint = payloadFingerprint;
  return currentKey;
}

export function resetAfterSuccess(): void {
  currentKey = null;
  currentFingerprint = null;
}

export function resetOnPayloadChange(payloadFingerprint: string): void {
  if (currentFingerprint !== payloadFingerprint) {
    currentKey = null;
    currentFingerprint = null;
  }
}

/** Reuse the same idempotency key when retrying after transient failures. */
export function shouldReuseOnError(status: number | null): boolean {
  if (status == null) return true;
  if (status === 500 || status === 503) return true;
  if (status === 429) return true;
  return false;
}
