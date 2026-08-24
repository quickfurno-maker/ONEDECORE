"use client";

import { useRef, useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import {
  cancelCommerceOrderAction,
  transitionCommerceOrderAction,
  type OrderMutationState,
} from "../server/order-admin-actions.ts";
import type { CommerceOrderDetail } from "../server/order-admin-queries.ts";
import { maskCommerceOrderMobile } from "../domain/order-display.ts";

export function CommerceOrderDetailPanel({
  order,
  canManageOrders,
}: {
  readonly order: CommerceOrderDetail;
  readonly canManageOrders: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [trackingRef, setTrackingRef] = useState(order.fulfilmentTrackingReference ?? "");
  const idempotencyRef = useRef(crypto.randomUUID());

  async function runMutation(
    action: (_prev: OrderMutationState, formData: FormData) => Promise<OrderMutationState>,
    formData: FormData
  ) {
    formData.set("orderId", order.id);
    formData.set("idempotencyKey", idempotencyRef.current);
    const result = await action({ status: "idle" }, formData);
    if (result.status === "ok") {
      setMessage("Updated.");
      idempotencyRef.current = crypto.randomUUID();
    } else if (result.status === "error") {
      setMessage(result.message);
    } else if (result.status === "forbidden") {
      setMessage("Not authorized.");
    } else {
      setMessage("Invalid action.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">{order.orderReference}</h2>
        <p className="text-sm text-[var(--od-muted)]">
          {order.status} · {order.paymentMethod.toUpperCase()} ·{" "}
          {formatInrFromPaise(order.totalPaise)}
        </p>
        <p className="text-sm">
          {order.customerName} · {maskCommerceOrderMobile(order.customerMobileE164)}
        </p>
      </div>
      <section>
        <h3 className="font-medium">Items</h3>
        <ul className="text-sm">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.productName} ({item.sku}) × {item.quantity} —{" "}
              {formatInrFromPaise(item.lineTotalPaise)}
            </li>
          ))}
        </ul>
      </section>
      {order.delivery ? (
        <section>
          <h3 className="font-medium">Delivery snapshot</h3>
          <p className="text-sm">
            {order.delivery.recipientName}, {order.delivery.addressLine1}, {order.delivery.locality},{" "}
            {order.delivery.city} — {order.delivery.pincode}
          </p>
        </section>
      ) : null}
      <section>
        <h3 className="font-medium">Events</h3>
        <ul className="text-sm text-[var(--od-muted)]">
          {order.events.map((event) => (
            <li key={event.id}>
              {event.eventCode} · {new Date(event.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
      {canManageOrders ? (
        <section className="space-y-3">
          <h3 className="font-medium">Fulfilment</h3>
          {order.status === "confirmed" ? (
            <form action={(fd) => runMutation(transitionCommerceOrderAction, fd)}>
              <input type="hidden" name="toStatus" value="processing" />
              <button type="submit" className="rounded border px-3 py-2 text-sm">
                Mark processing
              </button>
            </form>
          ) : null}
          {order.status === "processing" ? (
            <form
              action={(fd) => {
                fd.set("trackingReference", trackingRef);
                return runMutation(transitionCommerceOrderAction, fd);
              }}
              className="space-y-2"
            >
              <input type="hidden" name="toStatus" value="shipped" />
              <label className="block text-sm">
                Tracking reference
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={trackingRef}
                  onChange={(event) => setTrackingRef(event.target.value)}
                  required
                  maxLength={80}
                />
              </label>
              <button type="submit" className="rounded border px-3 py-2 text-sm">
                Mark shipped
              </button>
            </form>
          ) : null}
          {order.status === "shipped" ? (
            <form action={(fd) => runMutation(transitionCommerceOrderAction, fd)}>
              <input type="hidden" name="toStatus" value="delivered" />
              <button type="submit" className="rounded border px-3 py-2 text-sm">
                Mark delivered
              </button>
            </form>
          ) : null}
          {order.status === "confirmed" || order.status === "processing" ? (
            <form
              action={(fd) => runMutation(cancelCommerceOrderAction, fd)}
              className="space-y-2 border-t pt-3"
            >
              <label className="block text-sm">
                Cancellation reason
                <select name="reasonCode" className="mt-1 w-full rounded border px-2 py-1" required>
                  <option value="customer_request">Customer request</option>
                  <option value="out_of_stock">Out of stock</option>
                  <option value="fraud_review">Fraud review</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button type="submit" className="rounded border px-3 py-2 text-sm">
                Cancel order
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      {message ? (
        <p className="text-sm" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
