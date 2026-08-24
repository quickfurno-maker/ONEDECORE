import "server-only";

import type { Json } from "@/types/database.generated";
import { createAdminClient } from "@/lib/supabase/service-role";
import { normalizeCommerceOrderError } from "./order-errors.ts";
import {
  parseCommerceCartQuote,
  parseCommerceCodOrderReceipt,
  parseCommerceRateLimitResult,
  parseCommerceTrackingIdentity,
  parseCommerceTrackingSnapshot,
} from "./order-parsers.ts";
import type {
  CommerceCartQuote,
  CommerceCodOrderReceipt,
  CommerceRateLimitResult,
  CommerceTrackingIdentity,
  CommerceTrackingSnapshot,
} from "./order-types.ts";

type QuoteLines = ReadonlyArray<{ sku: string; quantity: number }>;

export async function quotePublicCommerceCart(input: {
  lines: QuoteLines;
  pincode: string;
  paymentMethod?: "cod" | "online" | null;
}): Promise<CommerceCartQuote> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("quote_public_commerce_cart", {
    p_lines: input.lines as unknown as Json,
    p_pincode: input.pincode,
    p_payment_method: input.paymentMethod ?? undefined,
  });
  if (error) throw normalizeCommerceOrderError(error);
  return parseCommerceCartQuote(data);
}

export async function createPublicCommerceCodOrder(input: {
  lines: QuoteLines;
  customer: Record<string, unknown>;
  delivery: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<CommerceCodOrderReceipt> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_public_commerce_cod_order", {
    p_lines: input.lines as unknown as Json,
    p_customer: input.customer as Json,
    p_delivery: input.delivery as Json,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw normalizeCommerceOrderError(error);
  return parseCommerceCodOrderReceipt(data);
}

export async function consumeCommercePublicRateLimit(input: {
  operation: "quote" | "checkout" | "track";
  networkFingerprintHash: string;
  phoneFingerprintHash?: string | null;
}): Promise<CommerceRateLimitResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_commerce_public_rate_limit", {
    p_operation: input.operation,
    p_network_fingerprint_hash: input.networkFingerprintHash,
    p_phone_fingerprint_hash: input.phoneFingerprintHash ?? undefined,
  });
  if (error) throw normalizeCommerceOrderError(error);
  return parseCommerceRateLimitResult(data);
}

export async function verifyPublicCommerceOrderTrackingIdentity(input: {
  orderReference: string;
  mobileE164: string;
}): Promise<CommerceTrackingIdentity> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_public_commerce_order_tracking_identity", {
    p_order_reference: input.orderReference,
    p_mobile_e164: input.mobileE164,
  });
  if (error) throw normalizeCommerceOrderError(error);
  return parseCommerceTrackingIdentity(data);
}

export async function getPublicCommerceOrderTrackingSnapshot(input: {
  orderReference: string;
}): Promise<CommerceTrackingSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_commerce_order_tracking_snapshot", {
    p_order_reference: input.orderReference,
  });
  if (error) throw normalizeCommerceOrderError(error);
  return parseCommerceTrackingSnapshot(data);
}
