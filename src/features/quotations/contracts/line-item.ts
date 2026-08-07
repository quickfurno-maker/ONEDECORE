/**
 * Quotation line-item draft contracts (migration-independent).
 */

import type { MoneyPaise } from "./money.ts";

/** Example units — not authoritative DB enum truth. */
export const QUOTATION_LINE_UNIT_EXAMPLES = [
  "each",
  "sqft",
  "rft",
  "lump_sum",
] as const;

export const QUOTATION_LINE_DESCRIPTION_MIN = 1;
export const QUOTATION_LINE_DESCRIPTION_MAX = 500;
export const QUOTATION_LINE_UNIT_MAX = 32;
export const QUOTATION_QUANTITY_MILLI_MIN = 1;
export const QUOTATION_QUANTITY_MILLI_MAX = 1_000_000_000;
export const QUOTATION_MAX_LINE_ITEMS = 200;

/**
 * Quantity stored as milli-units (1.5 units => 1500) to avoid float arithmetic.
 */
export type QuantityMilli = number & { readonly __brand: "QuantityMilli" };

export interface QuotationLineItemDraft {
  readonly id: string;
  readonly description: string;
  readonly unit: string;
  readonly quantityMilli: QuantityMilli;
  readonly unitPricePaise: MoneyPaise;
  readonly sortOrder: number;
}

export function assertQuantityMilli(value: number): QuantityMilli {
  if (!Number.isInteger(value)) {
    throw new Error("QuantityMilli must be an integer.");
  }
  if (value < QUOTATION_QUANTITY_MILLI_MIN || value > QUOTATION_QUANTITY_MILLI_MAX) {
    throw new Error("QuantityMilli is out of bounds.");
  }
  return value as QuantityMilli;
}
