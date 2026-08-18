/**
 * Phase 9B migration-independent — landing page domain model contracts.
 */

import type { LandingBlock } from "./blocks.ts";
import { validateLandingPageBlocks } from "./blocks.ts";
import { validateLandingPageReference } from "./references.ts";

/**
 * Identity-only page state. Publication truth is landing_publications.status
 * (draft|live|paused|archived). This is not a parallel "published" lifecycle.
 */
export const LANDING_PAGE_IDENTITY_STATES = ["active", "archived"] as const;
export type LandingPageIdentityState = (typeof LANDING_PAGE_IDENTITY_STATES)[number];
/** @deprecated Use LandingPageIdentityState — retained as identity alias, not publication. */
export const LANDING_PAGE_LIFECYCLE_STATES = LANDING_PAGE_IDENTITY_STATES;
export type LandingPageLifecycleState = LandingPageIdentityState;

export const LANDING_PUBLICATION_STATUSES = ["draft", "live", "paused", "archived"] as const;
export type LandingPublicationStatus = (typeof LANDING_PUBLICATION_STATUSES)[number];

export const LANDING_EXPERIMENT_STATUSES = ["draft", "running", "concluded"] as const;
export type LandingExperimentStatus = (typeof LANDING_EXPERIMENT_STATUSES)[number];

const PUBLICATION_REF_PATTERN = /^OD-LP-PUB-[A-Z0-9-]{4,40}$/;
const EXPERIMENT_REF_PATTERN = /^OD-LP-EXP-[A-Z0-9-]{4,40}$/;
const VARIANT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/i;

export interface LandingPage {
  readonly pageReference: string;
  readonly title: string;
  readonly lifecycle: LandingPageLifecycleState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LandingPageVersion {
  readonly pageReference: string;
  readonly versionNumber: number;
  readonly blocks: readonly LandingBlock[];
  readonly frozenAt: string | null;
  readonly label: string;
}

export interface LandingPublication {
  readonly publicationReference: string;
  readonly pageReference: string;
  readonly pageVersionNumber: number;
  readonly status: LandingPublicationStatus;
  readonly campaignReference: string | null;
  readonly publishedAt: string | null;
}

export interface LandingVariant {
  readonly variantKey: string;
  readonly pageReference: string;
  readonly pageVersionNumber: number;
  readonly allocationPercent: number;
  readonly label: string;
}

export interface LandingExperiment {
  readonly experimentReference: string;
  readonly publicationReference: string;
  readonly status: LandingExperimentStatus;
  readonly variants: readonly LandingVariant[];
  readonly winnerVariantKey: string | null;
}

export function isLandingPageVersionFrozen(version: LandingPageVersion): boolean {
  return version.frozenAt != null;
}

export function assertLandingPageVersionMutable(version: LandingPageVersion): string | null {
  if (isLandingPageVersionFrozen(version)) {
    return "Frozen landing page versions are immutable.";
  }
  return null;
}

export function validateLandingPublicationBinding(input: {
  readonly publication: LandingPublication;
  readonly version: LandingPageVersion;
}): string | null {
  if (input.publication.pageReference !== input.version.pageReference) {
    return "Publication page reference does not match version.";
  }
  if (input.publication.pageVersionNumber !== input.version.versionNumber) {
    return "Publication must bind an exact page version number.";
  }
  if (!isLandingPageVersionFrozen(input.version)) {
    return "Publication requires a frozen page version.";
  }
  return null;
}

export function validateLandingPageVersion(version: LandingPageVersion): string | null {
  const pageRefError = validateLandingPageReference(version.pageReference);
  if (pageRefError) return pageRefError;
  if (!Number.isInteger(version.versionNumber) || version.versionNumber < 1) {
    return "Version number must be a positive integer.";
  }
  const labelError =
    typeof version.label === "string" && version.label.trim().length <= 120
      ? null
      : "Version label must be a string up to 120 characters.";
  if (labelError) return labelError;
  return validateLandingPageBlocks(version.blocks);
}

export function validateLandingPublication(publication: LandingPublication): string | null {
  if (!PUBLICATION_REF_PATTERN.test(publication.publicationReference)) {
    return "Publication reference must match OD-LP-PUB-* pattern.";
  }
  const pageRefError = validateLandingPageReference(publication.pageReference);
  if (pageRefError) return pageRefError;
  if (!Number.isInteger(publication.pageVersionNumber) || publication.pageVersionNumber < 1) {
    return "Publication page version number must be a positive integer.";
  }
  if (!LANDING_PUBLICATION_STATUSES.includes(publication.status)) {
    return "Publication status is invalid.";
  }
  return null;
}

export function validateLandingExperiment(experiment: LandingExperiment): string | null {
  if (!EXPERIMENT_REF_PATTERN.test(experiment.experimentReference)) {
    return "Experiment reference must match OD-LP-EXP-* pattern.";
  }
  if (!PUBLICATION_REF_PATTERN.test(experiment.publicationReference)) {
    return "Experiment publication reference must match OD-LP-PUB-* pattern.";
  }
  if (!LANDING_EXPERIMENT_STATUSES.includes(experiment.status)) {
    return "Experiment status is invalid.";
  }
  if (experiment.variants.length < 2) {
    return "Experiment requires at least two variants.";
  }
  if (experiment.variants.length > 3) {
    return "Experiment exceeds maximum variant count.";
  }

  let allocationTotal = 0;
  const keys = new Set<string>();
  for (const variant of experiment.variants) {
    if (!VARIANT_KEY_PATTERN.test(variant.variantKey)) {
      return "Variant key is invalid.";
    }
    if (keys.has(variant.variantKey)) return "Variant keys must be unique.";
    keys.add(variant.variantKey);
    const pageRefError = validateLandingPageReference(variant.pageReference);
    if (pageRefError) return pageRefError;
    if (!Number.isInteger(variant.pageVersionNumber) || variant.pageVersionNumber < 1) {
      return "Variant page version number must be a positive integer.";
    }
    if (!Number.isInteger(variant.allocationPercent) || variant.allocationPercent < 1) {
      return "Variant allocation percent must be a positive integer.";
    }
    allocationTotal += variant.allocationPercent;
    if (typeof variant.label !== "string" || variant.label.trim().length > 80) {
      return "Variant label must be a string up to 80 characters.";
    }
  }

  if (allocationTotal !== 100) {
    return "Variant allocation percentages must sum to exactly 100.";
  }

  if (experiment.winnerVariantKey != null && !keys.has(experiment.winnerVariantKey)) {
    return "Winner variant key must reference an existing variant.";
  }

  if (experiment.status === "concluded" && experiment.winnerVariantKey == null) {
    return "Concluded experiments require a human-selected winner variant.";
  }
  if (experiment.status !== "concluded" && experiment.winnerVariantKey != null) {
    return "Winner variant may be set only when concluding an experiment.";
  }

  return null;
}

export function isLandingPublicationPubliclyRenderable(
  status: LandingPublicationStatus
): boolean {
  return status === "live";
}
