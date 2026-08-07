/**
 * Phase 7 migration-independent money contracts (INR paise integers).
 * Authoritative commercial arithmetic must never use floating point.
 */

export const QUOTATION_CURRENCY = "INR" as const;
export type QuotationCurrency = typeof QUOTATION_CURRENCY;

/** Integer paise (1 INR = 100 paise). */
export type MoneyPaise = number & { readonly __brand: "MoneyPaise" };

export const MONEY_ZERO_PAISE = 0 as MoneyPaise;

export const QUOTATION_UNIT_PRICE_MIN_PAISE = 0;
export const QUOTATION_UNIT_PRICE_MAX_PAISE = 100_000_000_000;

export function assertMoneyPaise(value: number): MoneyPaise {
  if (!Number.isInteger(value)) {
    throw new Error("MoneyPaise must be an integer.");
  }
  if (value < 0) {
    throw new Error("MoneyPaise must be non-negative.");
  }
  return value as MoneyPaise;
}

export function addMoneyPaise(a: MoneyPaise, b: MoneyPaise): MoneyPaise {
  return assertMoneyPaise(a + b);
}

export function subtractMoneyPaise(a: MoneyPaise, b: MoneyPaise): MoneyPaise {
  if (b > a) {
    throw new Error("Money subtraction would go negative.");
  }
  return assertMoneyPaise(a - b);
}

/**
 * Re-export CRM INR formatting for quotation display consistency.
 * Persistence layer may later centralise this helper.
 */
export { formatInrFromPaise, parseInrToPaise } from "../../crm/contracts/sales-target-contracts.ts";
