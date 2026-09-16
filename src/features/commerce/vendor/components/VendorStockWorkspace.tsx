"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import type { VendorProductSummary } from "../vendor-queries";
import { setVendorInventoryQuantityAction, setVendorProductSalesStateAction } from "../vendor-actions";
import { VendorIcon } from "./VendorIcon";

const inputClass = "h-10 w-28 rounded-xl border border-[var(--vendor-border-strong)] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[var(--vendor-green)] focus:ring-2 focus:ring-[#456b50]/10";

export function VendorStockWorkspace({ products }: { products: readonly VendorProductSummary[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  if (products.length === 0) {
    return <div className="vendor-panel p-9 text-center"><VendorIcon name="stock" className="mx-auto h-9 w-9 text-[#998a7a]"/><p className="mt-3 text-sm font-medium">Add a product before managing stock.</p></div>;
  }

  return (
    <div className="space-y-4">
      {message ? <p role="status" className="rounded-xl border border-[#cad9cc] bg-[#edf4ed] px-4 py-3 text-sm font-medium text-[#3f6948]">{message}</p> : null}
      {products.map((product) => {
        const isReadyStock = product.availabilityMode === "ready_stock";
        const salesEnabled = product.vendor_sales_enabled;
        const image = buildCommercePublicUrl(product.primaryImagePath);
        const unavailable = !salesEnabled || product.vendor_stock_status === "out_of_stock";
        return (
          <article key={product.id} className="vendor-panel overflow-hidden">
            <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(260px,1fr)_minmax(460px,1.4fr)] xl:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#ece5dc]">
                  {image ? <div role="img" aria-label={product.name} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} /> : <div className="grid h-full place-items-center text-[#9b8c7d]"><VendorIcon name="package" className="h-7 w-7"/></div>}
                </div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{product.name}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${unavailable ? "bg-[#f5e6dc] text-[#a15d40]" : "bg-[#e4f1e6] text-[#356443]"}`}>{unavailable ? "Unavailable" : "Sales enabled"}</span></div><p className="mt-1 truncate text-[11px] text-[var(--od-muted)]">{product.sku} · {isReadyStock ? "Ready stock" : "Made to order"}</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#f7f2ec] px-3.5 py-3"><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)]">On hand</p><p className="mt-1 text-lg font-semibold">{isReadyStock ? product.stockOnHand : "MTO"}</p></div>
                <div className="rounded-xl bg-[#f7f2ec] px-3.5 py-3"><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)]">Reserved</p><p className="mt-1 text-lg font-semibold">{isReadyStock ? product.reservedQty : "—"}</p></div>
                <div className="rounded-xl bg-[#f7f2ec] px-3.5 py-3"><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)]">Available</p><p className="mt-1 text-lg font-semibold text-[var(--vendor-green)]">{isReadyStock ? product.availableQty : salesEnabled ? "Open" : "Paused"}</p></div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-[var(--vendor-border)] bg-[#fcf8f3] px-4 py-4 sm:px-5">
              {isReadyStock && product.variantId ? (
                <form className="flex flex-wrap items-end gap-2" action={async (formData) => {
                  const result = await setVendorInventoryQuantityAction(formData);
                  setMessage(result.message);
                  if (result.success) router.refresh();
                }}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="variantId" value={product.variantId} />
                  <label className="text-[11px] font-medium text-[var(--od-text-2)]">Stock quantity<input name="stockOnHand" type="number" min={product.reservedQty} max={1000000} defaultValue={product.stockOnHand} required className={`mt-1 block ${inputClass}`} /></label>
                  <button className="vendor-secondary-button h-10 min-h-10">Update quantity</button>
                </form>
              ) : null}

              <form action={async (formData) => {
                const result = await setVendorProductSalesStateAction(formData);
                setMessage(result.message);
                if (result.success) router.refresh();
              }}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="enabled" value={salesEnabled ? "false" : "true"} />
                <input type="hidden" name="stockStatus" value={product.vendor_stock_status} />
                <button className={salesEnabled ? "vendor-secondary-button h-10 min-h-10 text-[#a35f43]" : "vendor-primary-button h-10 min-h-10"}>{salesEnabled ? "Pause sales" : "Enable sales"}</button>
              </form>
              {isReadyStock ? (
                <form action={async (formData) => {
                  const result = await setVendorProductSalesStateAction(formData);
                  setMessage(result.message);
                  if (result.success) router.refresh();
                }}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="enabled" value="true" />
                  <input type="hidden" name="stockStatus" value={product.vendor_stock_status === "out_of_stock" ? "in_stock" : "out_of_stock"} />
                  <button disabled={product.vendor_stock_status === "out_of_stock" && product.availableQty <= 0} className="vendor-secondary-button h-10 min-h-10 disabled:cursor-not-allowed disabled:opacity-40">{product.vendor_stock_status === "out_of_stock" ? "Mark in stock" : "Mark out of stock"}</button>
                </form>
              ) : null}

              {isReadyStock && product.reservedQty > 0 ? <p className="w-full text-[11px] leading-5 text-[var(--od-muted)]">Stock cannot be reduced below {product.reservedQty} reserved unit{product.reservedQty === 1 ? "" : "s"} already committed to placed orders.</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
