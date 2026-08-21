"use client";

import { useState } from "react";
import { upsertCommercePincodeAction } from "../server/commerce-actions";
import type { CommercePincodeRow } from "../server/commerce-queries";
import { commerceGoldButtonClass, commerceInputClass } from "../ui/commerce-classes";

export function PincodeForm({ pincode }: { readonly pincode?: CommercePincodeRow }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const result = await upsertCommercePincodeAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--od-text)]">{pincode ? `Edit ${pincode.pincode}` : "Add pincode"}</h2>
      <label className="block text-xs text-[var(--od-muted)]">
        Pincode
        <input name="pincode" required pattern="[0-9]{6}" defaultValue={pincode?.pincode ?? ""} className={commerceInputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--od-text-2)]">
        <input type="checkbox" name="serviceable" value="true" defaultChecked={pincode?.serviceable ?? true} />
        Serviceable
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Zone code
        <input name="zoneCode" defaultValue={pincode?.zone_code ?? ""} className={commerceInputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-[var(--od-muted)]">
          ETA min days
          <input name="etaMinDays" type="number" step={1} min={0} defaultValue={pincode?.eta_min_days ?? 0} className={commerceInputClass} />
        </label>
        <label className="block text-xs text-[var(--od-muted)]">
          ETA max days
          <input name="etaMaxDays" type="number" step={1} min={0} defaultValue={pincode?.eta_max_days ?? 0} className={commerceInputClass} />
        </label>
      </div>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
          {message}
        </p>
      ) : null}
      <button type="submit" className={commerceGoldButtonClass}>
        Save pincode
      </button>
    </form>
  );
}
