"use client";

import { useState } from "react";
import { updateCommerceShippingSettingsAction } from "../server/commerce-actions";
import type { CommerceShippingSettingsRow } from "../server/commerce-queries";
import { commerceGoldButtonClass, commerceInputClass } from "../ui/commerce-classes";
import { mapRupeesFieldToPaise, paiseToRupeesInput } from "../ui/operator-units";

export function ShippingSettingsForm({ settings }: { readonly settings: CommerceShippingSettingsRow | null }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const defaultError = mapRupeesFieldToPaise(
          formData,
          "defaultShippingChargeRupees",
          "defaultShippingChargePaise",
          true
        );
        if (defaultError) {
          setMessage(defaultError);
          return;
        }
        const thresholdError = mapRupeesFieldToPaise(
          formData,
          "freeShippingThresholdRupees",
          "freeShippingThresholdPaise",
          false
        );
        if (thresholdError) {
          setMessage(thresholdError);
          return;
        }
        const result = await updateCommerceShippingSettingsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--od-text)]">Shipping settings</h2>
      <label className="block text-xs text-[var(--od-muted)]">
        Default shipping charge (₹)
        <input
          name="defaultShippingChargeRupees"
          inputMode="decimal"
          required
          defaultValue={settings ? paiseToRupeesInput(settings.default_shipping_charge_paise) : "0"}
          className={commerceInputClass}
        />
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Free shipping threshold (₹)
        <input
          name="freeShippingThresholdRupees"
          inputMode="decimal"
          defaultValue={
            settings?.free_shipping_threshold_paise == null
              ? ""
              : paiseToRupeesInput(settings.free_shipping_threshold_paise)
          }
          className={commerceInputClass}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--od-text-2)]">
        <input type="checkbox" name="codEnabledGlobal" value="true" defaultChecked={settings?.cod_enabled_global ?? true} />
        COD enabled globally
      </label>
      <label className="block text-xs text-[var(--od-muted)]">
        Assembly / install note
        <textarea name="assemblyInstallNote" defaultValue={settings?.assembly_install_note ?? ""} className={commerceInputClass} />
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
          {message}
        </p>
      ) : null}
      <button type="submit" className={commerceGoldButtonClass}>
        Save shipping
      </button>
    </form>
  );
}
