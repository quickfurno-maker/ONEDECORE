"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeCommerceOrderError } from "../orders/order-errors.ts";
import { probeCommercePermissions } from "./commerce-permissions.ts";

export type OrderMutationState =
  | { status: "idle" }
  | { status: "forbidden" }
  | { status: "invalid" }
  | { status: "error"; message: string }
  | { status: "ok" };

const STAFF_ORDER_ERROR_COPY: Record<string, string> = {
  COMMERCE_ORDER_TRANSITION_INVALID: "That status change is not allowed.",
  COMMERCE_UNAUTHORIZED: "Not authorized.",
  IDEMPOTENCY_KEY_REUSED: "This action was already submitted.",
  COMMERCE_INVENTORY_UNAVAILABLE: "Inventory is no longer available for this change.",
};

function staffSafeOrderError(code: string): string {
  return STAFF_ORDER_ERROR_COPY[code] ?? "The order could not be updated. Please try again.";
}

const CANCEL_REASONS = new Set(["customer_request", "out_of_stock", "fraud_review", "other"]);

function bounded(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

async function requireOrdersManage(): Promise<boolean> {
  const permissions = await probeCommercePermissions();
  return permissions.canManageOrders;
}

export async function transitionCommerceOrderAction(
  _prev: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  if (!(await requireOrdersManage())) return { status: "forbidden" };
  const orderId = bounded(formData.get("orderId"), 64);
  const toStatus = bounded(formData.get("toStatus"), 32);
  const trackingRef = bounded(formData.get("trackingReference"), 80);
  const idempotencyKey = bounded(formData.get("idempotencyKey"), 64);
  if (!orderId || !toStatus || !/^[0-9a-f-]{36}$/.test(idempotencyKey)) {
    return { status: "invalid" };
  }
  if (toStatus === "shipped" && trackingRef.length < 2) {
    return { status: "invalid" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_commerce_order_fulfilment", {
      p_order_id: orderId,
      p_to_status: toStatus,
      p_fulfilment_tracking_reference: trackingRef || "",
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw normalizeCommerceOrderError(error);
    revalidatePath("/admin/commerce/orders");
    revalidatePath(`/admin/commerce/orders/${orderId}`);
    return { status: "ok" };
  } catch (error) {
    const normalized = normalizeCommerceOrderError(error);
    return { status: "error", message: staffSafeOrderError(normalized.code) };
  }
}

export async function cancelCommerceOrderAction(
  _prev: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  if (!(await requireOrdersManage())) return { status: "forbidden" };
  const orderId = bounded(formData.get("orderId"), 64);
  const reasonCode = bounded(formData.get("reasonCode"), 40);
  const idempotencyKey = bounded(formData.get("idempotencyKey"), 64);
  if (!orderId || !CANCEL_REASONS.has(reasonCode) || !/^[0-9a-f-]{36}$/.test(idempotencyKey)) {
    return { status: "invalid" };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_commerce_order", {
      p_order_id: orderId,
      p_reason_code: reasonCode,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw normalizeCommerceOrderError(error);
    revalidatePath("/admin/commerce/orders");
    revalidatePath(`/admin/commerce/orders/${orderId}`);
    return { status: "ok" };
  } catch (error) {
    const normalized = normalizeCommerceOrderError(error);
    return { status: "error", message: staffSafeOrderError(normalized.code) };
  }
}
