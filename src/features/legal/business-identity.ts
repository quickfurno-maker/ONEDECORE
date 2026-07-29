/**
 * Phase 3A1.1 — business identity and feature-activation field gates.
 * Known trading name and service region only; no invented contacts.
 */

export type BusinessEntityType =
  | "proprietorship"
  | "partnership"
  | "llp"
  | "private-limited"
  | "other"
  | null;

/** Owner must explicitly declare GSTIN applicability. */
export type GstinApplicability =
  | "applicable"
  | "not-applicable"
  | "pending-owner-decision";

/**
 * Explicit registration-identifier requirement.
 * `"other"` entity types must not assume CIN unless the owner classifies them as requiring one.
 */
export type RegistrationIdentifierRequirement =
  | "cin"
  | "llpin"
  | "other-registration"
  | "not-applicable"
  | "pending-owner-decision";

/**
 * Explicit owner-approved contact role mapping.
 * Do not silently decide that one mailbox serves multiple roles.
 */
export interface LegalContactRoleMapping {
  readonly privacyAndGrievanceCombined: boolean;
  readonly privacyAndDataRightsCombined: boolean;
  readonly phoneIsPublicContact: boolean;
  readonly operatingOfficeSameAsRegistered: boolean;
}

export interface BusinessIdentity {
  readonly tradingName: string;
  readonly serviceRegion: string;
  readonly legalEntityName: string | null;
  readonly entityType: BusinessEntityType;
  readonly registeredOfficeAddress: string | null;
  readonly operatingOfficeAddress: string | null;
  readonly businessEmail: string | null;
  readonly privacyEmail: string | null;
  readonly grievanceEmail: string | null;
  readonly dataRightsRequestEmail: string | null;
  readonly warrantyClaimsEmail: string | null;
  readonly businessPhoneE164: string | null;
  readonly WhatsAppBusinessPhoneE164: string | null;
  readonly GSTIN: string | null;
  readonly cinOrLlpin: string | null;
  readonly authorisedRepresentative: string | null;
  readonly grievanceContact: string | null;
  readonly jurisdictionClause: string | null;
  readonly arbitrationDisputeClause: string | null;
  readonly legalCounselApprovalReference: string | null;
  readonly gstinApplicability: GstinApplicability;
  readonly registrationIdentifierRequirement: RegistrationIdentifierRequirement;
  readonly contactRoleMapping: LegalContactRoleMapping;
}

export const DEFAULT_CONTACT_ROLE_MAPPING: LegalContactRoleMapping = {
  privacyAndGrievanceCombined: false,
  privacyAndDataRightsCombined: false,
  phoneIsPublicContact: false,
  operatingOfficeSameAsRegistered: false,
} as const;

export const BUSINESS_IDENTITY: BusinessIdentity = {
  tradingName: "ONEDECORE",
  serviceRegion: "Pune, Maharashtra, India",
  legalEntityName: null,
  entityType: null,
  registeredOfficeAddress: null,
  operatingOfficeAddress: null,
  businessEmail: null,
  privacyEmail: null,
  grievanceEmail: null,
  dataRightsRequestEmail: null,
  warrantyClaimsEmail: null,
  businessPhoneE164: null,
  WhatsAppBusinessPhoneE164: null,
  GSTIN: null,
  cinOrLlpin: null,
  authorisedRepresentative: null,
  grievanceContact: null,
  jurisdictionClause: null,
  arbitrationDisputeClause: null,
  legalCounselApprovalReference: null,
  gstinApplicability: "pending-owner-decision",
  registrationIdentifierRequirement: "pending-owner-decision",
  contactRoleMapping: DEFAULT_CONTACT_ROLE_MAPPING,
} as const;

const PLACEHOLDER_PATTERN =
  /\b(TODO|TBD|PLACEHOLDER|\[pending\])\b/i;

export function hasPlaceholderText(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") return false;
  return PLACEHOLDER_PATTERN.test(value);
}

function missingOrPlaceholder(
  key: string,
  value: string | null | undefined
): string | null {
  if (value == null || value.trim() === "") return key;
  if (hasPlaceholderText(value)) return `${key} (placeholder)`;
  return null;
}

