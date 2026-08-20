"use client";

import { useState } from "react";
import { updateCommerceTaxSettingsAction } from "../server/commerce-actions";
import type { CommerceTaxSettingsRow } from "../server/commerce-queries";

export function TaxSettingsForm({ settings }: { readonly settings: CommerceTaxSettingsRow | null }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await updateCommerceTaxSettingsAction(formData);
        setMessage(result.message);
      }}
    >
      <h2 className="text-sm font-semibold text-neutral-100">Tax settings</h2>
      <p className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
        GST-inclusive pricing — locked for ONEDECORE MVP
      </p>
      <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-200">
        <input
          type="checkbox"
          name="taxRequiredForPublish"
          value="true"
          defaultChecked={settings?.tax_required_for_publish ?? true}
        />
        Tax required to publish
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
        Save tax settings
      </button>
    </form>
  );
}
