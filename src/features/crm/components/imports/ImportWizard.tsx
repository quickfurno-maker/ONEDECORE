"use client";

import { useActionState } from "react";
import type { CrmLeadSourceOption } from "@/features/crm/contracts/lead-detail-dtos.ts";
import {
  LEAD_IMPORT_MAPPING_FIELDS,
  type LeadImportActionState,
} from "@/features/crm/contracts/lead-import-contracts.ts";
import { uploadLeadImportFileAction } from "@/features/crm/server/crm-import-actions.ts";

const INITIAL_STATE: LeadImportActionState = {
  success: false,
  message: "",
};

interface ImportWizardProps {
  readonly sources: readonly CrmLeadSourceOption[];
}

export function ImportWizard({ sources }: ImportWizardProps) {
  const [state, formAction, pending] = useActionState(
    uploadLeadImportFileAction,
    INITIAL_STATE
  );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6"
    >
      <div className="space-y-2">
        <label htmlFor="import-file" className="text-sm font-medium text-neutral-200">
          Import file
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-neutral-950"
        />
        <p className="text-xs text-neutral-500">
          CSV (UTF-8 with BOM) or XLSX values only. Max 5 MiB, 1000 rows, 50
          columns. Formulas are rejected. Bulk import does not record marketing or WhatsApp consent — use the consent workflow separately when required.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="default-source"
          className="text-sm font-medium text-neutral-200"
        >
          Default lead source
        </label>
        <select
          id="default-source"
          name="defaultSourceId"
          className="min-h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">Select default source</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <p className="text-sm font-medium text-neutral-200">Supported fields</p>
        <p className="mt-2 text-xs leading-6 text-neutral-400">
          {LEAD_IMPORT_MAPPING_FIELDS.join(", ")}
        </p>
      </div>

      {state.message ? (
        <p
          className={`text-sm ${state.success ? "text-emerald-300" : "text-rose-300"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload and map columns"}
      </button>
    </form>
  );
}
