"use client";

import { useState } from "react";
import { archiveCommerceProductMediaAction } from "../server/commerce-actions";
import { uploadCommerceProductMediaAction } from "../server/commerce-media-actions";
import type { CommerceMediaRow, CommerceVariantRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function MediaUploadForm({
  productId,
  variants,
  media,
}: {
  readonly productId: string;
  readonly variants: readonly CommerceVariantRow[];
  readonly media: readonly CommerceMediaRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <form
        className="space-y-3"
        action={async (formData) => {
          const result = await uploadCommerceProductMediaAction(formData);
          setMessage(result.message);
        }}
      >
        <h2 className="text-sm font-semibold text-neutral-100">Upload media</h2>
        <input type="hidden" name="productId" value={productId} />
        <label className="block text-xs text-neutral-400">
          File (JPEG, PNG, or WebP, max 20 MiB)
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Alt text
          <input name="altText" required className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Variant (optional)
          <select name="variantId" className={inputClass}>
            <option value="">Product-level</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.sku}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Sort order
          <input name="sortOrder" type="number" step={1} defaultValue={0} className={inputClass} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
          <input type="checkbox" name="isPrimary" value="true" />
          Primary image
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
          Upload
        </button>
      </form>
      <ul className="space-y-2 text-xs text-neutral-300">
        {media.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-2">
            <span>
              {item.status} {item.is_primary ? "(primary)" : ""} — {item.public_path}
            </span>
            {item.status === "active" ? (
              <form
                action={async (formData) => {
                  const result = await archiveCommerceProductMediaAction(formData);
                  setMessage(result.message);
                }}
              >
                <input type="hidden" name="mediaId" value={item.id} />
                <input type="hidden" name="productId" value={productId} />
                <button type="submit" className="text-amber-300 hover:text-amber-200">
                  Archive
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
