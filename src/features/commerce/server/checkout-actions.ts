"use server";

import { CommerceOrderError, normalizeCommerceOrderError } from "../orders/order-errors.ts";
import {
  createPublicCommerceCodOrder,
  consumeCommercePublicRateLimit,
  quotePublicCommerceCart,
} from "../orders/order-queries.ts";
import type { CommerceCartQuote } from "../orders/order-types.ts";
import {
  deriveCommerceRequestFingerprints,
  normalizeCommerceMobileE164,
} from "./commerce-fingerprints.ts";
import { toCommercePublicMessage } from "./commerce-public-errors.ts";
import {
  issueCommerceReviewToken,
  reviewTokenMatchesQuote,
  reviewTokenMatchesRequest,
  verifyCommerceReviewToken,
} from "./commerce-review-token.ts";
import { isShopPublicEnabled } from "./shop-public-gate.ts";

export type CheckoutQuoteState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      quote: CommerceCartQuote;
      reviewToken: string;
      reviewExpiresAt: number;
    };

export type PlaceCodOrderState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string; code?: string }
  | {
      status: "ok";
      orderReference: string;
      totalPaise: number;
      checkoutMode: "cart" | "buy-now";
    }
  | { status: "price_changed"; message: string; quote: CommerceCartQuote; reviewToken: string };

type CheckoutLine = { sku: string; quantity: number };

function parseLines(raw: string): CheckoutLine[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) return null;
    const lines: CheckoutLine[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (entry == null || typeof entry !== "object" || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const sku = String(row.sku ?? "").trim().toLowerCase();
      const quantity = Number(row.quantity);
      if (!/^[a-z0-9._-]{1,64}$/.test(sku)) return null;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
      if (seen.has(sku)) return null;
      seen.add(sku);
      lines.push({ sku, quantity });
    }
    return lines;
  } catch {
    return null;
  }
}

function boundedText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function buildCustomerPayload(formData: FormData) {
  const mobile = normalizeCommerceMobileE164(boundedText(formData.get("customerMobile"), 20));
  if (!mobile) return null;
  const name = boundedText(formData.get("customerName"), 120);
  if (name.length < 2) return null;
  const emailRaw = boundedText(formData.get("customerEmail"), 120);
  return {
    name,
    mobile,
    ...(emailRaw ? { email: emailRaw } : {}),
  };
}

function buildDeliveryPayload(formData: FormData) {
  const mobile = normalizeCommerceMobileE164(boundedText(formData.get("deliveryMobile"), 20));
  if (!mobile) return null;
  const recipientName = boundedText(formData.get("recipientName"), 120);
  const addressLine1 = boundedText(formData.get("addressLine1"), 160);
  const locality = boundedText(formData.get("locality"), 120);
  const city = boundedText(formData.get("city"), 80);
  const state = boundedText(formData.get("state"), 80);
  const pincode = boundedText(formData.get("pincode"), 6);
  if (
    recipientName.length < 2 ||
    addressLine1.length < 3 ||
    locality.length < 2 ||
    city.length < 2 ||
    state.length < 2 ||
    !/^[0-9]{6}$/.test(pincode)
  ) {
    return null;
  }
  const addressLine2 = boundedText(formData.get("addressLine2"), 160);
  const emailRaw = boundedText(formData.get("deliveryEmail"), 120);
  return {
    recipient_name: recipientName,
    mobile,
    address_line_1: addressLine1,
    ...(addressLine2 ? { address_line_2: addressLine2 } : {}),
    locality,
    city,
    state,
    pincode,
    ...(emailRaw ? { email: emailRaw } : {}),
  };
}

