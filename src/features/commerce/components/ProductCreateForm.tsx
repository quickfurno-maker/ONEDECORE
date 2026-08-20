"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommerceProductAction } from "../server/commerce-actions";
import type { CommerceCategoryRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function ProductCreateForm({ categories }: { readonly categories: readonly CommerceCategoryRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await createCommerceProductAction(formData);
        setMessage(result.message);
        if (result.success && result.data?.productId) {
          router.push(`/admin/commerce/products/${result.data.productId}`);
        }
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Create product draft</h2>
      <label className="block text-xs text-neutral-400">
        Category
        <select name="categoryId" required className={inputClass}>
          <option value="">Select category</option>
          {categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-neutral-400">
        Name
        <input name="name" required minLength={2} maxLength={200} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Slug
        <input name="slug" required minLength={2} maxLength={120} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Short description
        <textarea name="shortDescription" className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Full description
        <textarea name="fullDescription" className={inputClass} />
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
        Create draft
      </button>
    </form>
  );
}
