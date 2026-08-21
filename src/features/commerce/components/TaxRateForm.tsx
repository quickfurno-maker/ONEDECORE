"use client";

import { useState } from "react";
import { upsertCommerceTaxRateAction } from "../server/commerce-actions";
import type { CommerceTaxRateRow } from "../server/commerce-queries";
import { commerceGoldButtonClass, commerceInputClass } from "../ui/commerce-classes";
import { basisPointsToPercentInput, mapPercentFieldToBasisPoints } from "../ui/operator-units";

export function TaxRateForm({ rate }: { readonly rate?: CommerceTaxRateRow }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const conversionError = mapPercentFieldToBasisPoints(formData, "ratePercent", "rateBasisPoints");
        if (conversionError) {
          setMessage(conversionError);
          return;
        }
        const result = await upsertCommerceTaxRateAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--od-text)]">{rate ? `Edit ${rate.code}` : "Add tax rate"}</h2>
      {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
      <label className="block text-xs text-[var(--od-muted)]">
        Code
        <input name="code" required defaultValue={rate?.code ?? ""} className={commerceInputClass} />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Name
        <input name="name" required defaultValue={rate?.name ?? ""} className={commerceInputClass} />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Rate (%)
        <input
          name="ratePercent"
          inputMode="decimal"
          required
          defaultValue={rate ? basisPointsToPercentInput(rate.rate_basis_points) : ""}
          className={commerceInputClass}
        />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Description
        <input name="description" defaultValue={rate?.description ?? ""} className={commerceInputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--od-text-2)]">
        <input type="checkbox" name="isActive" value="true" defaultChecked={rate?.is_active ?? true} />
        Active
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
          {message}
        </p>
      ) : null}
      <button type="submit" className={commerceGoldButtonClass}>
        Save tax rate
      </button>
    </form>
  );
}
