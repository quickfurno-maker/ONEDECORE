"use client";

import type { LandingExperiment } from "../contracts/page-model.ts";

interface HumanWinnerControlProps {
  readonly experiment: LandingExperiment;
  readonly onSelectWinner?: (variantKey: string) => void;
  readonly disabled?: boolean;
}

export function HumanWinnerControl({
  experiment,
  onSelectWinner,
  disabled = false,
}: HumanWinnerControlProps) {
  return (
    <section
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
      data-testid="human-winner-control"
    >
      <h2 className="text-sm font-medium text-neutral-100">Human winner selection</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Owner-approved winner only. No automatic promotion in prebuild.
      </p>
      <fieldset className="mt-4 space-y-2" disabled={disabled}>
        <legend className="sr-only">Select winning variant</legend>
        {experiment.variants.map((variant) => {
          const selected = experiment.winnerVariantKey === variant.variantKey;
          return (
            <label
              key={variant.variantKey}
              className="flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
            >
              <input
                type="radio"
                name="winner-variant"
                value={variant.variantKey}
                checked={selected}
                onChange={() => onSelectWinner?.(variant.variantKey)}
              />
              {variant.label} ({variant.variantKey})
            </label>
          );
        })}
      </fieldset>
      {experiment.winnerVariantKey ? (
        <p className="mt-3 text-xs text-emerald-300">
          Current winner: {experiment.winnerVariantKey}
        </p>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">No winner selected.</p>
      )}
    </section>
  );
}
