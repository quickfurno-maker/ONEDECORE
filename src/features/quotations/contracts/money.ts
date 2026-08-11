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
 */
export { formatInrFromPaise } from "../../crm/contracts/sales-target-contracts.ts";

/**
 * Exact INR to paise parser for commercial quotations.
 * Accepts optional ₹ symbol, commas, and surrounding whitespace.
 * Accepts only digits plus optional decimal with maximum 2 decimal places.
 * Rejects invalid strings, negative numbers, non-standard notation, and over-scale decimals.
 * Returns exact paise integer or null if invalid (NEVER silently truncates or defaults to 0).
 */
export function parseQuotationInrToPaiseExact(input: string | undefined | null): number | null {
  if (input === undefined || input === null) return null;
  let str = String(input).trim();
  if (!str) return null;

  // Harmless normalization: remove ₹ currency symbol and commas
  str = str.replace(/₹/g, "").replace(/,/g, "").trim();

  // Accept strictly non-negative decimal with 0, 1, or 2 decimal places
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(str)) {
    return null;
  }

  const parts = str.split(".");
  const rupeesStr = parts[0] || "0";
  const decimalsStr = (parts[1] || "").padEnd(2, "0");

  try {
    const rupeesBig = BigInt(rupeesStr);
    const decimalsBig = BigInt(decimalsStr);
    const paiseBig = rupeesBig * BigInt(100) + decimalsBig;

    if (paiseBig < BigInt(0) || paiseBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    return Number(paiseBig);
  } catch {
    return null;
  }
}
