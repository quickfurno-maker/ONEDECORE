"use client";

import { useState } from "react";
import { updateCommerceShippingSettingsAction } from "../server/commerce-actions";
import type { CommerceShippingSettingsRow } from "../server/commerce-queries";

const inputClass =
  "mt-1 w-full min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100";

export function ShippingSettingsForm({ settings }: { readonly settings: CommerceShippingSettingsRow | null }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await updateCommerceShippingSettingsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Shipping settings</h2>
      <label className="block text-xs text-neutral-400">
        Default shipping charge (paise)
        <input
          name="defaultShippingChargePaise"
          type="number"
          step={1}
          min={0}
          required
          defaultValue={settings?.default_shipping_charge_paise ?? 0}
          className={inputClass}
        />
      </label>
      <label className="block text-xs text-neutral-400">
        Free shipping threshold (paise)
        <input
          name="freeShippingThresholdPaise"
          type="number"
          step={1}
          min={0}
          defaultValue={settings?.free_shipping_threshold_paise ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
        <input type="checkbox" name="codEnabledGlobal" value="true" defaultChecked={settings?.cod_enabled_global ?? true} />
        COD enabled globally
      </label>
      <label className="block text-xs text-neutral-400">
        Assembly / install note
        <textarea name="assemblyInstallNote" defaultValue={settings?.assembly_install_note ?? ""} className={inputClass} />
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
        Save shipping
      </button>
    </form>
  );
}
