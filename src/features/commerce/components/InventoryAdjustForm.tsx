"use client";

import { useState } from "react";
import { adjustCommerceInventoryAction } from "../server/commerce-actions";
import type { CommerceInventoryRow, CommerceVariantRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function InventoryAdjustForm({
  productId,
  variants,
  inventory,
}: {
  readonly productId: string;
  readonly variants: readonly CommerceVariantRow[];
  readonly inventory: readonly CommerceInventoryRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await adjustCommerceInventoryAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Adjust inventory</h2>
      <input type="hidden" name="productId" value={productId} />
      <label className="block text-xs text-neutral-400">
        Variant
        <select name="variantId" required className={inputClass}>
          <option value="">Select variant</option>
          {variants.map((variant) => {
            const stock = inventory.find((row) => row.variant_id === variant.id);
            return (
              <option key={variant.id} value={variant.id}>
                {variant.sku} — on hand {stock?.stock_on_hand ?? 0}, reserved {stock?.reserved_qty ?? 0}
              </option>
            );
          })}
        </select>
      </label>
      <label className="block text-xs text-neutral-400">
        Delta (integer)
        <input name="delta" type="number" step={1} required className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Reason
        <input name="reason" required minLength={1} maxLength={80} className={inputClass} />
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
        Apply adjustment
      </button>
    </form>
  );
}
