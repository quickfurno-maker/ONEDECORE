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
        <p className="text-xs text-neutral-400">
          Paste only Name and Mobile Number. Up to 1,000 contacts. CRM cleans Indian mobile
          numbers, then separates invalid and duplicate enquiries before import.
        </p>
        <a href="/templates/ONEDECORE_Bulk_Enquiries_Template.xlsx" download
           className="inline-flex min-h-10 items-center rounded-md border border-amber-500/40 px-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/10">
          Download two-column Excel template
        </a>
        <p className="text-xs text-neutral-500">
          Advanced CSV/XLSX mapping remains available. Bulk import does not record marketing or WhatsApp consent.
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
          required
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
