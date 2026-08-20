"use client";

import { useState } from "react";
import { updateCommerceProductAction } from "../server/commerce-actions";
import type { CommerceCategoryRow, CommerceProductDetail, CommerceTaxRateRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

interface ProductGeneralFormProps {
  readonly detail: CommerceProductDetail;
  readonly categories: readonly CommerceCategoryRow[];
  readonly taxRates: readonly CommerceTaxRateRow[];
}

export function ProductGeneralForm({ detail, categories, taxRates }: ProductGeneralFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const product = detail.product;

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await updateCommerceProductAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">General</h2>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="lockVersion" value={product.lock_version} />
      <label className="block text-xs text-neutral-400">
        Category
        <select name="categoryId" defaultValue={product.category_id} required className={inputClass}>
          {categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-neutral-400">
        Name
        <input name="name" required defaultValue={product.name} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Slug
        <input name="slug" required defaultValue={product.slug} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Short description
        <textarea name="shortDescription" defaultValue={product.short_description ?? ""} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Full description
        <textarea name="fullDescription" defaultValue={product.full_description} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Tax rate
        <select name="taxRateId" defaultValue={product.tax_rate_id ?? ""} className={inputClass}>
          <option value="">None</option>
          {taxRates.map((rate) => (
            <option key={rate.id} value={rate.id}>
              {rate.code} ({rate.rate_basis_points} bps)
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-neutral-400">
        HSN / SAC
        <input name="hsnSacCode" defaultValue={product.hsn_sac_code ?? ""} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Shipping override (paise)
        <input
          name="shippingChargePaiseOverride"
          type="number"
          step={1}
          min={0}
          defaultValue={product.shipping_charge_paise_override ?? ""}
          className={inputClass}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-neutral-400">
          COD override
          <select
            name="codAllowedOverride"
            defaultValue={
              product.cod_allowed_override === null || product.cod_allowed_override === undefined
                ? ""
                : product.cod_allowed_override
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
              product.free_shipping_eligible_override === null || product.free_shipping_eligible_override === undefined
                ? ""
                : product.free_shipping_eligible_override
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
      <label className="block text-xs text-neutral-400">
        SEO title
        <input name="seoTitle" defaultValue={product.seo_title ?? ""} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        SEO description
        <textarea name="seoDescription" defaultValue={product.seo_description ?? ""} className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
        <input type="checkbox" name="featured" value="true" defaultChecked={product.featured} />
        Featured
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
        Save general
      </button>
    </form>
  );
}
