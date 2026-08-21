"use client";

import { useState } from "react";
import { replaceCommerceRelatedProductsAction } from "../server/commerce-actions";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function RelatedForm({
  productId,
  relatedIds,
}: {
  readonly productId: string;
  readonly relatedIds: readonly string[];
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await replaceCommerceRelatedProductsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Related products</h2>
      <input type="hidden" name="productId" value={productId} />
      <label className="block text-xs text-neutral-400">
        Related product IDs (comma or newline separated)
        <textarea name="relatedIds" defaultValue={relatedIds.join("\n")} className={`${inputClass} min-h-24`} />
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-amber-200">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-[8px] bg-[var(--od-gold)] px-3 py-2 text-xs font-semibold text-[#1a1408]"
      >
        Save related
      </button>
    </form>
  );
}
