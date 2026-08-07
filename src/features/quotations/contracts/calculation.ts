/**
 * Quotation calculation input/output contracts (pure domain boundary).
 */

import type { QuotationDiscountInput } from "./discount.ts";
import type { QuotationLineItemDraft } from "./line-item.ts";
import type { MoneyPaise } from "./money.ts";
import type { QuotationTaxInput } from "./tax.ts";

export const QUOTATION_CALCULATION_ALGORITHM_ID = "onedecore-quotation-v1" as const;

export interface QuotationCalculationInput {
  readonly lineItems: readonly QuotationLineItemDraft[];
  readonly discount: QuotationDiscountInput;
  readonly tax: QuotationTaxInput;
  readonly maxDiscountBps?: number;
}

export interface QuotationLineCalculation {
  readonly lineItemId: string;
  readonly subtotalPaise: MoneyPaise;
}

export interface QuotationTaxBreakdown {
  readonly taxRateBps: number;
  readonly taxableBasePaise: MoneyPaise;
  readonly taxAmountPaise: MoneyPaise;
}

export interface QuotationCalculationResult {
  readonly algorithmId: typeof QUOTATION_CALCULATION_ALGORITHM_ID;
  readonly lineCalculations: readonly QuotationLineCalculation[];
  readonly subtotalPaise: MoneyPaise;
  readonly discountBps: number;
  readonly discountAmountPaise: MoneyPaise;
  readonly taxableBasePaise: MoneyPaise;
  readonly tax: QuotationTaxBreakdown;
  readonly grandTotalPaise: MoneyPaise;
}
