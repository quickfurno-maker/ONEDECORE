"use client";

import type { CampaignBudgetSnapshot, CampaignIntendedWindowSnapshot } from "../contracts/budget.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface CampaignBudgetPanelProps {
  readonly budget: CampaignBudgetSnapshot;
  readonly window?: CampaignIntendedWindowSnapshot;
  readonly validationError?: string | null;
  readonly disabled?: boolean;
  readonly onEditBudget?: () => void;
}

export function CampaignBudgetPanel({
  budget,
  window,
  validationError = null,
  disabled = false,
  onEditBudget,
}: CampaignBudgetPanelProps) {
  return (
    <section aria-label="Campaign budget" aria-live="polite" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Budget snapshot (approval only)</h3>
      <dl className="grid gap-2 text-sm text-neutral-300">
        <div>
          <dt className="text-neutral-500">Daily budget (paise)</dt>
          <dd>{budget.dailyBudgetPaise}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Total budget (paise)</dt>
          <dd>{budget.totalBudgetPaise ?? "—"}</dd>
        </div>
        {window ? (
          <div>
            <dt className="text-neutral-500">Intended window</dt>
            <dd>
              {window.startDate} → {window.endDate ?? "open"}
            </dd>
          </div>
        ) : null}
      </dl>
      {validationError ? (
        <p role="alert" aria-live="assertive" className="text-sm text-red-300">
          {validationError}
        </p>
      ) : null}
      {onEditBudget ? (
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-neutral-600 px-3 py-2 text-sm disabled:opacity-50"
          onClick={onEditBudget}
        >
          Edit budget
        </button>
      ) : null}
    </section>
  );
}
