"use client";

import { useState } from "react";
import { replaceCommerceProductSpecificationsAction } from "../server/commerce-actions";
import type { CommerceSpecRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100";

export function SpecsForm({
  productId,
  specifications,
}: {
  readonly productId: string;
  readonly specifications: readonly CommerceSpecRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const defaultJson = JSON.stringify(
    specifications.map((row) => ({
      key: row.specification_key,
      value: row.specification_value,
      sort_order: row.sort_order,
    })),
    null,
    2
  );

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await replaceCommerceProductSpecificationsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Specifications</h2>
      <input type="hidden" name="productId" value={productId} />
      <label className="block text-xs text-neutral-400">
        Specs JSON array of key, value, sort_order
        <textarea name="specs" defaultValue={defaultJson} className={`${inputClass} min-h-32`} />
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
        Replace specifications
      </button>
    </form>
  );
}
