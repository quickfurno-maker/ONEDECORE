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

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm outline-none focus:border-[var(--od-gold)]";

export function VendorProductForm({ product }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="space-y-4 rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5" action={async (formData) => {
      const result = product ? await updateVendorProductAction(formData) : await createVendorProductAction(formData);
      setMessage(result.message);
      if (result.success && !product && result.data?.productId) {
        router.push(`/vendor/products/${result.data.productId}`);
        return;
      }
      if (result.success) router.refresh();
    }}>
      {product ? <><input type="hidden" name="productId" value={product.id} /><input type="hidden" name="lockVersion" value={product.lockVersion} /></> : null}
      <div><h2 className="text-sm font-semibold">Product details</h2><p className="mt-1 text-xs text-[var(--od-muted)]">OneDecore will handle category, tax, SEO and publishing after review.</p></div>
      <label className="block text-xs text-[var(--od-text-2)]">Product name<input name="name" required minLength={2} maxLength={200} defaultValue={product?.name ?? ""} className={inputClass} /></label>
      <label className="block text-xs text-[var(--od-text-2)]">SKU / vendor product code<input name="sku" required minLength={2} maxLength={64} defaultValue={product?.sku ?? ""} className={inputClass} /></label>
      <label className="block text-xs text-[var(--od-text-2)]">Selling price (₹)<input name="sellingPriceRupees" inputMode="decimal" required defaultValue={product ? (product.pricePaise / 100).toFixed(2) : ""} className={inputClass} /></label>
      <label className="block text-xs text-[var(--od-text-2)]">Stock mode<select name="stockStatus" required defaultValue={product?.stockStatus ?? "in_stock"} className={inputClass}><option value="in_stock">In stock</option><option value="made_to_order">Made to order</option><option value="out_of_stock">Out of stock</option></select></label>
      <label className="block text-xs text-[var(--od-text-2)]">Description<textarea name="description" required minLength={2} maxLength={4000} rows={6} defaultValue={product?.description ?? ""} className={`${inputClass} py-3`} /></label>
      {message ? <p role="status" className="text-sm text-[var(--od-gold)]">{message}</p> : null}
      <button type="submit" className="min-h-11 rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black">{product ? "Save changes" : "Create draft"}</button>
    </form>
  );
}
