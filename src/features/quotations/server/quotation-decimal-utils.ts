/**
 * Phase 7A — Commercial Quotation Exact Decimal Transport & Validation Utilities
 * Enforces exact decimal string transport without IEEE 754 binary floating-point drift (parseFloat).
 */

export class QuotationValidationError extends Error {
  readonly code = "QUOTATION_VALIDATION_FAILED";
  constructor(message: string) {
    super(`QUOTATION_VALIDATION_FAILED: ${message}`);
    this.name = "QuotationValidationError";
  }
}

/**
 * Validates and formats a quantity decimal string.
 * Scale constraint: max 3 decimal places (numeric(10,3)).
 * Range constraint: > 0 and <= 999999.999.
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

  const num = Number(str);
  if (isNaN(num) || num <= 0 || num > 999999.999) {
    throw new QuotationValidationError("Quantity out of allowed range");
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

  const num = Number(str);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new QuotationValidationError("Percentage out of allowed range [0.00, 100.00]");
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

  const paise = Number(str);
  if (!Number.isSafeInteger(paise) || paise < 0) {
    throw new QuotationValidationError(`${fieldName} out of allowed non-negative range`);
  }

  return paise;
}
