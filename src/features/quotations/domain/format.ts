/**
 * Quantity formatting helpers.
 */

import { formatInrFromPaise } from "../contracts/money.ts";

export function formatQuantityFromMilli(quantityMilli: number): string {
  const whole = Math.floor(quantityMilli / 1000);
  const fraction = quantityMilli % 1000;
  if (fraction === 0) {
    return String(whole);
  }
  return `${whole}.${String(fraction).padStart(3, "0").replace(/0+$/, "")}`;
}

export { formatInrFromPaise };
