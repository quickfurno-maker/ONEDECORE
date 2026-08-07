/**
 * Quotation-level discount contracts (V1 — no line-item discount per ADR-0022).
 */

/** Basis points: 100 bps = 1.00%, 10_000 bps = 100%. */
export type DiscountBasisPoints = number & { readonly __brand: "DiscountBasisPoints" };

export const QUOTATION_DISCOUNT_BPS_MIN = 0;
/** Default hard bound placeholder — exact production bounds deferred to persistence config. */
export const QUOTATION_DISCOUNT_BPS_DEFAULT_MAX = 5_000;

export interface QuotationDiscountInput {
  readonly discountBps: DiscountBasisPoints;
}

export function assertDiscountBasisPoints(
  value: number,
  maxBps: number = QUOTATION_DISCOUNT_BPS_DEFAULT_MAX
): DiscountBasisPoints {
  if (!Number.isInteger(value)) {
    throw new Error("DiscountBasisPoints must be an integer.");
  }
  if (value < QUOTATION_DISCOUNT_BPS_MIN || value > maxBps) {
    throw new Error("DiscountBasisPoints is out of bounds.");
  }
  return value as DiscountBasisPoints;
}
