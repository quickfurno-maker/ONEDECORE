/**
 * Phase 9 migration-independent — landing page reference contracts.
 */

const LANDING_PAGE_REF_PATTERN = /^OD-LP-[A-Z0-9-]{6,40}$/;

export interface LandingPageRef {
  readonly pageReference: string;
}

export interface LandingPageVersionRef {
  readonly pageReference: string;
  readonly versionNumber: number;
}

export interface LandingPublicationRef {
  readonly publicationReference: string;
  readonly pageVersion: LandingPageVersionRef;
}

export interface LandingExperimentRef {
  readonly experimentReference: string;
  readonly publicationReference: string;
}

export interface LandingVariantRef {
  readonly experimentReference: string;
  readonly variantKey: string;
  readonly pageVersion: LandingPageVersionRef;
}

export function validateLandingPageReference(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) return "Landing page reference must be at least 10 characters.";
  if (!LANDING_PAGE_REF_PATTERN.test(trimmed)) {
    return "Landing page reference must match OD-LP-* pattern.";
  }
  return null;
}
