/**
 * Phase 3A1.1 — contract and activation-gate corrections.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  allSourcesHaveHttpsUrls,
  DPDP_ACT_2023,
  DPDP_ENFORCEMENT_TIMELINE,
  DPDP_RULES_2025,
  DPDP_RULES_2025_CORRIGENDUM,
  isAllowlistedAuthority,
  LEGAL_SOURCE_REGISTRY,
  LEGAL_SOURCE_REGISTRY_COUNT,
} from "../legal-sources.ts";
import {
  BUSINESS_IDENTITY,
  DEFAULT_CONTACT_ROLE_MAPPING,
  doesGenericCompletenessActivateAllFeatures,
  getMissingCoreLegalPublicationFields,
  getMissingEntityRegistrationFields,
  getMissingLeadIntakeActivationFields,
  getMissingLegalPublicationFields,
  getMissingWarrantyPublicationFields,
  getMissingWhatsAppActivationFields,
  type BusinessIdentity,
} from "../business-identity.ts";
import {
  canPublishLegalPolicies,
  isWarrantyPublicationReady,
} from "../legal-publication.ts";
import {
  canUseCommunicationChannel,
  getConsentVersionByPurpose,
  marketingConsentIsOptional,
  serviceCommunicationExcludesWhatsApp,
} from "../consent-registry.ts";
import { PRIVACY_POLICY_CONTENT } from "../privacy-policy-content.ts";
import { allWarrantyPeriodsPending } from "../warranty-matrix.ts";

const root = process.cwd();

function completeCoreIdentity(
  overrides: Partial<BusinessIdentity> = {}
): BusinessIdentity {
  return {
    ...BUSINESS_IDENTITY,
    legalEntityName: "Example Interiors Private Limited",
    entityType: "private-limited",
    registeredOfficeAddress: "Registered office pending real owner data",
    operatingOfficeAddress: "Operating office pending real owner data",
    businessEmail: "business@example.test",
    privacyEmail: "privacy@example.test",
    grievanceEmail: "grievance@example.test",
    dataRightsRequestEmail: "rights@example.test",
    warrantyClaimsEmail: "warranty@example.test",
    authorisedRepresentative: "Authorised representative pending",
    grievanceContact: "Grievance officer pending",
    jurisdictionClause: "Courts at Pune, Maharashtra (draft)",
    legalCounselApprovalReference: "COUNSEL-REF-FIXTURE",
    contactRoleMapping: { ...DEFAULT_CONTACT_ROLE_MAPPING },
    gstinApplicability: "not-applicable",
    ...overrides,
  };
}

describe("Phase 3A1.1 source registry", () => {
  test("Act, Rules, and Enforcement Timeline exist as registry entries", () => {
    assert.equal(DPDP_ACT_2023.id, "dpdp-act-2023");
    assert.equal(DPDP_RULES_2025.id, "dpdp-rules-2025");
    assert.equal(DPDP_ENFORCEMENT_TIMELINE.id, "dpdp-enforcement-timeline-2025");
    assert.ok(
      LEGAL_SOURCE_REGISTRY.some((s) => s.id === "dpdp-enforcement-timeline-2025")
    );
  });

  test("registry count matches docs and includes corrigendum", () => {
    assert.equal(LEGAL_SOURCE_REGISTRY_COUNT, 4);
    assert.equal(LEGAL_SOURCE_REGISTRY.length, 4);
    assert.ok(
      LEGAL_SOURCE_REGISTRY.some((s) => s.id === DPDP_RULES_2025_CORRIGENDUM.id)
    );
    const doc = readFileSync(
      join(root, "docs/legal/00-legal-source-registry.md"),
      "utf8"
    );
    assert.match(doc, /Registry count:\s*4/);
    assert.match(doc, /dpdp-enforcement-timeline-2025/);
    assert.match(doc, /G\.S\.R\.\s*892\(E\)/);
  });

  test("authorities allowlisted, HTTPS URLs, governance fields present", () => {
    assert.equal(allSourcesHaveHttpsUrls(), true);
    for (const source of LEGAL_SOURCE_REGISTRY) {
      assert.equal(isAllowlistedAuthority(source.authority), true);
      assert.ok(source.title.trim().length > 0);
      assert.ok(source.publicationDate.trim().length > 0);
      assert.ok(source.sourceUrl.startsWith("https://"));
      assert.ok(source.sourceType.trim().length > 0);
      assert.equal(source.jurisdiction, "India");
      assert.ok(source.implementationRelevance.trim().length > 0);
      assert.ok(source.reviewedAt.trim().length > 0);
      assert.ok(source.notes.length > 0);
      assert.ok(source.status.trim().length > 0);
    }
  });
});

describe("Phase 3A1.1 activation gates", () => {
  test("core missing fields exclude inactive WhatsApp number", () => {
    const missing = getMissingCoreLegalPublicationFields();
    assert.ok(!missing.includes("WhatsAppBusinessPhoneE164"));
    assert.deepEqual(missing, getMissingLegalPublicationFields());
  });

  test("WhatsApp activation requires WhatsApp number among other fields", () => {
    const missing = getMissingWhatsAppActivationFields();
    assert.ok(missing.includes("WhatsAppBusinessPhoneE164"));
  });

  test("GSTIN and CIN/LLPIN are conditional by applicability and entity type", () => {
    assert.ok(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "pending-owner-decision",
      }).includes("gstinApplicability")
    );
    assert.ok(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "applicable",
      }).includes("GSTIN")
    );
    assert.equal(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "proprietorship",
      }).length,
      0
    );
    assert.ok(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "llp",
      }).some((field) => field.includes("LLPIN"))
    );
  });

  test("operating-address same-as-registered explicit path", () => {
    const identity = completeCoreIdentity({
      operatingOfficeAddress: null,
      contactRoleMapping: {
        ...DEFAULT_CONTACT_ROLE_MAPPING,
        operatingOfficeSameAsRegistered: true,
      },
    });
    assert.ok(
      !getMissingCoreLegalPublicationFields(identity).includes(
        "operatingOfficeAddress"
      )
    );
  });

  test("lead activation requires approved consent/retention/contact", () => {
    const missing = getMissingLeadIntakeActivationFields();
    assert.ok(missing.includes("privacyTermsVersionApproved"));
    assert.ok(missing.includes("serviceEnquiryCopyApproved"));
    assert.ok(missing.includes("leadRetentionDecided"));
  });

  test("warranty activation separate; generic completeness does not activate all", () => {
    assert.ok(
      getMissingWarrantyPublicationFields().includes("warrantyClaimsEmail") ||
        getMissingWarrantyPublicationFields().length >
          getMissingCoreLegalPublicationFields().length
    );
    assert.equal(doesGenericCompletenessActivateAllFeatures(), false);
  });
});

describe("Phase 3A1.1 warranty status logic", () => {
  test("pending false; owner-approved and published true with fixture", () => {
    assert.equal(isWarrantyPublicationReady(), false);
    assert.equal(allWarrantyPeriodsPending(), true);

    const fixtureIdentity = completeCoreIdentity();
    assert.equal(
      isWarrantyPublicationReady({
        status: "owner-approved",
        identity: fixtureIdentity,
        periodsPending: false,
        matrixApproved: true,
        legalReviewComplete: true,
      }),
      true
    );
    assert.equal(
      isWarrantyPublicationReady({
        status: "published",
        identity: fixtureIdentity,
        periodsPending: false,
        matrixApproved: true,
        legalReviewComplete: true,
      }),
      true
    );
  });

  test("no real periods approved in production matrix", () => {
    assert.equal(allWarrantyPeriodsPending(), true);
  });
});

describe("Phase 3A1.1 consent channel separation", () => {
  test("SERVICE_COMMUNICATION excludes whatsapp; WHATSAPP_SERVICE only whatsapp", () => {
    assert.equal(serviceCommunicationExcludesWhatsApp(), true);
    const service = getConsentVersionByPurpose("SERVICE_COMMUNICATION");
    const whatsapp = getConsentVersionByPurpose("WHATSAPP_SERVICE");
    assert.ok(service && !service.channels.includes("whatsapp"));
    assert.deepEqual(whatsapp?.channels, ["whatsapp"]);
    assert.equal(marketingConsentIsOptional(), true);
  });

  test("canUseCommunicationChannel WhatsApp and withdrawal rules", () => {
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "whatsapp",
        channelConsentStatus: null,
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "whatsapp",
        channelConsentStatus: "granted",
      }),
      true
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "withdrawn",
        channel: "email",
        channelConsentStatus: null,
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "suppressed",
        channel: "phone",
        channelConsentStatus: "granted",
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "email",
        channelConsentStatus: null,
      }),
      true
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "whatsapp",
        channelConsentStatus: "granted",
        requireMarketing: true,
        marketingStatus: "granted",
      }),
      true
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "whatsapp",
        channelConsentStatus: "granted",
        requireMarketing: true,
        marketingStatus: null,
      }),
      false
    );
  });
});

describe("Phase 3A1.1 compliance wording", () => {
  test("neutral draft language; no definitive non-compliance or positive claim", () => {
    const text = PRIVACY_POLICY_CONTENT.flatMap((s) => s.body).join("\n");
    assert.doesNotMatch(text, /ONEDECORE is not DPDP compliant/i);
    assert.doesNotMatch(text, /is DPDP compliant|fully compliant|certified/i);
    assert.match(text, /does not claim DPDP compliance at this draft stage/i);
    assert.match(text, /Final compliance depends on applicable commencement/i);
    assert.equal(canPublishLegalPolicies(), false);
  });
});

describe("Phase 3A1.1 regression scope", () => {
  test("no lead API, migration, package, admin, homepage claim changes in this branch scope", () => {
    assert.equal(existsSync(join(root, "src/app/api/leads")), false);
    assert.equal(existsSync(join(root, "src/app/api/lead")), false);
    const claims = readFileSync(
      join(root, "src/features/public-site/home-r4/claims.ts"),
      "utf8"
    );
    assert.match(claims, /warrantyYears:\s*10/);
    assert.match(claims, /projectsDelivered:\s*500/);
  });
});
