import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertCommerceMaybeRow, assertCommerceReadList } from "../domain/commerce-read.ts";

export type CommerceOrderListRow = {
  id: string;
  orderReference: string;
  status: string;
  paymentMethod: string;
  customerName: string;
  customerMobileE164: string;
  totalPaise: number;
  createdAt: string;
};

export type CommerceOrderEventRow = {
  id: string;
  eventCode: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorKind: string;
  createdAt: string;
};

export type CommerceOrderDetail = CommerceOrderListRow & {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  confirmedAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  fulfilmentTrackingReference: string | null;
  cancellationReasonCode: string | null;
  items: Array<{
    id: string;
    lineNumber: number;
    productName: string;
    sku: string;
    quantity: number;
    sellingUnitPricePaise: number;
    lineTotalPaise: number;
    availabilityMode: string;
  }>;
  delivery: {
    recipientName: string;
    mobileE164: string;
    email: string | null;
    addressLine1: string;
    addressLine2: string | null;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    etaMinDays: number;
    etaMaxDays: number;
    assemblyInstallNote: string | null;
  } | null;
  events: CommerceOrderEventRow[];
};

import { maskCommerceOrderMobile } from "../domain/order-display.ts";

export { maskCommerceOrderMobile };

export async function listCommerceOrders(input?: {
  status?: string | null;
  search?: string | null;
  limit?: number;
}): Promise<CommerceOrderListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("commerce_orders")
    .select(
      "id,order_reference,status,payment_method,customer_name,customer_mobile_e164,total_paise,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(input?.limit ?? 50, 100));

  if (input?.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }
  if (input?.search?.trim()) {
    const term = input.search.trim().slice(0, 80);
    query = query.or(`order_reference.ilike.%${term}%,customer_name.ilike.%${term}%`);
  }

  const { data, error } = await query;
  const rows = assertCommerceReadList({ data, error }, "orders");
  return rows.map((row) => ({
    id: row.id,
    orderReference: row.order_reference,
    status: row.status,
    paymentMethod: row.payment_method,
    customerName: row.customer_name,
    customerMobileE164: row.customer_mobile_e164,
    totalPaise: row.total_paise,
    createdAt: row.created_at,
  }));
}

export async function getCommerceOrderDetail(orderId: string): Promise<CommerceOrderDetail | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("commerce_orders")
    .select(
      "id,order_reference,status,payment_method,customer_name,customer_mobile_e164,subtotal_paise,discount_paise,tax_paise,shipping_paise,total_paise,created_at,confirmed_at,processing_at,shipped_at,delivered_at,cancelled_at,fulfilment_tracking_reference,cancellation_reason_code"
    )
    .eq("id", orderId)
    .maybeSingle();
  assertCommerceMaybeRow({ error, data: order }, "order");
  if (!order) return null;

  const [itemsRes, deliveryRes, eventsRes] = await Promise.all([
    supabase
      .from("commerce_order_items")
      .select("id,line_number,product_name,sku,quantity,selling_unit_price_paise,line_total_paise,availability_mode")
      .eq("order_id", orderId)
      .order("line_number"),
    supabase
      .from("commerce_order_delivery")
      .select(
        "recipient_name,mobile_e164,email,address_line_1,address_line_2,locality,city,state,pincode,eta_min_days,eta_max_days,assembly_install_note"
      )
      .eq("order_id", orderId)
      .maybeSingle(),
    supabase
      .from("commerce_order_events")
      .select("id,event_code,from_status,to_status,actor_kind,created_at")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);
  const items = assertCommerceReadList(itemsRes, "order_items");
  const delivery = assertCommerceMaybeRow(deliveryRes, "order_delivery");
  const events = assertCommerceReadList(eventsRes, "order_events");

  return {
    id: order.id,
    orderReference: order.order_reference,
    status: order.status,
    paymentMethod: order.payment_method,
    customerName: order.customer_name,
    customerMobileE164: order.customer_mobile_e164,
    subtotalPaise: order.subtotal_paise,
    discountPaise: order.discount_paise,
    taxPaise: order.tax_paise,
    shippingPaise: order.shipping_paise,
    totalPaise: order.total_paise,
    createdAt: order.created_at,
    confirmedAt: order.confirmed_at,
    processingAt: order.processing_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
    fulfilmentTrackingReference: order.fulfilment_tracking_reference,
    cancellationReasonCode: order.cancellation_reason_code,
    items: items.map((row) => ({
      id: row.id,
      lineNumber: row.line_number,
      productName: row.product_name,
      sku: row.sku,
      quantity: row.quantity,
      sellingUnitPricePaise: row.selling_unit_price_paise,
      lineTotalPaise: row.line_total_paise,
      availabilityMode: row.availability_mode,
    })),
    delivery: delivery
      ? {
          recipientName: delivery.recipient_name,
          mobileE164: delivery.mobile_e164,
          email: delivery.email,
          addressLine1: delivery.address_line_1,
          addressLine2: delivery.address_line_2,
          locality: delivery.locality,
          city: delivery.city,
          state: delivery.state,
          pincode: delivery.pincode,
          etaMinDays: delivery.eta_min_days,
          etaMaxDays: delivery.eta_max_days,
          assemblyInstallNote: delivery.assembly_install_note,
        }
      : null,
    events: events.map((row) => ({
      id: row.id,
      eventCode: row.event_code,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actorKind: row.actor_kind,
      createdAt: row.created_at,
    })),
  };
}