export async function reviewCheckoutQuote(
  _prev: CheckoutQuoteState,
  formData: FormData
): Promise<CheckoutQuoteState> {
  if (!isShopPublicEnabled()) {
    return { status: "error", message: "Furniture ordering is not activated yet." };
  }
  const pincode = boundedText(formData.get("pincode"), 6);
  const lines = parseLines(String(formData.get("lines") ?? ""));
  if (!lines || !/^[0-9]{6}$/.test(pincode)) {
    return { status: "invalid" };
  }
  try {
    const { networkFingerprintHash } = await deriveCommerceRequestFingerprints();
    const rate = await consumeCommercePublicRateLimit({
      operation: "quote",
      networkFingerprintHash,
    });
    if (!rate.allowed) {
      return { status: "error", message: toCommercePublicMessage("COMMERCE_RATE_LIMITED") };
    }
    const quote = await quotePublicCommerceCart({
      lines,
      pincode,
      paymentMethod: "cod",
    });
    if (!quote.codAllowed || quote.lines.some((line) => !line.canFulfil)) {
      return { status: "error", message: toCommercePublicMessage("COMMERCE_ORDER_UNAVAILABLE") };
    }
    const { token, expiresAt } = issueCommerceReviewToken({
      lines,
      pincode,
      totalPaise: quote.totalPaise,
    });
    return { status: "ok", quote, reviewToken: token, reviewExpiresAt: expiresAt };
  } catch (error) {
    const normalized = normalizeCommerceOrderError(error);
    return { status: "error", message: toCommercePublicMessage(normalized.code) };
  }
}

export async function placeCodOrder(
  _prev: PlaceCodOrderState,
  formData: FormData
): Promise<PlaceCodOrderState> {
  if (!isShopPublicEnabled()) {
    return { status: "error", message: "Furniture ordering is not activated yet." };
  }
  const pincode = boundedText(formData.get("pincode"), 6);
  const lines = parseLines(String(formData.get("lines") ?? ""));
  const reviewToken = boundedText(formData.get("reviewToken"), 4096);
  const idempotencyKey = boundedText(formData.get("idempotencyKey"), 64);
  const checkoutMode = boundedText(formData.get("checkoutMode"), 16) === "buy-now" ? "buy-now" : "cart";
  if (!lines || !/^[0-9]{6}$/.test(pincode) || !reviewToken || !/^[0-9a-f-]{36}$/.test(idempotencyKey)) {
    return { status: "invalid", message: "Please review your order and try again." };
  }
  const customer = buildCustomerPayload(formData);
  const delivery = buildDeliveryPayload(formData);
  if (!customer || !delivery) {
    return { status: "invalid", message: "Please check your contact and delivery details." };
  }
  const tokenPayload = verifyCommerceReviewToken(reviewToken);
  if (!tokenPayload || !reviewTokenMatchesRequest(tokenPayload, { lines, pincode })) {
    return { status: "invalid", message: "Your checkout review expired. Please review again." };
  }
  try {
    const { networkFingerprintHash, phoneFingerprintHash } = await deriveCommerceRequestFingerprints({
      mobileE164: customer.mobile,
    });
    const rate = await consumeCommercePublicRateLimit({
      operation: "checkout",
      networkFingerprintHash,
      phoneFingerprintHash,
    });
    if (!rate.allowed) {
      return {
        status: "error",
        message: toCommercePublicMessage("COMMERCE_RATE_LIMITED"),
        code: "COMMERCE_RATE_LIMITED",
      };
    }
    const freshQuote = await quotePublicCommerceCart({
      lines,
      pincode,
      paymentMethod: "cod",
    });
    if (!freshQuote.codAllowed || freshQuote.lines.some((line) => !line.canFulfil)) {
      return {
        status: "error",
        message: toCommercePublicMessage("COMMERCE_ORDER_UNAVAILABLE"),
        code: "COMMERCE_ORDER_UNAVAILABLE",
      };
    }
    if (!reviewTokenMatchesQuote(tokenPayload, freshQuote)) {
      const reissued = issueCommerceReviewToken({
        lines,
        pincode,
        totalPaise: freshQuote.totalPaise,
      });
      return {
        status: "price_changed",
        message: toCommercePublicMessage("PRICE_OR_AVAILABILITY_CHANGED"),
        quote: freshQuote,
        reviewToken: reissued.token,
      };
    }
    const receipt = await createPublicCommerceCodOrder({
      lines,
      customer,
      delivery,
      idempotencyKey,
    });
    return {
      status: "ok",
      orderReference: receipt.orderReference,
      totalPaise: receipt.totalPaise,
      checkoutMode,
    };
  } catch (error) {
    const normalized =
      error instanceof CommerceOrderError ? error : normalizeCommerceOrderError(error);
    return {
      status: "error",
      message: toCommercePublicMessage(normalized.code),
      code: normalized.code,
    };
  }
}