function pushMissing(
  missing: string[],
  key: string,
  value: string | null | undefined
): void {
  const result = missingOrPlaceholder(key, value);
  if (result) missing.push(result);
}

/**
 * Core fields required before publishing Privacy / Terms / Data Rights.
 * Does not require WhatsApp number, GSTIN, warranty claims email, or CIN/LLPIN.
 */
export function getMissingCoreLegalPublicationFields(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): readonly string[] {
  const missing: string[] = [];
  const map = identity.contactRoleMapping;

  pushMissing(missing, "legalEntityName", identity.legalEntityName);
  if (identity.entityType == null) missing.push("entityType");
  pushMissing(missing, "registeredOfficeAddress", identity.registeredOfficeAddress);

  if (map.operatingOfficeSameAsRegistered) {
    // Explicit owner-approved path: operating may equal registered without duplicate text.
  } else {
    pushMissing(missing, "operatingOfficeAddress", identity.operatingOfficeAddress);
  }

  pushMissing(missing, "businessEmail", identity.businessEmail);
  pushMissing(missing, "privacyEmail", identity.privacyEmail);

  if (map.privacyAndGrievanceCombined) {
    // Owner-approved combined privacy/grievance channel via privacyEmail.
  } else {
    pushMissing(missing, "grievanceEmail", identity.grievanceEmail);
  }

  if (map.privacyAndDataRightsCombined) {
    // Owner-approved combined privacy/data-rights channel via privacyEmail.
  } else {
    pushMissing(missing, "dataRightsRequestEmail", identity.dataRightsRequestEmail);
  }

  if (map.phoneIsPublicContact) {
    pushMissing(missing, "businessPhoneE164", identity.businessPhoneE164);
  }

  pushMissing(missing, "authorisedRepresentative", identity.authorisedRepresentative);
  pushMissing(missing, "grievanceContact", identity.grievanceContact);
  pushMissing(missing, "jurisdictionClause", identity.jurisdictionClause);
  pushMissing(
    missing,
    "legalCounselApprovalReference",
    identity.legalCounselApprovalReference
  );

  return missing;
}

/** Backward-compatible alias: core Privacy/Terms/Data Rights publication only. */
export function getMissingLegalPublicationFields(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): readonly string[] {
  return getMissingCoreLegalPublicationFields(identity);
}

export function getMissingWarrantyPublicationFields(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): readonly string[] {
  const missing = [...getMissingCoreLegalPublicationFields(identity)];
  pushMissing(missing, "warrantyClaimsEmail", identity.warrantyClaimsEmail);
  return missing;
}

export function getMissingEntityRegistrationFields(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): readonly string[] {
  const missing: string[] = [];

  if (identity.gstinApplicability === "pending-owner-decision") {
    missing.push("gstinApplicability");
  } else if (identity.gstinApplicability === "applicable") {
    pushMissing(missing, "GSTIN", identity.GSTIN);
  }

  // Proprietorship / partnership: no CIN/LLPIN requirement.
  if (
    identity.entityType === "proprietorship" ||
    identity.entityType === "partnership"
  ) {
    return missing;
  }

  if (identity.entityType === "private-limited") {
    pushMissing(missing, "cinOrLlpin (CIN when applicable)", identity.cinOrLlpin);
    return missing;
  }

  if (identity.entityType === "llp") {
    pushMissing(missing, "cinOrLlpin (LLPIN when applicable)", identity.cinOrLlpin);
    return missing;
  }

  // entityType === "other" | null — never assume CIN.
  // Owner must set registrationIdentifierRequirement explicitly.
  if (identity.registrationIdentifierRequirement === "pending-owner-decision") {
    missing.push("registrationIdentifierRequirement");
  } else if (identity.registrationIdentifierRequirement === "cin") {
    pushMissing(missing, "cinOrLlpin (CIN when applicable)", identity.cinOrLlpin);
  } else if (identity.registrationIdentifierRequirement === "llpin") {
    pushMissing(missing, "cinOrLlpin (LLPIN when applicable)", identity.cinOrLlpin);
  } else if (identity.registrationIdentifierRequirement === "other-registration") {
    pushMissing(
      missing,
      "cinOrLlpin (other registration identifier)",
      identity.cinOrLlpin
    );
  }
  // "not-applicable": no identifier required

  return missing;
}

