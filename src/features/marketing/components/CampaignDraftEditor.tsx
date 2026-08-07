"use client";

import { PrebuildBanner } from "./PrebuildBanner.tsx";
import type { CampaignDraftConfig } from "../domain/campaign-validators.ts";

interface CampaignDraftEditorProps {
  readonly draft: CampaignDraftConfig;
  readonly disabled?: boolean;
  readonly validationError?: string | null;
  readonly canSaveDraft?: boolean;
  readonly canRequestApproval?: boolean;
  readonly onChangeTargetingMode: (mode: CampaignDraftConfig["targetingMode"]) => void;
  readonly onSaveDraft?: () => void;
  readonly onRequestApproval?: () => void;
}

export function CampaignDraftEditor({
  draft,
  disabled = false,
  validationError = null,
  canSaveDraft = false,
  canRequestApproval = false,
  onChangeTargetingMode,
  onSaveDraft,
  onRequestApproval,
}: CampaignDraftEditorProps) {
  return (
    <section aria-label="Campaign draft editor" aria-live="polite" className="space-y-4">
      <PrebuildBanner />
      <h2 className="text-lg font-semibold text-neutral-100">Campaign draft</h2>
      <label className="block text-sm text-neutral-300">
        Targeting mode
        <select
          aria-label="Targeting mode"
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          value={draft.targetingMode}
          onChange={(e) =>
            onChangeTargetingMode(e.target.value as CampaignDraftConfig["targetingMode"])
          }
        >
          <option value="broad_public">Broad public</option>
          <option value="direct_or_custom">Direct/custom</option>
        </select>
      </label>
      {validationError ? (
        <p role="alert" className="text-sm text-red-300">
          {validationError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canSaveDraft && onSaveDraft ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md border border-neutral-600 px-3 py-2 text-sm disabled:opacity-50"
            onClick={onSaveDraft}
          >
            Save draft
          </button>
        ) : null}
        {canRequestApproval && onRequestApproval ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={onRequestApproval}
          >
            Request approval
          </button>
        ) : null}
      </div>
    </section>
  );
}
