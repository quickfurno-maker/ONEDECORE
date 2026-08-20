"use client";

import { useState } from "react";
import { upsertCommerceTaxRateAction } from "../server/commerce-actions";
import type { CommerceTaxRateRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function TaxRateForm({ rate }: { readonly rate?: CommerceTaxRateRow }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await upsertCommerceTaxRateAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">{rate ? `Edit ${rate.code}` : "Add tax rate"}</h2>
      {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
      <label className="block text-xs text-neutral-400">
        Code
        <input name="code" required defaultValue={rate?.code ?? ""} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Name
        <input name="name" required defaultValue={rate?.name ?? ""} className={inputClass} />
      </label>
      <label className="block text-xs text-neutral-400">
        Rate (basis points)
        <input
          name="rateBasisPoints"
          type="number"
          step={1}
          min={0}
          max={10000}
          required
          defaultValue={rate?.rate_basis_points ?? 0}
          className={inputClass}
        />
      </label>
      <label className="block text-xs text-neutral-400">
        Description
        <input name="description" defaultValue={rate?.description ?? ""} className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
        <input type="checkbox" name="isActive" value="true" defaultChecked={rate?.is_active ?? true} />
        Active
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
        Save tax rate
      </button>
    </form>
  );
}
