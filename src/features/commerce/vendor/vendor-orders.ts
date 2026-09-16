import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface VendorOrderItem {
  readonly lineNumber: number;
  readonly productId: string;
  readonly productReference: string;
  readonly productName: string;
  readonly sku: string;
  readonly variantDisplayName: string | null;
  readonly quantity: number;
  readonly sellingUnitPricePaise: number;
  readonly lineTotalPaise: number;
  readonly availabilityMode: string;
  readonly primaryImagePublicPath: string | null;
}

export interface VendorOrderEvent {
  readonly eventCode: string;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly createdAt: string;
}

export interface VendorOrderSummary {
  readonly orderId: string;
  readonly orderReference: string;
  readonly status: string;
  readonly paymentMethod: string;
  readonly placedAt: string;
  readonly processingAt: string | null;
  readonly shippedAt: string | null;
  readonly deliveredAt: string | null;
  readonly cancelledAt: string | null;
  readonly trackingReference: string | null;
  readonly items: readonly VendorOrderItem[];
  readonly events: readonly VendorOrderEvent[];
  readonly units: number;
  readonly vendorLineTotalPaise: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed vendor order ${field}`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`Malformed vendor order ${field}`);
  return value;
}
function parseItem(value: unknown): VendorOrderItem {
  if (!isRecord(value)) throw new Error("Malformed vendor order item");
  return {
    lineNumber: integerValue(value.line_number, "item.line_number"),
    productId: stringValue(value.product_id, "item.product_id"),
    productReference: stringValue(value.product_reference, "item.product_reference"),
    productName: stringValue(value.product_name, "item.product_name"),
    sku: stringValue(value.sku, "item.sku"),
    variantDisplayName: nullableString(value.variant_display_name),
    quantity: integerValue(value.quantity, "item.quantity"),
    sellingUnitPricePaise: integerValue(value.selling_unit_price_paise, "item.selling_unit_price_paise"),
    lineTotalPaise: integerValue(value.line_total_paise, "item.line_total_paise"),
    availabilityMode: stringValue(value.availability_mode, "item.availability_mode"),
    primaryImagePublicPath: nullableString(value.primary_image_public_path),
  };
}

function parseEvent(value: unknown): VendorOrderEvent {
  if (!isRecord(value)) throw new Error("Malformed vendor order event");
  return {
    eventCode: stringValue(value.event_code, "event.event_code"),
    fromStatus: nullableString(value.from_status),
    toStatus: nullableString(value.to_status),
    createdAt: stringValue(value.created_at, "event.created_at"),
  };
}
function parseOrder(value: unknown): VendorOrderSummary {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.events)) {
    throw new Error("Malformed vendor order payload");
  }
  const items = value.items.map(parseItem);
  const events = value.events.map(parseEvent);
  return {
    orderId: stringValue(value.order_id, "order_id"),
    orderReference: stringValue(value.order_reference, "order_reference"),
    status: stringValue(value.status, "status"),
    paymentMethod: stringValue(value.payment_method, "payment_method"),
    placedAt: stringValue(value.placed_at, "placed_at"),
    processingAt: nullableString(value.processing_at),
    shippedAt: nullableString(value.shipped_at),
    deliveredAt: nullableString(value.delivered_at),
    cancelledAt: nullableString(value.cancelled_at),
    trackingReference: nullableString(value.tracking_reference),
    items,
    events,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    vendorLineTotalPaise: items.reduce((sum, item) => sum + item.lineTotalPaise, 0),
  };
}

export async function listMyVendorOrders(limit = 50): Promise<readonly VendorOrderSummary[]> {
  const supabase = await createClient();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { data, error } = await supabase.rpc("list_my_vendor_commerce_orders", { p_limit: safeLimit });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Malformed vendor order list");
  return data.map(parseOrder);
}
