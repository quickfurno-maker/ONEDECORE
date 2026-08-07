/**
 * Phase 9B migration-independent — deterministic experiment variant routing.
 */

import { createHash } from "node:crypto";
import type { LandingExperiment } from "../contracts/page-model.ts";
import { validateLandingExperiment } from "../contracts/page-model.ts";

export interface DeterministicVariantInput {
  readonly experiment: LandingExperiment;
  readonly visitorKey: string;
}

export function resolveDeterministicVariant(input: DeterministicVariantInput): string {
  const experimentError = validateLandingExperiment(input.experiment);
  if (experimentError) {
    throw new Error(experimentError);
  }

  const visitorKey = input.visitorKey.trim();
  if (!visitorKey) {
    throw new Error("Visitor key is required for deterministic routing.");
  }

  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        experimentReference: input.experiment.experimentReference,
        visitorKey,
      })
    )
    .digest("hex");

  const bucket = parseInt(digest.slice(0, 8), 16) % 10_000;

  let cumulative = 0;
  for (const variant of input.experiment.variants) {
    cumulative += variant.allocationPercent * 100;
    if (bucket < cumulative) {
      return variant.variantKey;
    }
  }

  return input.experiment.variants[input.experiment.variants.length - 1]!.variantKey;
}

export function previewVariantAllocationDistribution(input: {
  readonly experiment: LandingExperiment;
  readonly sampleVisitorKeys: readonly string[];
}): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const variant of input.experiment.variants) {
    counts[variant.variantKey] = 0;
  }
  for (const visitorKey of input.sampleVisitorKeys) {
    const key = resolveDeterministicVariant({
      experiment: input.experiment,
      visitorKey,
    });
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
