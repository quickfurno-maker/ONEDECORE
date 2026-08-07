/**
 * Pure quotation input validation.
 */

import {
  QUOTATION_DISCOUNT_BPS_DEFAULT_MAX,
  QUOTATION_LINE_DESCRIPTION_MAX,
  QUOTATION_LINE_DESCRIPTION_MIN,
  QUOTATION_LINE_UNIT_MAX,
  QUOTATION_MAX_LINE_ITEMS,
  QUOTATION_QUANTITY_MILLI_MAX,
  QUOTATION_QUANTITY_MILLI_MIN,
  QUOTATION_TAX_BPS_MAX,
  QUOTATION_TAX_BPS_MIN,
  QUOTATION_UNIT_PRICE_MAX_PAISE,
  QUOTATION_UNIT_PRICE_MIN_PAISE,
  type QuotationCalculationInput,
  type QuotationValidationError,
  quotationValidationFailure,
  quotationValidationSuccess,
  type QuotationValidationResult,
} from "../contracts/index.ts";

export function validateQuotationCalculationInput(
  input: QuotationCalculationInput
): QuotationValidationResult {
  const errors: QuotationValidationError[] = [];
  const maxDiscountBps = input.maxDiscountBps ?? QUOTATION_DISCOUNT_BPS_DEFAULT_MAX;

  if (input.lineItems.length === 0) {
    errors.push({
      code: "empty_line_items",
      field: "lineItems",
      message: "At least one line item is required.",
    });
  }

  if (input.lineItems.length > QUOTATION_MAX_LINE_ITEMS) {
    errors.push({
      code: "too_many_line_items",
      field: "lineItems",
      message: `At most ${QUOTATION_MAX_LINE_ITEMS} line items are allowed.`,
    });
  }

  for (const item of input.lineItems) {
    const description = item.description.trim();
    if (
      description.length < QUOTATION_LINE_DESCRIPTION_MIN ||
      description.length > QUOTATION_LINE_DESCRIPTION_MAX
    ) {
      errors.push({
        code: "invalid_line_description",
        field: `lineItems.${item.id}.description`,
        message: "Line description is out of allowed bounds.",
      });
    }

    const unit = item.unit.trim();
    if (unit.length === 0 || unit.length > QUOTATION_LINE_UNIT_MAX) {
      errors.push({
        code: "invalid_line_unit",
        field: `lineItems.${item.id}.unit`,
        message: "Line unit is invalid.",
      });
    }

    if (
      !Number.isInteger(item.quantityMilli) ||
      item.quantityMilli < QUOTATION_QUANTITY_MILLI_MIN ||
      item.quantityMilli > QUOTATION_QUANTITY_MILLI_MAX
    ) {
      errors.push({
        code: "invalid_quantity",
        field: `lineItems.${item.id}.quantityMilli`,
        message: "Quantity is out of allowed bounds.",
      });
    }

    if (
      !Number.isInteger(item.unitPricePaise) ||
      item.unitPricePaise < QUOTATION_UNIT_PRICE_MIN_PAISE ||
      item.unitPricePaise > QUOTATION_UNIT_PRICE_MAX_PAISE
    ) {
      errors.push({
        code: "invalid_unit_price",
        field: `lineItems.${item.id}.unitPricePaise`,
        message: "Unit price is out of allowed bounds.",
      });
    }
  }

  if (
    !Number.isInteger(input.discount.discountBps) ||
    input.discount.discountBps < 0 ||
    input.discount.discountBps > maxDiscountBps
  ) {
    errors.push({
      code: "invalid_discount",
      field: "discount.discountBps",
      message: "Quotation discount is out of allowed bounds.",
    });
  }

  if (
    !Number.isInteger(input.tax.taxRateBps) ||
    input.tax.taxRateBps < QUOTATION_TAX_BPS_MIN ||
    input.tax.taxRateBps > QUOTATION_TAX_BPS_MAX
  ) {
    errors.push({
      code: "invalid_tax_rate",
      field: "tax.taxRateBps",
      message: "Tax rate is out of allowed bounds.",
    });
  }

  return errors.length > 0 ? quotationValidationFailure(errors) : quotationValidationSuccess();
}
