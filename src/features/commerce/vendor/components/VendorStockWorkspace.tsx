"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VendorProductSummary } from "../vendor-queries";
import {
  setVendorInventoryQuantityAction,
  setVendorProductSalesStateAction,
} from "../vendor-actions";

const inputClass =
  "min-h-10 rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm outline-none focus:border-[var(--od-gold)]";

export function VendorStockWorkspace({ products }: { products: readonly VendorProductSummary[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-8 text-sm text-[var(--od-muted)]">
        Add a product before managing stock.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p role="status" className="rounded-lg border border-[var(--od-border)] bg-[var(--od-surface)] px-4 py-3 text-sm text-[var(--od-gold)]">
          {message}
        </p>
      ) : null}
      {products.map((product) => {
        const isReadyStock = product.availabilityMode === "ready_stock";
        const salesEnabled = product.vendor_sales_enabled;
        return (
          <article key={product.id} className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{product.name}</h2>
                <p className="mt-1 text-xs text-[var(--od-muted)]">
                  {product.product_reference} · {product.sku} · {isReadyStock ? "Ready stock" : "Made to order"}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs ${salesEnabled ? "border-emerald-400/30 text-emerald-200" : "border-amber-400/30 text-amber-200"}`}>
                {salesEnabled ? "Sales enabled" : "Sales paused"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--od-elevated)] p-3">
                <p className="text-[11px] text-[var(--od-muted)]">On hand</p>
                <p className="mt-1 text-lg font-semibold">{isReadyStock ? product.stockOnHand : "MTO"}</p>
              </div>
              <div className="rounded-lg bg-[var(--od-elevated)] p-3">
                <p className="text-[11px] text-[var(--od-muted)]">Reserved</p>
                <p className="mt-1 text-lg font-semibold">{isReadyStock ? product.reservedQty : "—"}</p>
              </div>
              <div className="rounded-lg bg-[var(--od-elevated)] p-3">
                <p className="text-[11px] text-[var(--od-muted)]">Available</p>
                <p className="mt-1 text-lg font-semibold">{isReadyStock ? product.availableQty : salesEnabled ? "Available" : "Paused"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {isReadyStock && product.variantId ? (
                <form className="flex flex-wrap items-end gap-2" action={async (formData) => {
                  const result = await setVendorInventoryQuantityAction(formData);
                  setMessage(result.message);
                  if (result.success) router.refresh();
                }}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="variantId" value={product.variantId} />
                  <label className="text-xs text-[var(--od-text-2)]">
                    Stock quantity
                    <input
                      name="stockOnHand"
                      type="number"
                      min={product.reservedQty}
                      max={1000000}
                      defaultValue={product.stockOnHand}
                      required
                      className={`mt-1 w-36 ${inputClass}`}
                    />
                  </label>
                  <button className="min-h-10 rounded-lg border border-[var(--od-border)] px-3 text-xs font-medium hover:bg-[var(--od-hover)]">
                    Update stock
                  </button>
                </form>
              ) : null}

              <form action={async (formData) => {
                const result = await setVendorProductSalesStateAction(formData);
                setMessage(result.message);
                if (result.success) router.refresh();
              }}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="enabled" value={salesEnabled ? "false" : "true"} />
                <input
                  type="hidden"
                  name="stockStatus"
                  value={product.vendor_stock_status}
                />
                <button className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${salesEnabled ? "border border-amber-400/30 text-amber-200" : "bg-[var(--od-gold)] text-black"}`}>
                  {salesEnabled ? "Pause sales" : "Enable sales"}
                </button>
              </form>

              {isReadyStock ? (
                <form action={async (formData) => {
                  const result = await setVendorProductSalesStateAction(formData);
                  setMessage(result.message);
                  if (result.success) router.refresh();
                }}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="enabled" value="true" />
                  <input
                    type="hidden"
                    name="stockStatus"
                    value={product.vendor_stock_status === "out_of_stock" ? "in_stock" : "out_of_stock"}
                  />
                  <button
                    disabled={product.vendor_stock_status === "out_of_stock" && product.availableQty <= 0}
                    className="min-h-10 rounded-lg border border-[var(--od-border)] px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {product.vendor_stock_status === "out_of_stock" ? "Mark in stock" : "Mark out of stock"}
                  </button>
                </form>
              ) : null}
            </div>
            {isReadyStock && product.reservedQty > 0 ? (
              <p className="mt-3 text-xs text-[var(--od-muted)]">
                Quantity cannot be reduced below {product.reservedQty} reserved unit{product.reservedQty === 1 ? "" : "s"}.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
