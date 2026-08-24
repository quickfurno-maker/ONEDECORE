import "server-only";

import { CommerceOrderParseError } from "./order-errors.ts";
import type {
  CommerceCartQuote,
  CommerceCodOrderReceipt,
  CommerceQuoteLine,
  CommerceRateLimitResult,
  CommerceTrackingIdentity,
  CommerceTrackingSnapshot,
  CommerceTrackingSnapshotItem,
} from "./order-types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CommerceOrderParseError(context);
  }
  return value;
}

function optionalString(value: unknown, context: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new CommerceOrderParseError(context);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requireInt(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new CommerceOrderParseError(context);
  }
  return value;
}

function optionalInt(value: unknown, context: string): number | null {
  if (value == null) return null;
  return requireInt(value, context);
}

function requireBool(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") throw new CommerceOrderParseError(context);
  return value;
}

const INTERNAL_KEYS = [
  "stock_on_hand",
  "reserved_qty",
  "available_qty",
  "variant_id",
  "product_id",
  "tax_rate_id",
  "zone_code",
];

function assertNoInternalKeys(value: unknown, context: string): void {
  if (!isRecord(value)) return;
  for (const key of INTERNAL_KEYS) {
    if (key in value) throw new CommerceOrderParseError(`${context}.${key}`);
  }
}

function parseOptionValues(value: unknown, context: string): Record<string, string> {
  if (value == null) return {};
  if (!isRecord(value)) throw new CommerceOrderParseError(context);
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") throw new CommerceOrderParseError(context);
    out[key] = item;
  }
  return out;
}

function parseQuoteLine(value: unknown, context: string): CommerceQuoteLine {
  if (!isRecord(value)) throw new CommerceOrderParseError(context);
  assertNoInternalKeys(value, context);
  const mode = requireString(value.availability_mode, `${context}.availability_mode`);
  if (mode !== "ready_stock" && mode !== "made_to_order") {
    throw new CommerceOrderParseError(`${context}.availability_mode`);
  }
  return {
    sku: requireString(value.sku, `${context}.sku`),
    quantity: requireInt(value.quantity, `${context}.quantity`),
    productName: requireString(value.product_name, `${context}.product_name`),
    productSlug: requireString(value.product_slug, `${context}.product_slug`),
    variantDisplayName: optionalString(value.variant_display_name, `${context}.variant_display_name`),
    optionValues: parseOptionValues(value.option_values, `${context}.option_values`),
    primaryImagePublicPath: optionalString(
      value.primary_image_public_path,
      `${context}.primary_image_public_path`
    ),
    sellingUnitPricePaise: requireInt(value.selling_unit_price_paise, `${context}.selling`),
    compareAtUnitPricePaise: optionalInt(value.compare_at_unit_price_paise, `${context}.compare`),
    discountPaise: requireInt(value.discount_paise, `${context}.discount`),
    lineTotalPaise: requireInt(value.line_total_paise, `${context}.line_total`),
    taxPaise: requireInt(value.tax_paise, `${context}.tax`),
    availabilityMode: mode,
    canFulfil: requireBool(value.can_fulfil, `${context}.can_fulfil`),
  };
}

export function parseCommerceCartQuote(value: unknown): CommerceCartQuote {
  if (!isRecord(value)) throw new CommerceOrderParseError("quote");
  assertNoInternalKeys(value, "quote");
  if (!Array.isArray(value.lines)) throw new CommerceOrderParseError("quote.lines");
  return {
    lines: value.lines.map((line, index) => parseQuoteLine(line, `quote.lines.${index}`)),
    subtotalPaise: requireInt(value.subtotal_paise, "quote.subtotal"),
    discountPaise: requireInt(value.discount_paise, "quote.discount"),
    taxPaise: requireInt(value.tax_paise, "quote.tax"),
    shippingPaise: requireInt(value.shipping_paise, "quote.shipping"),
    totalPaise: requireInt(value.total_paise, "quote.total"),
    pincode: requireString(value.pincode, "quote.pincode"),
    serviceable: requireBool(value.serviceable, "quote.serviceable")
      ? true
      : (() => {
          throw new CommerceOrderParseError("quote.serviceable");
        })(),
    etaMinDays: requireInt(value.eta_min_days, "quote.eta_min"),
    etaMaxDays: requireInt(value.eta_max_days, "quote.eta_max"),
    assemblyInstallNote: optionalString(value.assembly_install_note, "quote.assembly"),
    codAllowed: requireBool(value.cod_allowed, "quote.cod"),
  };
}

export function parseCommerceCodOrderReceipt(value: unknown): CommerceCodOrderReceipt {
  if (!isRecord(value)) throw new CommerceOrderParseError("cod");
  const status = requireString(value.status, "cod.status");
  if (status !== "confirmed") throw new CommerceOrderParseError("cod.status");
  return {
    orderReference: requireString(value.order_reference, "cod.order_reference"),
    status,
    totalPaise: requireInt(value.total_paise, "cod.total"),
  };
}

