/**
 * Quotation validation error contracts.
 */

export type QuotationValidationCode =
  | "empty_line_items"
  | "too_many_line_items"
  | "invalid_line_description"
  | "invalid_line_unit"
  | "invalid_quantity"
  | "invalid_unit_price"
  | "invalid_discount"
  | "invalid_tax_rate"
  | "invalid_reference"
  | "invalid_revision";

export interface QuotationValidationError {
  readonly code: QuotationValidationCode;
  readonly field: string | null;
  readonly message: string;
}

export interface QuotationValidationResult {
  readonly ok: boolean;
  readonly errors: readonly QuotationValidationError[];
}

export function quotationValidationFailure(
  errors: readonly QuotationValidationError[]
): QuotationValidationResult {
  return { ok: false, errors };
}

export function quotationValidationSuccess(): QuotationValidationResult {
  return { ok: true, errors: [] };
}
