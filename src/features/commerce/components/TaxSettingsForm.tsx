"use client";

import { useState } from "react";
import { updateCommerceTaxSettingsAction } from "../server/commerce-actions";
import type { CommerceTaxSettingsRow } from "../server/commerce-queries";
import { commerceGoldButtonClass } from "../ui/commerce-classes";

export function TaxSettingsForm({ settings }: { readonly settings: CommerceTaxSettingsRow | null }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const result = await updateCommerceTaxSettingsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--od-text)]">Tax settings</h2>
      <p className="rounded-[8px] border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 py-2 text-xs text-[var(--od-text-2)]">
        GST-inclusive pricing — locked for ONEDECORE MVP
      </p>
      <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--od-text-2)]">
        <input
          type="checkbox"
          name="taxRequiredForPublish"
          value="true"
          defaultChecked={settings?.tax_required_for_publish ?? true}
        />
        Tax required to publish
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-[var(--od-warning)]">
          {message}
        </p>
      ) : null}
      <button type="submit" className={commerceGoldButtonClass}>
        Save tax settings
      </button>
    </form>
  );
}
