/**
 * Phase 3A1.1 — legal foundation public API.
 */

export {
  BUSINESS_IDENTITY,
  DEFAULT_CONTACT_ROLE_MAPPING,
  doesGenericCompletenessActivateAllFeatures,
  getMissingCoreLegalPublicationFields,
  getMissingEntityRegistrationFields,
  getMissingLeadIntakeActivationFields,
  getMissingLegalPublicationFields,
  getMissingWarrantyPublicationFields,
  getMissingWhatsAppActivationFields,
  hasCompleteBusinessIdentity,
  hasPlaceholderText,
  isWhatsAppActivationReady,
  type BusinessEntityType,
  type BusinessIdentity,
  type GstinApplicability,
  type LeadIntakeActivationInput,
  type LegalContactRoleMapping,
  type RegistrationIdentifierRequirement,
  type WhatsAppActivationInput,
} from "./business-identity.ts";

export {
  allClaimsOwnerApprovedForDisplay,
  allClaimsUseStructuredDataDenied,
  BUSINESS_TRUTH_REGISTRY,
  BUSINESS_TRUTH_REGISTRY_NOTES,
  type BusinessTruthEntry,
  type LegalTermsStatus,
  type PublicEvidenceStatus,
} from "./business-truth-registry.ts";

export {
  COMMUNICATION_CONSENT_CONTENT,
  type LegalContentSection as CommunicationConsentSection,
} from "./communication-consent-content.ts";

export {
  canUseCommunicationChannel,
  CONSENT_REGISTRY_STATUS,
  CONSENT_SEPARATION_RULES,
  CONSENT_VERSIONS,
  getConsentVersionByPurpose,
  marketingConsentIsOptional,
  serviceCommunicationExcludesWhatsApp,
  type CommunicationChannelCheckInput,
  type CommunicationChannelEligibility,
  type ConsentApprovalRecord,
  type ConsentChannel,
  type ConsentPurposeCode,
  type ConsentRecordContract,
  type ConsentRecordStatus,
  type ConsentVersion,
  type ConsentVersionStatus,
} from "./consent-registry.ts";

export {
  DATA_INVENTORY,
  DATA_INVENTORY_CURRENT_TRUTH,
  type DataInventoryEntry,
  type DataInventoryTiming,
  type DataRiskLevel,
} from "./data-inventory.ts";

export {
  DATA_RIGHTS_CONTENT,
  type DataRightsRequestContract,
  type DataRightsRequestType,
  type LegalContentSection as DataRightsSection,
} from "./data-rights-content.ts";

export {
  DATA_RIGHTS_REQUEST_TEMPLATE,
  DATA_RIGHTS_REQUEST_TEMPLATE_INTRO,
  getDataRightsRequestTemplateText,
} from "./data-rights-request-template.ts";

export {
  canPublishLegalPolicies,
  canPublishWarrantyPolicy,
  getLegalRobots,
  isLegalDraftMode,
  isWarrantyPublicationReady,
  LEGAL_DPDP_READINESS_STATEMENT,
  LEGAL_DRAFT_BANNER,
  LEGAL_PUBLICATION_MODE,
  LEGAL_ROUTE_PATHS,
  type LegalPublicationChecklist,
  type LegalPublicationMode,
  type LegalRoutePath,
  type WarrantyPublicationReadinessInput,
} from "./legal-publication.ts";

export {
  allSourcesHaveHttpsUrls,
  DPDP_ACT_2023,
  DPDP_COMMENCEMENT_STAGES,
  DPDP_CORE_PRINCIPLES,
  DPDP_ENFORCEMENT_TIMELINE,
  DPDP_RULES_2025,
  DPDP_RULES_2025_CORRIGENDUM,
  isAllowlistedAuthority,
  LEGAL_DPDP_READINESS_STATEMENT as LEGAL_SOURCES_DPDP_READINESS,
  LEGAL_SOURCE_AUTHORITIES,
  LEGAL_SOURCE_REGISTRY,
  LEGAL_SOURCE_REGISTRY_COUNT,
  MEITY_DPDP_RULES_LANDING_URL,
  MEITY_ENFORCEMENT_TIMELINE_NOTES,
  type DpdpCommencementStage,
  type LegalSourceAuthority,
  type LegalSourceReference,
  type LegalSourceStatus,
  type LegalSourceType,
} from "./legal-sources.ts";

export {
  getCurrentProcessors,
  getPlannedProcessors,
  noSignedDpaClaimed,
  PROCESSOR_REGISTER,
  type ProcessorRegisterEntry,
  type ProcessorStatus,
} from "./processor-register.ts";

export {
  PRIVACY_POLICY_CONTENT,
  type LegalContentSection as PrivacyPolicySection,
} from "./privacy-policy-content.ts";

export {
  allRetentionPeriodsUnresolved,
  RETENTION_MATRIX,
  RETENTION_OWNER_DECISION_REQUIRED,
  type RetentionCategoryId,
  type RetentionDecisionStatus,
  type RetentionMatrixEntry,
} from "./retention-matrix.ts";

export {
  TERMS_OF_USE_CONTENT,
  type LegalContentSection as TermsSection,
} from "./terms-content.ts";

export {
  allWarrantyPeriodsPending,
  WARRANTY_CATEGORIES,
  WARRANTY_MATRIX_STATUS,
  type WarrantyCategoryEntry,
  type WarrantyCategoryId,
  type WarrantyCategoryStatus,
} from "./warranty-matrix.ts";

export {
  WARRANTY_DRAFT_NOTICE,
  WARRANTY_MARKETING_CLAIM_LABEL,
  WARRANTY_MARKETING_CLAIM_YEARS,
  WARRANTY_NOT_EFFECTIVE_STATEMENT,
  WARRANTY_POLICY_META,
  WARRANTY_POLICY_SECTIONS,
  WARRANTY_POLICY_STATUS,
  type WarrantyPolicyMeta,
  type WarrantyPolicyStatus,
} from "./warranty-policy.ts";
