"use client";

import { useState } from "react";
import {
  setCommerceCategoryStatusAction,
  upsertCommerceCategoryAction,
} from "../server/commerce-actions";
import type { CommerceCategoryRow } from "../server/commerce-queries";
import { commerceGhostButtonClass, commerceGoldButtonClass, commerceInputClass } from "../ui/commerce-classes";
import { mapRupeesFieldToPaise, paiseToRupeesInput } from "../ui/operator-units";

interface CategoryFormProps {
  readonly category?: CommerceCategoryRow;
  readonly rootCategories: readonly CommerceCategoryRow[];
}

export function CategoryForm({ category, rootCategories }: CategoryFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const parentChoices = rootCategories.filter((row) => row.id !== category?.id);

  return (
    <div className="space-y-3">
      <form
        className="space-y-3"
        action={async (formData) => {
          const conversionError = mapRupeesFieldToPaise(
            formData,
            "shippingChargeRupeesOverride",
            "shippingChargePaiseOverride",
            false
          );
          if (conversionError) {
            setMessage(conversionError);
            return;
          }
          const result = await upsertCommerceCategoryAction(formData);
          setMessage(result.message);
        }}
      >
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <h2 className="text-sm font-semibold text-[var(--od-text)]">
          {category ? `Edit ${category.category_reference}` : "Create category"}
        </h2>
        <label className="block text-xs text-[var(--od-muted)]">
          Name
          <input name="name" required defaultValue={category?.name ?? ""} className={commerceInputClass} />
        </label>
        <label className="block text-xs text-[var(--od-muted)]">
          Slug
          <input name="slug" required defaultValue={category?.slug ?? ""} className={commerceInputClass} />
        </label>
        <label className="block text-xs text-[var(--od-muted)]">
          Parent (roots only)
          <select name="parentId" defaultValue={category?.parent_category_id ?? ""} className={commerceInputClass}>
            <option value="">None</option>
            {parentChoices.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--od-muted)]">
          Short description
          <textarea
            name="shortDescription"
            defaultValue={category?.short_description ?? ""}
            className={commerceInputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--od-muted)]">
            SEO title
            <input name="seoTitle" defaultValue={category?.seo_title ?? ""} className={commerceInputClass} />
          </label>
          <label className="block text-xs text-[var(--od-muted)]">
            Sort order
            <input
              name="sortOrder"
              type="number"
              step={1}
              defaultValue={category?.sort_order ?? 0}
              className={commerceInputClass}
            />
          </label>
        </div>
        <label className="block text-xs text-[var(--od-muted)]">
          SEO description
          <textarea name="seoDescription" defaultValue={category?.seo_description ?? ""} className={commerceInputClass} />
        </label>
        <label className="block text-xs text-[var(--od-muted)]">
          Shipping override (₹)
          <input
            name="shippingChargeRupeesOverride"
            inputMode="decimal"
            defaultValue={
              category?.shipping_charge_paise_override == null
                ? ""
                : paiseToRupeesInput(category.shipping_charge_paise_override)
            }
            className={commerceInputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--od-muted)]">
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
              className={commerceInputClass}
            >
              <option value="">Inherit</option>
              <option value="true">Allowed</option>
              <option value="false">Not allowed</option>
            </select>
          </label>
          <label className="block text-xs text-[var(--od-muted)]">
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
              className={commerceInputClass}
            >
              <option value="">Inherit</option>
              <option value="true">Eligible</option>
              <option value="false">Not eligible</option>
            </select>
          </label>
        </div>
        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
            {message}
          </p>
        ) : null}
        <button type="submit" className={commerceGoldButtonClass}>
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
          <button type="submit" className={commerceGhostButtonClass}>
            {category.status === "archived" ? "Reactivate" : "Archive"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
