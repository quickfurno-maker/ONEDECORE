/**
 * Phase 3A1.2 — legal publication and warranty readiness gates.
 * Core Privacy/Terms/Data Rights publication is separate from warranty.
 */

import {
  BUSINESS_IDENTITY,
  getMissingCoreLegalPublicationFields,
  getMissingLegalPublicationFields,
  getMissingWarrantyPublicationFields,
  hasPlaceholderText,
  type BusinessIdentity,
} from "./business-identity.ts";
import {
  allWarrantyPeriodsPending,
  WARRANTY_MATRIX_STATUS,
} from "./warranty-matrix.ts";
import {
  WARRANTY_POLICY_STATUS,
  type WarrantyPolicyStatus,
} from "./warranty-policy.ts";

export type LegalPublicationMode =
  | "draft-review"
  | "owner-approved"
  | "published";

/**
 * Owner approved Privacy/Terms/consent customer copy (PR #92).
 * Not published / not effective until activation sets mode=published with a real date.
 */
export const LEGAL_PUBLICATION_MODE: LegalPublicationMode = "owner-approved";

export const LEGAL_DRAFT_BANNER =
  "Draft for owner and Indian legal counsel review — not yet effective." as const;

export const LEGAL_OWNER_APPROVED_BANNER =
  "Owner-approved legal copy — not yet effective. Effective date is set only on authorized production activation." as const;

export const LEGAL_DPDP_READINESS_STATEMENT =
  "Designed for DPDP readiness; owner, operational and Indian legal-counsel review remain pending." as const;

/** Forbidden on published customer pages. */
export const LEGAL_EFFECTIVE_DATE_PLACEHOLDER =
  "To be set to the calendar date of authorized production activation" as const;

export const LEGAL_ROUTE_PATHS = [
  "/privacy",
  "/terms",
  "/warranty",
  "/data-rights",
  "/communication-consent",
] as const;

export type LegalRoutePath = (typeof LEGAL_ROUTE_PATHS)[number];

export interface WarrantyPublicationReadinessInput {
  readonly status?: WarrantyPolicyStatus;
  readonly matrixStatus?: typeof WARRANTY_MATRIX_STATUS;
  readonly periodsPending?: boolean;
  readonly matrixApproved?: boolean;
  readonly legalReviewComplete?: boolean;
  readonly identity?: BusinessIdentity;
}

/**
 * Warranty is publication-ready only when status is owner-approved or published
 * AND identity / matrix / period / legal-review gates are satisfied.
 * Current production defaults remain pending → false.
 */
export function isWarrantyPublicationReady(
  input: WarrantyPublicationReadinessInput = {}
): boolean {
  const status = input.status ?? WARRANTY_POLICY_STATUS;
  if (status !== "owner-approved" && status !== "published") {
    return false;
  }

  const identity = input.identity ?? BUSINESS_IDENTITY;
  if (getMissingWarrantyPublicationFields(identity).length > 0) {
    return false;
  }

  const periodsPending = input.periodsPending ?? allWarrantyPeriodsPending();
  if (periodsPending) {
    return false;
  }

  const matrixApproved =
    input.matrixApproved ??
    (input.matrixStatus ?? WARRANTY_MATRIX_STATUS) !==
      "scope-pending-owner-approval";
  if (!matrixApproved) {
    return false;
  }

  const legalReviewComplete = input.legalReviewComplete ?? false;
  if (!legalReviewComplete) {
    return false;
  }

  return true;
}

/** Core Privacy/Terms/Data Rights checklist — no warranty readiness fields. */
export interface LegalPublicationChecklist {
  readonly getMissingIdentityFields?: () => readonly string[];
  readonly hasPlaceholderValues?: (identity: BusinessIdentity) => boolean;
}

function defaultHasPlaceholderValues(identity: BusinessIdentity): boolean {
  const stringFields = [
    identity.legalEntityName,
    identity.registeredOfficeAddress,
    identity.operatingOfficeAddress,
    identity.businessEmail,
    identity.privacyEmail,
    identity.grievanceEmail,
    identity.dataRightsRequestEmail,
    identity.businessPhoneE164,
    identity.authorisedRepresentative,
    identity.grievanceContact,
    identity.jurisdictionClause,
    identity.arbitrationDisputeClause,
    identity.legalCounselApprovalReference,
  ];
  return stringFields.some((field) => hasPlaceholderText(field));
}

export function isLegalDraftMode(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): boolean {
  return mode === "draft-review";
}

export function isLegalOwnerApprovedMode(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): boolean {
  return mode === "owner-approved";
}

export function isLegalPublishedMode(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): boolean {
  return mode === "published";
}

/** True calendar date YYYY-MM-DD — rejects placeholders and empty values. */
export function isRealLegalEffectiveDate(
  value: string | null | undefined
): value is string {
  if (value == null) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (/placeholder|to be set|authorized production activation/i.test(trimmed)) {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
}

/**
 * Published customer pages require a real effective date.
 * Owner-approved / draft-review must not claim published effectiveness.
 */
export function canRenderPublishedLegalDocument(input: {
  readonly mode?: LegalPublicationMode;
  readonly effectiveDate: string | null | undefined;
}): boolean {
  const mode = input.mode ?? LEGAL_PUBLICATION_MODE;
  if (mode !== "published") return false;
  return isRealLegalEffectiveDate(input.effectiveDate);
}

export function getLegalRobots(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
):
  | { readonly index: false; readonly follow: false }
  | { readonly index: true; readonly follow: true } {
  if (mode === "published") {
    return { index: true, follow: true };
  }
  return { index: false, follow: false };
}

/**
 * Privacy/Terms/Data Rights publication gate.
 * Does not depend on warranty readiness — use canPublishWarrantyPolicy() /
 * isWarrantyPublicationReady() for the Warranty page.
 */
export function canPublishLegalPolicies(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE,
  identity: BusinessIdentity = BUSINESS_IDENTITY,
  checklist: LegalPublicationChecklist = {}
): boolean {
  if (mode === "draft-review") {
    return false;
  }

  // Always evaluate missing fields against the identity under review so a
  // complete fixture can satisfy the gate (production defaults stay incomplete).
  const getMissingIdentityFields =
    checklist.getMissingIdentityFields ??
    (() => getMissingCoreLegalPublicationFields(identity));
  const hasPlaceholderValues =
    checklist.hasPlaceholderValues ?? defaultHasPlaceholderValues;

  if (getMissingIdentityFields().length > 0) {
    return false;
  }

  if (hasPlaceholderValues(identity)) {
    return false;
  }

  // Counsel reference is optional metadata. Owner-approved effective Privacy/Terms
  // content is gated by publication mode + identity completeness, not a fabricated
  // counsel reference. No ADR hard-locks counsel as a lead-intake dependency.

  if (mode === "owner-approved") {
    return false;
  }

  return mode === "published";
}

/**
 * Effective Warranty page publication (separate from Privacy/Terms).
 */
export function canPublishWarrantyPolicy(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE,
  input: WarrantyPublicationReadinessInput = {}
): boolean {
  if (mode === "draft-review") return false;
  if (mode === "owner-approved") return false;
  return isWarrantyPublicationReady(input);
}

export {
  getMissingLegalPublicationFields,
  getMissingCoreLegalPublicationFields,
  getMissingWarrantyPublicationFields,
};
