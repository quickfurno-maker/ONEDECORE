"use client";

import type { LandingExperiment } from "../contracts/page-model.ts";
import { resolveDeterministicVariant } from "../domain/routing.ts";

interface ExperimentVariantPanelProps {
  readonly experiment: LandingExperiment;
  readonly previewVisitorKey?: string;
}

export function ExperimentVariantPanel({
  experiment,
  previewVisitorKey = "preview-visitor-001",
}: ExperimentVariantPanelProps) {
  const routedVariant = resolveDeterministicVariant({
    experiment,
    visitorKey: previewVisitorKey,
  });

  return (
    <section
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
      data-testid="experiment-variant-panel"
    >
      <h2 className="text-sm font-medium text-neutral-100">Experiment variants</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Deterministic routing preview for visitor key: {previewVisitorKey}
      </p>
      <p className="mt-2 text-sm text-amber-200">Routed variant: {routedVariant}</p>
      <ul className="mt-4 space-y-2">
        {experiment.variants.map((variant) => (
          <li
            key={variant.variantKey}
            className="rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
          >
            <span className="font-medium">{variant.label}</span> ({variant.variantKey}) —{" "}
            {variant.allocationPercent}% — v{variant.pageVersionNumber}
          </li>
        ))}
      </ul>
    </section>
  );
}
