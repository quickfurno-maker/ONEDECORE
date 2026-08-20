"use client";

import { useState } from "react";
import {
  setCommerceCategoryStatusAction,
  upsertCommerceCategoryAction,
} from "../server/commerce-actions";
import type { CommerceCategoryRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

interface CategoryFormProps {
  readonly category?: CommerceCategoryRow;
  readonly rootCategories: readonly CommerceCategoryRow[];
}

export function CategoryForm({ category, rootCategories }: CategoryFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const parentChoices = rootCategories.filter((row) => row.id !== category?.id);

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <form
        className="space-y-3"
        action={async (formData) => {
          const result = await upsertCommerceCategoryAction(formData);
          setMessage(result.message);
        }}
      >
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <h2 className="text-sm font-semibold text-neutral-100">
          {category ? `Edit ${category.category_reference}` : "Create category"}
        </h2>
        <label className="block text-xs text-neutral-400">
          Name
          <input name="name" required defaultValue={category?.name ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Slug
          <input name="slug" required defaultValue={category?.slug ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Parent (roots only)
          <select name="parentId" defaultValue={category?.parent_category_id ?? ""} className={inputClass}>
            <option value="">None</option>
            {parentChoices.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Short description
          <textarea name="shortDescription" defaultValue={category?.short_description ?? ""} className={inputClass} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            SEO title
            <input name="seoTitle" defaultValue={category?.seo_title ?? ""} className={inputClass} />
          </label>
          <label className="block text-xs text-neutral-400">
            Sort order
            <input name="sortOrder" type="number" step={1} defaultValue={category?.sort_order ?? 0} className={inputClass} />
          </label>
        </div>
        <label className="block text-xs text-neutral-400">
          SEO description
          <textarea name="seoDescription" defaultValue={category?.seo_description ?? ""} className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          Shipping override (paise)
          <input
            name="shippingChargePaiseOverride"
            type="number"
            step={1}
            min={0}
            defaultValue={category?.shipping_charge_paise_override ?? ""}
            className={inputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            COD override
            <select
              name="codAllowedOverride"
              defaultValue={
                category?.cod_allowed_override === null || category?.cod_allowed_override === undefined
                  ? ""
                  : category.cod_allowed_override
                    ? "true"
                    : "false"
              }
              className={inputClass}
            >
              <option value="">Inherit</option>
              <option value="true">Allowed</option>
              <option value="false">Not allowed</option>
            </select>
          </label>
          <label className="block text-xs text-neutral-400">
            Free shipping override
            <select
              name="freeShippingEligibleOverride"
              defaultValue={
                category?.free_shipping_eligible_override === null ||
                category?.free_shipping_eligible_override === undefined
                  ? ""
                  : category.free_shipping_eligible_override
                    ? "true"
                    : "false"
              }
              className={inputClass}
            >
              <option value="">Inherit</option>
              <option value="true">Eligible</option>
              <option value="false">Not eligible</option>
            </select>
          </label>
        </div>
        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-amber-200">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950"
        >
          {category ? "Save category" : "Create category"}
        </button>
      </form>
      {category ? (
        <form
          action={async (formData) => {
            const result = await setCommerceCategoryStatusAction(formData);
            setMessage(result.message);
          }}
        >
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="status" value={category.status === "archived" ? "active" : "archived"} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200"
          >
            {category.status === "archived" ? "Reactivate" : "Archive"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
