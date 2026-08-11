/**
 * Phase 7A — Commercial Quotation Exact Decimal Transport & Validation Utilities
 * Enforces exact decimal string transport without IEEE 754 binary floating-point drift (parseFloat).
 */

import { QUOTATION_QUANTITY_MILLI_MAX, QUOTATION_QUANTITY_MILLI_MIN } from "../contracts/line-item.ts";

export class QuotationValidationError extends Error {
  readonly code = "QUOTATION_VALIDATION_FAILED";
  constructor(message: string) {
    super(`QUOTATION_VALIDATION_FAILED: ${message}`);
    this.name = "QuotationValidationError";
  }
}

/**
 * Validates and formats a quantity decimal string.
 * Uses exact BigInt milli-unit conversion to align with QUOTATION_QUANTITY_MILLI_MAX (1_000_000_000).
 * Scale constraint: max 3 decimal places (numeric(10,3)).
 * Range constraint: > 0.000 and <= 1,000,000.000 units.
 */
export function validateAndFormatQuantityString(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new QuotationValidationError("Quantity is required");
  }

  const str = String(value).trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(str)) {
    throw new QuotationValidationError("Invalid quantity format");
  }

  const parts = str.split(".");
  if (parts[1] && parts[1].length > 3) {
    throw new QuotationValidationError("Quantity cannot exceed 3 decimal places");
  }

  const unitsPart = parts[0] || "0";
  const milliPart = (parts[1] || "").padEnd(3, "0");

  try {
    const milliUnits = BigInt(unitsPart) * BigInt(1000) + BigInt(milliPart);

    if (
      milliUnits < BigInt(QUOTATION_QUANTITY_MILLI_MIN) ||
      milliUnits > BigInt(QUOTATION_QUANTITY_MILLI_MAX)
    ) {
      throw new QuotationValidationError("Quantity out of allowed range (0, 1000000.000]");
    }
  } catch (err) {
    if (err instanceof QuotationValidationError) throw err;
    throw new QuotationValidationError("Invalid quantity value");
  }

  return str;
}

/**
 * Validates and formats a percentage decimal string.
 * Scale constraint: max 2 decimal places (numeric(5,2)).
 * Range constraint: >= 0.00 and <= 100.00.
 */
export function validateAndFormatPercentageString(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new QuotationValidationError("Percentage is required");
  }

  const str = String(value).trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(str)) {
    throw new QuotationValidationError("Invalid percentage format");
  }

  const parts = str.split(".");
  if (parts[1] && parts[1].length > 2) {
    throw new QuotationValidationError("Percentage cannot exceed 2 decimal places");
  }

  const intPart = parts[0] || "0";
  const decPart = (parts[1] || "").padEnd(2, "0");

  try {
    const bps = BigInt(intPart) * BigInt(100) + BigInt(decPart);

    if (bps < BigInt(0) || bps > BigInt(10000)) {
      throw new QuotationValidationError("Percentage out of allowed range [0.00, 100.00]");
    }
  } catch (err) {
    if (err instanceof QuotationValidationError) throw err;
    throw new QuotationValidationError("Invalid percentage value");
  }

  return str;
}

/**
 * Validates monetary paise integer values.
 */
export function validateAndFormatPaiseInteger(value: unknown, fieldName = "Amount"): number {
  if (value === undefined || value === null || value === "") {
    throw new QuotationValidationError(`${fieldName} is required`);
  }

  const str = String(value).trim();
  if (!/^[0-9]+$/.test(str)) {
    throw new QuotationValidationError(`${fieldName} must be a non-negative integer`);
  }

  try {
    const paiseBig = BigInt(str);
    if (paiseBig < BigInt(0) || paiseBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new QuotationValidationError(`${fieldName} out of allowed non-negative range`);
    }

    return Number(paiseBig);
  } catch (err) {
    if (err instanceof QuotationValidationError) throw err;
    throw new QuotationValidationError(`${fieldName} invalid integer value`);
  }
}