export interface WhatsAppActivationInput {
  readonly identity?: BusinessIdentity;
  readonly whatsappConsentVersionApproved?: boolean;
  readonly whatsappNoticeVersionApproved?: boolean;
  readonly metaProcessorReviewComplete?: boolean;
  readonly whatsappOptOutSuppressionWorkflowReady?: boolean;
  readonly whatsappTemplatePolicyApproved?: boolean;
  readonly serviceCommunicationPolicyApproved?: boolean;
}

/**
 * WhatsApp activation requirements.
 * Production defaults remain incomplete. A complete fixture can return [].
 * Marketing approval is intentionally not required for service-only WhatsApp.
 */
export function getMissingWhatsAppActivationFields(
  input: WhatsAppActivationInput | BusinessIdentity = {}
): readonly string[] {
  // Backward-compatible: a bare BusinessIdentity was previously accepted.
  const normalized: WhatsAppActivationInput =
    input &&
    typeof input === "object" &&
    "tradingName" in input &&
    "serviceRegion" in input
      ? { identity: input as BusinessIdentity }
      : (input as WhatsAppActivationInput);

  const identity = normalized.identity ?? BUSINESS_IDENTITY;
  const missing: string[] = [];

  pushMissing(
    missing,
    "WhatsAppBusinessPhoneE164",
    identity.WhatsAppBusinessPhoneE164
  );

  if (!normalized.whatsappConsentVersionApproved) {
    missing.push("whatsappConsentVersionApproved");
  }
  if (!normalized.whatsappNoticeVersionApproved) {
    missing.push("whatsappNoticeVersionApproved");
  }
  if (!normalized.metaProcessorReviewComplete) {
    missing.push("metaProcessorReviewComplete");
  }
  if (!normalized.whatsappOptOutSuppressionWorkflowReady) {
    missing.push("whatsappOptOutSuppressionWorkflowReady");
  }
  if (!normalized.whatsappTemplatePolicyApproved) {
    missing.push("whatsappTemplatePolicyApproved");
  }
  if (!normalized.serviceCommunicationPolicyApproved) {
    missing.push("serviceCommunicationPolicyApproved");
  }

  return missing;
}

export function isWhatsAppActivationReady(
  input: WhatsAppActivationInput = {}
): boolean {
  return getMissingWhatsAppActivationFields(input).length === 0;
}

export interface LeadIntakeActivationInput {
  readonly identity?: BusinessIdentity;
  readonly privacyTermsVersionApproved?: boolean;
  readonly serviceEnquiryCopyApproved?: boolean;
  readonly serviceCommunicationCopyApproved?: boolean;
  readonly leadRetentionDecided?: boolean;
  readonly consentRetentionDecided?: boolean;
  readonly auditRetentionDecided?: boolean;
  readonly suppressionRetentionDecided?: boolean;
  readonly leadProcessorsRegistered?: boolean;
}

export function getMissingLeadIntakeActivationFields(
  input: LeadIntakeActivationInput = {}
): readonly string[] {
  const identity = input.identity ?? BUSINESS_IDENTITY;
  const missing: string[] = [...getMissingCoreLegalPublicationFields(identity)];

  if (!input.privacyTermsVersionApproved) missing.push("privacyTermsVersionApproved");
  if (!input.serviceEnquiryCopyApproved) missing.push("serviceEnquiryCopyApproved");
  if (!input.serviceCommunicationCopyApproved) {
    missing.push("serviceCommunicationCopyApproved");
  }
  if (!input.leadRetentionDecided) missing.push("leadRetentionDecided");
  if (!input.consentRetentionDecided) missing.push("consentRetentionDecided");
  if (!input.auditRetentionDecided) missing.push("auditRetentionDecided");
  if (!input.suppressionRetentionDecided) missing.push("suppressionRetentionDecided");
  if (!input.leadProcessorsRegistered) missing.push("leadProcessorsRegistered");

  return missing;
}

export function hasCompleteBusinessIdentity(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): boolean {
  return getMissingCoreLegalPublicationFields(identity).length === 0;
}

/** Generic completeness must not activate WhatsApp, warranty, or lead intake. */
export function doesGenericCompletenessActivateAllFeatures(): false {
  return false;
}
