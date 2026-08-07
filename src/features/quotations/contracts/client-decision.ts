/**
 * Client decision contracts — no mutation/persistence in prebuild.
 */

import type { QuotationRevisionRef } from "./reference.ts";

export const QUOTATION_CLIENT_DECISIONS = [
  "accept",
  "reject",
  "request_revision",
] as const;

export type QuotationClientDecisionType = (typeof QUOTATION_CLIENT_DECISIONS)[number];

export const QUOTATION_CLIENT_NOTE_MIN = 10;
export const QUOTATION_CLIENT_NOTE_MAX = 500;

export interface QuotationClientDecision {
  readonly revision: QuotationRevisionRef;
  readonly decision: QuotationClientDecisionType;
  readonly decidedAt: string;
  readonly note: string | null;
}

export function validateClientDecisionNote(
  decision: QuotationClientDecisionType,
  note: string | null
): string | null {
  if (decision === "accept") {
    return null;
  }
  const trimmed = (note ?? "").trim();
  if (trimmed.length < QUOTATION_CLIENT_NOTE_MIN) {
    return `Note must be at least ${QUOTATION_CLIENT_NOTE_MIN} characters.`;
  }
  if (trimmed.length > QUOTATION_CLIENT_NOTE_MAX) {
    return `Note must be at most ${QUOTATION_CLIENT_NOTE_MAX} characters.`;
  }
  return null;
}
