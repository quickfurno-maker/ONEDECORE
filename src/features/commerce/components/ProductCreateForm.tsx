"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommerceProductAction } from "../server/commerce-actions";
import type { CommerceCategoryRow } from "../server/commerce-queries";
import { commerceGoldButtonClass, commerceInputClass } from "../ui/commerce-classes";

export function ProductCreateForm({ categories }: { readonly categories: readonly CommerceCategoryRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const result = await createCommerceProductAction(formData);
        setMessage(result.message);
        if (result.success && result.data?.productId) {
          router.push(`/admin/commerce/products/${result.data.productId}`);
        }
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--od-text)]">Create product draft</h2>
      <label className="block text-xs text-[var(--od-muted)]">
        Category
        <select name="categoryId" required className={commerceInputClass}>
          <option value="">Select category</option>
          {categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Name
        <input name="name" required minLength={2} maxLength={200} className={commerceInputClass} />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Slug
        <input name="slug" required minLength={2} maxLength={120} className={commerceInputClass} />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Short description
        <textarea name="shortDescription" className={commerceInputClass} />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Full description
        <textarea name="fullDescription" className={commerceInputClass} />
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
          {message}
        </p>
      ) : null}
      <button type="submit" className={commerceGoldButtonClass}>
        Create draft
      </button>
    </form>
  );
}
