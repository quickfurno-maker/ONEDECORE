"use client";

import { useState } from "react";
import { upsertCommercePincodeAction } from "../server/commerce-actions";
import type { CommercePincodeRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function PincodeForm({ pincode }: { readonly pincode?: CommercePincodeRow }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await upsertCommercePincodeAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">{pincode ? `Edit ${pincode.pincode}` : "Add pincode"}</h2>
      <label className="block text-xs text-neutral-400">
        Pincode
        <input name="pincode" required pattern="[0-9]{6}" defaultValue={pincode?.pincode ?? ""} className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
        <input type="checkbox" name="serviceable" value="true" defaultChecked={pincode?.serviceable ?? true} />
        Serviceable
      </label>
      <label className="block text-xs text-neutral-400">
        Zone code
        <input name="zoneCode" defaultValue={pincode?.zone_code ?? ""} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-neutral-400">
          ETA min days
          <input name="etaMinDays" type="number" step={1} min={0} defaultValue={pincode?.eta_min_days ?? 0} className={inputClass} />
        </label>
        <label className="block text-xs text-neutral-400">
          ETA max days
          <input name="etaMaxDays" type="number" step={1} min={0} defaultValue={pincode?.eta_max_days ?? 0} className={inputClass} />
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
        Save pincode
      </button>
    </form>
  );
}
