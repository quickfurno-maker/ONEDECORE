/**
 * Phase 3A1 — business-truth registry.
 * References canonical claim sources; tracks evidence and legal-term status per claim.
 */

import {
  HOME_CLAIMS,
  HOME_CLAIM_COPY,
} from "../public-site/home-r4/claims.ts";
import { HOME_REVIEW_MODE } from "../public-site/home-r4/reviews.ts";
import { HOME_PROJECT_PROOF_MODE } from "../public-site/home-r4/project-proof.ts";

export type PublicEvidenceStatus = "pending" | "verified" | "withdrawn";
export type LegalTermsStatus = "pending" | "approved" | "not-applicable";

export interface BusinessTruthEntry {
  readonly claimId: string;
  readonly sourceModule: string;
  readonly displayCopy: string;
  readonly displayLocations: readonly string[];
  readonly ownerApprovalDisplayCopy: true;
  readonly publicEvidenceStatus: PublicEvidenceStatus;
  readonly legalTermsStatus: LegalTermsStatus;
  readonly structuredDataPermission: false;
  readonly namedReviewPermission: false;
  readonly reviewNotes: readonly string[];
}

export const BUSINESS_TRUTH_REGISTRY_NOTES: readonly string[] = [
  "Free Design Consultation does not mean the current website books or submits a consultation.",
  "All pricing and estimator outputs remain indicative planning guidance, not quotations.",
  "No aggregateRating, Review or Warranty schema.org structured data is permitted until evidence URLs and legal terms exist.",
  "No named testimonials are published; review mode is aggregate-only.",
  "No fake factory address or unverified business location is asserted.",
  `Homepage project proof mode: ${HOME_PROJECT_PROOF_MODE}.`,
  `Home review mode: ${HOME_REVIEW_MODE}.`,
] as const;

export const BUSINESS_TRUTH_REGISTRY: readonly BusinessTruthEntry[] = [
  {
    claimId: "projects-delivered",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.projectsDelivered,
    displayLocations: ["homepage-hero", "homepage-proof-strip", "homepage-value"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.projectsDelivered (${HOME_CLAIMS.projectsDelivered}).`,
      "Public evidence URL pending owner approval.",
    ],
  },
  {
    claimId: "average-rating",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.rating,
    displayLocations: ["homepage-reviews-section"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.rating (${HOME_CLAIMS.rating}).`,
      `Review mode: ${HOME_REVIEW_MODE} — aggregate only, no named excerpts.`,
      "No aggregateRating schema permitted.",
    ],
  },
  {
    claimId: "client-reviews",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.reviews,
    displayLocations: ["homepage-reviews-section"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.reviews (${HOME_CLAIMS.reviews}).`,
      "No Review schema or named testimonial quotes published.",
    ],
  },
  {
    claimId: "warranty-years",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.warranty,
    displayLocations: ["homepage-proof-strip", "homepage-value"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.warrantyYears (${HOME_CLAIMS.warrantyYears}).`,
      "Detailed warranty category terms pending — see warranty-matrix.ts.",
      "No Warranty schema permitted.",
    ],
    structuredDataPermission: false,
    namedReviewPermission: false,
  },
  {
    claimId: "client-satisfaction",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.satisfaction,
    displayLocations: ["homepage-reviews-section"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.clientSatisfactionPercent (${HOME_CLAIMS.clientSatisfactionPercent}).`,
    ],
  },
  {
    claimId: "custom-designs",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.customDesigns,
    displayLocations: ["homepage-value"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Numeric source: HOME_CLAIMS.customDesignPercent (${HOME_CLAIMS.customDesignPercent}).`,
    ],
  },
  {
    claimId: "own-manufacturing-unit",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.manufacturing,
    displayLocations: ["homepage-factory-section"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Boolean source: HOME_CLAIMS.ownsManufacturingUnit (${HOME_CLAIMS.ownsManufacturingUnit}).`,
      "No fake factory address published.",
    ],
  },
  {
    claimId: "free-design-consultation",
    sourceModule: "@/features/public-site/home-r4/claims.ts",
    displayCopy: HOME_CLAIM_COPY.freeConsultation,
    displayLocations: ["homepage-hero", "homepage-cta"],
    ownerApprovalDisplayCopy: true,
    publicEvidenceStatus: "pending",
    legalTermsStatus: "pending",
    structuredDataPermission: false,
    namedReviewPermission: false,
    reviewNotes: [
      `Boolean source: HOME_CLAIMS.freeDesignConsultation (${HOME_CLAIMS.freeDesignConsultation}).`,
      "Current website does not book or submit consultations.",
    ],
  },
] as const;

export function allClaimsUseStructuredDataDenied(
  entries: readonly BusinessTruthEntry[] = BUSINESS_TRUTH_REGISTRY
): boolean {
  return entries.every((entry) => !entry.structuredDataPermission);
}

export function allClaimsOwnerApprovedForDisplay(
  entries: readonly BusinessTruthEntry[] = BUSINESS_TRUTH_REGISTRY
): boolean {
  return entries.every((entry) => entry.ownerApprovalDisplayCopy === true);
}
