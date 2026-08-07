/**
 * Calculation adapter boundary — UI must not embed arithmetic.
 */

import type {
  QuotationCalculationInput,
  QuotationCalculationResult,
} from "../contracts/calculation.ts";
import { calculateQuotation } from "../domain/calculate-quotation.ts";

export interface QuotationCalculationAdapter {
  calculate(input: QuotationCalculationInput): QuotationCalculationResult;
}

export function createDomainQuotationCalculationAdapter(): QuotationCalculationAdapter {
  return {
    calculate: (input) => calculateQuotation(input),
  };
}
