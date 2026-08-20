"use client";

import { useState } from "react";
import { setCommerceVariantStatusAction, upsertCommerceProductVariantAction } from "../server/commerce-actions";
import type { CommerceVariantRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

interface VariantFormProps {
  readonly productId: string;
  readonly variant?: CommerceVariantRow;
}

export function VariantForm({ productId, variant }: VariantFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const options = variant?.option_values ?? {};

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <form
        className="space-y-3"
        action={async (formData) => {
          const result = await upsertCommerceProductVariantAction(formData);
          setMessage(result.message);
        }}
      >
        <h2 className="text-sm font-semibold text-neutral-100">
          {variant ? `Variant ${variant.sku}` : "Add variant"}
        </h2>
        <input type="hidden" name="productId" value={productId} />
        {variant ? <input type="hidden" name="id" value={variant.id} /> : null}
        <label className="block text-xs text-neutral-400">
          SKU (lowercase)
          <input name="sku" required defaultValue={variant?.sku ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Display name
          <input name="displayName" defaultValue={variant?.display_name ?? ""} className={inputClass} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            Color
            <input name="color" defaultValue={options.color ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs text-neutral-400">
            Finish
            <input name="finish" defaultValue={options.finish ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs text-neutral-400">
            Size
            <input name="size" defaultValue={options.size ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs text-neutral-400">
            Upholstery
            <input name="upholstery" defaultValue={options.upholstery ?? ""} className={inputClass} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            Selling price (paise)
            <input
              name="sellingPricePaise"
              type="number"
              step={1}
              min={0}
              required
              defaultValue={variant?.selling_price_paise ?? 0}
              className={inputClass}
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Compare-at (paise)
            <input
              name="compareAtPricePaise"
              type="number"
              step={1}
              min={0}
              defaultValue={variant?.compare_at_price_paise ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-xs text-neutral-400">
          Availability
          <select name="availabilityMode" defaultValue={variant?.availability_mode ?? "ready_stock"} className={inputClass}>
            <option value="ready_stock">ready_stock</option>
            <option value="made_to_order">made_to_order</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Sort order
          <input name="sortOrder" type="number" step={1} defaultValue={variant?.sort_order ?? 0} className={inputClass} />
        </label>
        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-amber-200">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950"
        >
          {variant ? "Save variant" : "Create variant"}
        </button>
      </form>
      {variant ? (
        <form
          action={async (formData) => {
            const result = await setCommerceVariantStatusAction(formData);
            setMessage(result.message);
          }}
        >
          <input type="hidden" name="id" value={variant.id} />
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value={variant.status === "archived" ? "active" : "archived"} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200"
          >
            {variant.status === "archived" ? "Reactivate variant" : "Archive variant"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
