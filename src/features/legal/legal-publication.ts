/**
 * Phase 3A1 — legal publication gate.
 * Draft-review mode until owner and Indian legal counsel approve all mandatory fields.
 */

import {
  BUSINESS_IDENTITY,
  getMissingLegalPublicationFields,
  hasPlaceholderText,
  type BusinessIdentity,
} from "./business-identity.ts";
import { WARRANTY_POLICY_STATUS } from "./warranty-policy.ts";

export type LegalPublicationMode =
  | "draft-review"
  | "owner-approved"
  | "published";

export const LEGAL_PUBLICATION_MODE: LegalPublicationMode = "draft-review";

export const LEGAL_DRAFT_BANNER =
  "Draft for owner and Indian legal counsel review — not yet effective." as const;

export const LEGAL_DPDP_READINESS_STATEMENT =
  "Designed for DPDP readiness; owner, operational and Indian legal-counsel review remain pending." as const;

export const LEGAL_ROUTE_PATHS = [
  "/privacy",
  "/terms",
  "/warranty",
  "/data-rights",
  "/communication-consent",
] as const;

export type LegalRoutePath = (typeof LEGAL_ROUTE_PATHS)[number];

export interface LegalPublicationChecklist {
  readonly getMissingIdentityFields?: () => readonly string[];
  readonly isWarrantyApproved?: () => boolean;
  readonly hasPlaceholderValues?: (identity: BusinessIdentity) => boolean;
}

const defaultChecklist: Required<LegalPublicationChecklist> = {
  getMissingIdentityFields: () => getMissingLegalPublicationFields(),
  isWarrantyApproved: () => WARRANTY_POLICY_STATUS === "owner-approved",
  hasPlaceholderValues: (identity) => {
    const stringFields = [
      identity.legalEntityName,
      identity.registeredOfficeAddress,
      identity.operatingOfficeAddress,
      identity.businessEmail,
      identity.privacyEmail,
      identity.grievanceEmail,
      identity.dataRightsRequestEmail,
      identity.warrantyClaimsEmail,
      identity.businessPhoneE164,
      identity.WhatsAppBusinessPhoneE164,
      identity.GSTIN,
      identity.cinOrLlpin,
      identity.authorisedRepresentative,
      identity.grievanceContact,
      identity.jurisdictionClause,
      identity.arbitrationDisputeClause,
      identity.legalCounselApprovalReference,
    ];
    return stringFields.some((field) => hasPlaceholderText(field));
  },
};

export function isLegalDraftMode(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): boolean {
  return mode === "draft-review";
}

export function getLegalRobots(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE
): { readonly index: false; readonly follow: false } | { readonly index: true; readonly follow: true } {
  if (mode === "published") {
    return { index: true, follow: true };
  }
  return { index: false, follow: false };
}

export function canPublishLegalPolicies(
  mode: LegalPublicationMode = LEGAL_PUBLICATION_MODE,
  identity: BusinessIdentity = BUSINESS_IDENTITY,
  checklist: LegalPublicationChecklist = {}
): boolean {
  if (mode === "draft-review") {
    return false;
  }

  const resolved = { ...defaultChecklist, ...checklist };

  if (resolved.getMissingIdentityFields().length > 0) {
    return false;
  }

  if (resolved.hasPlaceholderValues(identity)) {
    return false;
  }

  if (!resolved.isWarrantyApproved()) {
    return false;
  }

  if (identity.legalCounselApprovalReference == null) {
    return false;
  }

  if (mode === "owner-approved") {
    return false;
  }

  return mode === "published";
}
