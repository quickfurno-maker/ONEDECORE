/**
 * Quotation reference / revision contracts.
 * Authoritative sequence allocation is DEFERRED TO PERSISTENCE PHASE.
 */

export interface QuotationRevisionRef {
  /** Synthetic or future DB-allocated reference, e.g. OD-Q-2026-00042. */
  readonly quotationReference: string;
  /** Monotonic revision within the quotation family. */
  readonly revisionNumber: number;
  readonly supersededByRevisionNumber: number | null;
}

export const QUOTATION_REFERENCE_MIN = 3;
export const QUOTATION_REFERENCE_MAX = 64;

export function validateQuotationReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (trimmed.length < QUOTATION_REFERENCE_MIN) {
    return `Reference must be at least ${QUOTATION_REFERENCE_MIN} characters.`;
  }
  if (trimmed.length > QUOTATION_REFERENCE_MAX) {
    return `Reference must be at most ${QUOTATION_REFERENCE_MAX} characters.`;
  }
  return null;
}

export function validateRevisionNumber(revision: number): string | null {
  if (!Number.isInteger(revision) || revision < 1 || revision > 9999) {
    return "Revision number must be an integer between 1 and 9999.";
  }
  return null;
}
