/**
 * Phase 9B migration-independent — canonical lead payload hashing for idempotency.
 */

import { createHash } from "node:crypto";

export interface CanonicalLeadPayload {
  readonly publicationReference: string;
  readonly pageReference: string;
  readonly pageVersionNumber: number;
  readonly experimentReference: string | null;
  readonly variantKey: string | null;
  readonly fields: Readonly<Record<string, string>>;
}

function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key]!;
  }
  return sorted;
}

export function buildCanonicalLeadPayloadHash(payload: CanonicalLeadPayload): string {
  const canonical = {
    experimentReference: payload.experimentReference,
    fields: sortRecord(payload.fields),
    pageReference: payload.pageReference,
    pageVersionNumber: payload.pageVersionNumber,
    publicationReference: payload.publicationReference,
    variantKey: payload.variantKey,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
