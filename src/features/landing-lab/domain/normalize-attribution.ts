/**
 * Phase 9 migration-independent — bounded attribution parameter normalization.
 */

import type { NormalizedAttributionParams } from "../contracts/attribution.ts";

const MAX_PARAM_LENGTH = 120;
const PARAM_PATTERN = /^[a-zA-Z0-9._-]+$/;

function normalizeParam(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_PARAM_LENGTH) return null;
  if (!PARAM_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function normalizeAttributionParams(input: {
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmContent?: string | null;
  readonly utmTerm?: string | null;
  readonly fbclid?: string | null;
  readonly gclid?: string | null;
}): NormalizedAttributionParams {
  return {
    utmSource: normalizeParam(input.utmSource),
    utmMedium: normalizeParam(input.utmMedium),
    utmCampaign: normalizeParam(input.utmCampaign),
    utmContent: normalizeParam(input.utmContent),
    utmTerm: normalizeParam(input.utmTerm),
    fbclid: normalizeParam(input.fbclid),
    gclid: normalizeParam(input.gclid),
  };
}
