import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { CommerceTrackingSnapshot } from "../../orders/order-types.ts";

const STEPS = ["confirmed", "processing", "shipped", "delivered"] as const;

export function ShopOrderSnapshotView({ snapshot }: { readonly snapshot: CommerceTrackingSnapshot }) {
  const activeIndex = STEPS.indexOf(snapshot.status as (typeof STEPS)[number]);

  return (
    <div className="od-shop-order">
      <p className="od-shop__kicker">Order {snapshot.orderReference}</p>
      <h1 className="od-shop__title">Order status</h1>
      <p className="od-shop-note">Payment: {snapshot.paymentMethod.toUpperCase()}</p>
      <ol className="od-shop-order__timeline" aria-label="Order status timeline">
        {STEPS.map((step, index) => {
          const reached =
            snapshot.status === "cancelled"
              ? step === "confirmed"
              : activeIndex >= index || snapshot.status === step;
          return (
            <li
              key={step}
              aria-current={snapshot.status === step ? "step" : undefined}
              data-reached={reached ? "true" : undefined}
            >
              <span>{step.replace("_", " ")}</span>
            </li>
          );
        })}
      </ol>
      {snapshot.status === "cancelled" ? (
        <p className="od-shop__error" role="status">
          This order was cancelled.
        </p>
      ) : null}
      <section>
        <h2>Items</h2>
        <ul>
          {snapshot.items.map((item) => (
            <li key={item.lineNumber}>
              {item.productName} × {item.quantity} — {formatInrFromPaise(item.lineTotalPaise)}
            </li>
          ))}
        </ul>
        <p>
          Total {formatInrFromPaise(snapshot.totalPaise)} · Shipping included{" "}
          {formatInrFromPaise(snapshot.shippingPaise)}
        </p>
      </section>
      <section>
        <h2>Delivery</h2>
        <p>
          {snapshot.delivery.recipientName}, {snapshot.delivery.addressLine1}
          {snapshot.delivery.addressLine2 ? `, ${snapshot.delivery.addressLine2}` : ""},{" "}
          {snapshot.delivery.locality}, {snapshot.delivery.city}, {snapshot.delivery.state} —{" "}
          {snapshot.delivery.pincode}
        </p>
        <p className="od-shop-note">
          ETA {snapshot.delivery.etaMinDays}–{snapshot.delivery.etaMaxDays} days
          {snapshot.delivery.assemblyInstallNote ? ` · ${snapshot.delivery.assemblyInstallNote}` : ""}
        </p>
        {snapshot.fulfilmentTrackingReference ? (
          <p>Tracking reference: {snapshot.fulfilmentTrackingReference}</p>
        ) : null}
      </section>
    </div>
  );
}
