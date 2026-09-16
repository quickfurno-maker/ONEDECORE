"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVendorProductAction, updateVendorProductAction } from "../vendor-actions";

interface Props {
  readonly product?: {
    id: string;
    name: string;
    description: string;
    sku: string;
    pricePaise: number;
    stockStatus: string;
    lockVersion: number;
  };
}

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--vendor-border-strong)] bg-white px-3.5 text-sm text-[var(--od-text)] outline-none transition placeholder:text-[#aaa198] focus:border-[var(--vendor-green)] focus:ring-2 focus:ring-[#456b50]/10";
const labelClass = "block text-xs font-medium text-[var(--od-text-2)]";

export function VendorProductForm({ product }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="vendor-panel overflow-hidden" action={async (formData) => {
      const result = product ? await updateVendorProductAction(formData) : await createVendorProductAction(formData);
      setMessage(result.message);
      if (result.success && !product && result.data?.productId) {
        router.push(`/vendor/products/${result.data.productId}`);
        return;
      }
      if (result.success) router.refresh();
    }}>
      {product ? <><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="lockVersion" value={product.lockVersion} /></> : null}
      <div className="border-b border-[var(--vendor-border)] px-5 py-4 sm:px-6"><h2 className="text-base font-semibold">Product details</h2><p className="mt-1 text-xs leading-5 text-[var(--od-muted)]">Keep the information clear and customer-ready. OneDecore handles category, tax, SEO, shipping and publication.</p></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <label className={`${labelClass} sm:col-span-2`}>Product name<input name="name" required minLength={2} maxLength={200} defaultValue={product?.name ?? ""} placeholder="e.g. Solid wood dining table" className={inputClass} /></label>
        <label className={labelClass}>SKU / vendor product code<input name="sku" required minLength={2} maxLength={64} defaultValue={product?.sku ?? ""} placeholder="e.g. kd-dt-001" className={inputClass} /></label>
        <label className={labelClass}>Selling price (₹)<input name="sellingPriceRupees" inputMode="decimal" required defaultValue={product ? (product.pricePaise / 100).toFixed(2) : ""} placeholder="0.00" className={inputClass} /></label>
        <label className={labelClass}>Stock mode<select name="stockStatus" required defaultValue={product?.stockStatus ?? "in_stock"} className={inputClass}><option value="in_stock">Ready stock</option><option value="made_to_order">Made to order</option><option value="out_of_stock">Out of stock</option></select></label>
        <div className="hidden sm:block" />
        <label className={`${labelClass} sm:col-span-2`}>Description<textarea name="description" required minLength={2} maxLength={4000} rows={7} defaultValue={product?.description ?? ""} placeholder="Describe material, finish, size, use and key product details." className={`${inputClass} resize-y py-3 leading-6`} /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--vendor-border)] bg-[#fcf8f3] px-5 py-4 sm:px-6">
        {message ? <p role="status" className="text-sm font-medium text-[var(--vendor-green)]">{message}</p> : <p className="text-xs text-[var(--od-muted)]">You can add photos after creating the draft.</p>}
        <button type="submit" className="vendor-primary-button">{product ? "Save changes" : "Create draft"}</button>
      </div>
    </form>
  );
}
