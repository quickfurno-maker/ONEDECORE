"use client";

import Link from "next/link";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { CommerceOrderListRow } from "../server/order-admin-queries.ts";
import { maskCommerceOrderMobile } from "../domain/order-display.ts";

export function CommerceOrdersListView({
  orders,
  canManageOrders,
}: {
  readonly orders: CommerceOrderListRow[];
  readonly canManageOrders: boolean;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-[var(--od-muted)]">No orders yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--od-muted)]">
            <th className="py-2 pr-4">Reference</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Total</th>
            <th className="py-2 pr-4">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-[var(--od-border)]">
              <td className="py-3 pr-4">
                <Link href={`/admin/commerce/orders/${order.id}`} className="text-[var(--od-gold)]">
                  {order.orderReference}
                </Link>
              </td>
              <td className="py-3 pr-4">{order.status}</td>
              <td className="py-3 pr-4">
                {order.customerName}
                <span className="block text-[var(--od-muted)]">
                  {maskCommerceOrderMobile(order.customerMobileE164)}
                </span>
              </td>
              <td className="py-3 pr-4">{formatInrFromPaise(order.totalPaise)}</td>
              <td className="py-3 pr-4">{new Date(order.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!canManageOrders ? (
        <p className="mt-3 text-xs text-[var(--od-muted)]">Read-only view.</p>
      ) : null}
    </div>
  );
}
