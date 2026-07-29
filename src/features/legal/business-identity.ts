/**
 * Phase 3A1 — business identity gate.
 * Known trading name and service region only; all legal/contact fields pending owner input.
 */

export type BusinessEntityType =
  | "proprietorship"
  | "partnership"
  | "llp"
  | "private-limited"
  | "other"
  | null;

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
}

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
} as const;

/** Mandatory publication fields — every key whose value is currently null. */
const MANDATORY_PUBLICATION_FIELD_KEYS = [
  "legalEntityName",
  "entityType",
  "registeredOfficeAddress",
  "operatingOfficeAddress",
  "businessEmail",
  "privacyEmail",
  "grievanceEmail",
  "dataRightsRequestEmail",
  "warrantyClaimsEmail",
  "businessPhoneE164",
  "WhatsAppBusinessPhoneE164",
  "GSTIN",
  "authorisedRepresentative",
  "grievanceContact",
  "jurisdictionClause",
  "arbitrationDisputeClause",
  "legalCounselApprovalReference",
] as const satisfies readonly (keyof BusinessIdentity)[];

export type MandatoryPublicationFieldKey =
  (typeof MANDATORY_PUBLICATION_FIELD_KEYS)[number];

const PLACEHOLDER_PATTERN =
  /\b(TODO|TBD|PLACEHOLDER|\[pending\])\b/i;

export function hasPlaceholderText(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") return false;
  return PLACEHOLDER_PATTERN.test(value);
}

export function getMissingLegalPublicationFields(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): readonly string[] {
  const missing: string[] = [];

  for (const key of MANDATORY_PUBLICATION_FIELD_KEYS) {
    const value = identity[key];
    if (value == null || (typeof value === "string" && value.trim() === "")) {
      missing.push(key);
    } else if (typeof value === "string" && hasPlaceholderText(value)) {
      missing.push(`${key} (placeholder)`);
    }
  }

  return missing;
}

export function hasCompleteBusinessIdentity(
  identity: BusinessIdentity = BUSINESS_IDENTITY
): boolean {
  return getMissingLegalPublicationFields(identity).length === 0;
}
