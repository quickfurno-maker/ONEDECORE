/**
 * Pure quotation calculation engine — integer paise arithmetic only.
 */

import {
  QUOTATION_CALCULATION_ALGORITHM_ID,
  type QuotationCalculationInput,
  type QuotationCalculationResult,
  type QuotationLineCalculation,
  assertDiscountBasisPoints,
  assertMoneyPaise,
  assertTaxRateBasisPoints,
  type MoneyPaise,
} from "../contracts/index.ts";
import { validateQuotationCalculationInput } from "./validate-quotation-input.ts";

function lineSubtotalPaise(
  unitPricePaise: MoneyPaise,
  quantityMilli: number
): MoneyPaise {
  const product = unitPricePaise * quantityMilli;
  return assertMoneyPaise(Math.round(product / 1000));
}

function applyDiscountBps(subtotalPaise: MoneyPaise, discountBps: number): MoneyPaise {
  const discount = Math.round((subtotalPaise * discountBps) / 10_000);
  return assertMoneyPaise(subtotalPaise - discount);
}

function discountAmountPaise(subtotalPaise: MoneyPaise, discountBps: number): MoneyPaise {
  return assertMoneyPaise(Math.round((subtotalPaise * discountBps) / 10_000));
}

function taxAmountPaise(taxableBasePaise: MoneyPaise, taxRateBps: number): MoneyPaise {
  return assertMoneyPaise(Math.round((taxableBasePaise * taxRateBps) / 10_000));
}

export function calculateQuotation(
  input: QuotationCalculationInput
): QuotationCalculationResult {
  const validation = validateQuotationCalculationInput(input);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join("; "));
  }

  const discountBps = assertDiscountBasisPoints(
    input.discount.discountBps,
    input.maxDiscountBps
  );
  const taxRateBps = assertTaxRateBasisPoints(input.tax.taxRateBps);

  const lineCalculations: QuotationLineCalculation[] = input.lineItems.map((item) => ({
    lineItemId: item.id,
    subtotalPaise: lineSubtotalPaise(item.unitPricePaise, item.quantityMilli),
  }));

  const subtotalPaise = lineCalculations.reduce(
    (sum, line) => assertMoneyPaise(sum + line.subtotalPaise),
    assertMoneyPaise(0)
  );

  const discountAmount = discountAmountPaise(subtotalPaise, discountBps);
  const taxableBasePaise = applyDiscountBps(subtotalPaise, discountBps);
  const taxAmountPaiseValue = taxAmountPaise(taxableBasePaise, taxRateBps);
  const grandTotalPaise = assertMoneyPaise(taxableBasePaise + taxAmountPaiseValue);

  return {
    algorithmId: QUOTATION_CALCULATION_ALGORITHM_ID,
    lineCalculations,
    subtotalPaise,
    discountBps,
    discountAmountPaise: discountAmount,
    taxableBasePaise,
    tax: {
      taxRateBps,
      taxableBasePaise,
      taxAmountPaise: taxAmountPaiseValue,
    },
    grandTotalPaise,
  };
}
