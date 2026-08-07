/**
 * Tax rate contracts — rate is caller-supplied; ONEDECORE does not freeze GST % in code.
 */

/** Basis points for tax rate: 1_800 bps = 18.00%. */
export type TaxRateBasisPoints = number & { readonly __brand: "TaxRateBasisPoints" };

export const QUOTATION_TAX_BPS_MIN = 0;
export const QUOTATION_TAX_BPS_MAX = 10_000;

export interface QuotationTaxInput {
  readonly taxRateBps: TaxRateBasisPoints;
}

export function assertTaxRateBasisPoints(value: number): TaxRateBasisPoints {
  if (!Number.isInteger(value)) {
    throw new Error("TaxRateBasisPoints must be an integer.");
  }
  if (value < QUOTATION_TAX_BPS_MIN || value > QUOTATION_TAX_BPS_MAX) {
    throw new Error("TaxRateBasisPoints is out of bounds.");
  }
  return value as TaxRateBasisPoints;
}