export function parseCommerceRateLimitResult(value: unknown): CommerceRateLimitResult {
  if (!isRecord(value)) throw new CommerceOrderParseError("rate_limit");
  return {
    allowed: requireBool(value.allowed, "rate_limit.allowed"),
    retryAfterSeconds: requireInt(value.retry_after_seconds, "rate_limit.retry"),
  };
}

export function parseCommerceTrackingIdentity(value: unknown): CommerceTrackingIdentity {
  if (!isRecord(value)) throw new CommerceOrderParseError("track");
  return { matched: requireBool(value.matched, "track.matched") };
}

function parseTrackingItem(value: unknown, context: string): CommerceTrackingSnapshotItem {
  if (!isRecord(value)) throw new CommerceOrderParseError(context);
  const mode = requireString(value.availability_mode, `${context}.availability_mode`);
  if (mode !== "ready_stock" && mode !== "made_to_order") {
    throw new CommerceOrderParseError(`${context}.availability_mode`);
  }
  return {
    lineNumber: requireInt(value.line_number, `${context}.line_number`),
    productName: requireString(value.product_name, `${context}.product_name`),
    productSlug: requireString(value.product_slug, `${context}.product_slug`),
    sku: requireString(value.sku, `${context}.sku`),
    variantDisplayName: optionalString(value.variant_display_name, `${context}.variant_display_name`),
    quantity: requireInt(value.quantity, `${context}.quantity`),
    sellingUnitPricePaise: requireInt(value.selling_unit_price_paise, `${context}.selling`),
    lineTotalPaise: requireInt(value.line_total_paise, `${context}.line_total`),
    availabilityMode: mode,
    primaryImagePublicPath: optionalString(value.primary_image_public_path, `${context}.image`),
  };
}

export function parseCommerceTrackingSnapshot(value: unknown): CommerceTrackingSnapshot {
  if (!isRecord(value)) throw new CommerceOrderParseError("snapshot");
  assertNoInternalKeys(value, "snapshot");
  if (!Array.isArray(value.items)) throw new CommerceOrderParseError("snapshot.items");
  const delivery = value.delivery;
  if (!isRecord(delivery)) throw new CommerceOrderParseError("snapshot.delivery");
  return {
    orderReference: requireString(value.order_reference, "snapshot.order_reference"),
    status: requireString(value.status, "snapshot.status"),
    paymentMethod: requireString(value.payment_method, "snapshot.payment_method"),
    currency: requireString(value.currency, "snapshot.currency"),
    createdAt: requireString(value.created_at, "snapshot.created_at"),
    confirmedAt: optionalString(value.confirmed_at, "snapshot.confirmed_at"),
    processingAt: optionalString(value.processing_at, "snapshot.processing_at"),
    shippedAt: optionalString(value.shipped_at, "snapshot.shipped_at"),
    deliveredAt: optionalString(value.delivered_at, "snapshot.delivered_at"),
    cancelledAt: optionalString(value.cancelled_at, "snapshot.cancelled_at"),
    subtotalPaise: requireInt(value.subtotal_paise, "snapshot.subtotal"),
    discountPaise: requireInt(value.discount_paise, "snapshot.discount"),
    taxPaise: requireInt(value.tax_paise, "snapshot.tax"),
    shippingPaise: requireInt(value.shipping_paise, "snapshot.shipping"),
    totalPaise: requireInt(value.total_paise, "snapshot.total"),
    fulfilmentTrackingReference: optionalString(
      value.fulfilment_tracking_reference,
      "snapshot.tracking_ref"
    ),
    items: value.items.map((line, index) => parseTrackingItem(line, `snapshot.items.${index}`)),
    delivery: {
      recipientName: requireString(delivery.recipient_name, "snapshot.delivery.recipient"),
      mobileE164: requireString(delivery.mobile_e164, "snapshot.delivery.mobile"),
      email: optionalString(delivery.email, "snapshot.delivery.email"),
      addressLine1: requireString(delivery.address_line_1, "snapshot.delivery.line1"),
      addressLine2: optionalString(delivery.address_line_2, "snapshot.delivery.line2"),
      locality: requireString(delivery.locality, "snapshot.delivery.locality"),
      city: requireString(delivery.city, "snapshot.delivery.city"),
      state: requireString(delivery.state, "snapshot.delivery.state"),
      pincode: requireString(delivery.pincode, "snapshot.delivery.pincode"),
      shippingChargePaise: requireInt(delivery.shipping_charge_paise, "snapshot.delivery.ship"),
      etaMinDays: requireInt(delivery.eta_min_days, "snapshot.delivery.eta_min"),
      etaMaxDays: requireInt(delivery.eta_max_days, "snapshot.delivery.eta_max"),
      assemblyInstallNote: optionalString(delivery.assembly_install_note, "snapshot.delivery.note"),
    },
  };
}
