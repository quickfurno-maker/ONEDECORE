import type { CommerceOrderErrorCode } from "../orders/order-errors.ts";

const PUBLIC_MESSAGES: Partial<Record<CommerceOrderErrorCode | "PRICE_OR_AVAILABILITY_CHANGED", string>> = {
  COMMERCE_ORDER_VALIDATION: "Please check your details and try again.",
  COMMERCE_ORDER_UNAVAILABLE: "One or more items are no longer available.",
  COMMERCE_ORDER_NOT_SERVICEABLE: "We do not deliver to this pincode yet.",
  COMMERCE_COD_UNAVAILABLE: "Cash on delivery is not available for this order.",
  COMMERCE_INVENTORY_UNAVAILABLE: "An item in your order is no longer available in the requested quantity.",
  COMMERCE_RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  IDEMPOTENCY_KEY_REUSED: "This checkout attempt was already submitted. Check your order status.",
  PRICE_OR_AVAILABILITY_CHANGED:
    "Price or availability changed since your last review. Please confirm the updated total.",
};

export function toCommercePublicMessage(code: string): string {
  return PUBLIC_MESSAGES[code as keyof typeof PUBLIC_MESSAGES] ?? "Something went wrong. Please try again.";
}

export const TRACKING_MISMATCH_MESSAGE = "We couldn't verify those order details.";
