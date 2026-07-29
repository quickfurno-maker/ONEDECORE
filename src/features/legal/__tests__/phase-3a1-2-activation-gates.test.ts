/**
 * Phase 3A1.2 — satisfiable activation gates and channel eligibility matrix.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  BUSINESS_IDENTITY,
  DEFAULT_CONTACT_ROLE_MAPPING,
  doesGenericCompletenessActivateAllFeatures,
  getMissingCoreLegalPublicationFields,
  getMissingEntityRegistrationFields,
  getMissingWhatsAppActivationFields,
  hasCompleteBusinessIdentity,
  isWhatsAppActivationReady,
  type BusinessIdentity,
} from "../business-identity.ts";
import {
  canPublishLegalPolicies,
  canPublishWarrantyPolicy,
  isWarrantyPublicationReady,
} from "../legal-publication.ts";
import { canUseCommunicationChannel } from "../consent-registry.ts";
import { allWarrantyPeriodsPending } from "../warranty-matrix.ts";

const root = process.cwd();

function completeCoreIdentity(
  overrides: Partial<BusinessIdentity> = {}
): BusinessIdentity {
  return {
    ...BUSINESS_IDENTITY,
    legalEntityName: "Example Interiors Private Limited",
    entityType: "private-limited",
    registeredOfficeAddress: "Registered office fixture",
    operatingOfficeAddress: "Operating office fixture",
    businessEmail: "business@example.test",
    privacyEmail: "privacy@example.test",
    grievanceEmail: "grievance@example.test",
    dataRightsRequestEmail: "rights@example.test",
    warrantyClaimsEmail: "warranty@example.test",
    authorisedRepresentative: "Authorised representative fixture",
    grievanceContact: "Grievance officer fixture",
    jurisdictionClause: "Courts at Pune, Maharashtra (draft fixture)",
    legalCounselApprovalReference: "COUNSEL-REF-FIXTURE",
    gstinApplicability: "not-applicable",
    registrationIdentifierRequirement: "cin",
    cinOrLlpin: "U12345PN2020PTC000000",
    contactRoleMapping: { ...DEFAULT_CONTACT_ROLE_MAPPING },
    ...overrides,
  };
}

const completeWhatsAppFixture = {
  identity: {
    ...BUSINESS_IDENTITY,
    WhatsAppBusinessPhoneE164: "+919999999999",
  },
  whatsappConsentVersionApproved: true,
  whatsappNoticeVersionApproved: true,
  metaProcessorReviewComplete: true,
  whatsappOptOutSuppressionWorkflowReady: true,
  whatsappTemplatePolicyApproved: true,
  serviceCommunicationPolicyApproved: true,
} as const;

describe("Phase 3A1.2 WhatsApp activation gate", () => {
  test("production defaults incomplete and report each readiness flag", () => {
    const missing = getMissingWhatsAppActivationFields();
    assert.ok(missing.includes("WhatsAppBusinessPhoneE164"));
    assert.ok(missing.includes("whatsappConsentVersionApproved"));
    assert.ok(missing.includes("whatsappNoticeVersionApproved"));
    assert.ok(missing.includes("metaProcessorReviewComplete"));
    assert.ok(missing.includes("whatsappOptOutSuppressionWorkflowReady"));
    assert.ok(missing.includes("whatsappTemplatePolicyApproved"));
    assert.ok(missing.includes("serviceCommunicationPolicyApproved"));
    assert.equal(isWhatsAppActivationReady(), false);
  });

  test("each readiness flag reported independently", () => {
    assert.ok(
      getMissingWhatsAppActivationFields({
        identity: { ...BUSINESS_IDENTITY, WhatsAppBusinessPhoneE164: "+919999999999" },
        whatsappConsentVersionApproved: true,
      }).includes("whatsappNoticeVersionApproved")
    );
    assert.ok(
      !getMissingWhatsAppActivationFields({
        identity: { ...BUSINESS_IDENTITY, WhatsAppBusinessPhoneE164: "+919999999999" },
        whatsappConsentVersionApproved: true,
      }).includes("whatsappConsentVersionApproved")
    );
  });

  test("complete fixture returns [] and isWhatsAppActivationReady true", () => {
    assert.deepEqual(getMissingWhatsAppActivationFields(completeWhatsAppFixture), []);
    assert.equal(isWhatsAppActivationReady(completeWhatsAppFixture), true);
  });

  test("generic legal identity completeness does not activate WhatsApp", () => {
    const identity = completeCoreIdentity();
    assert.equal(hasCompleteBusinessIdentity(identity), true);
    assert.equal(getMissingCoreLegalPublicationFields(identity).length, 0);
    assert.ok(getMissingWhatsAppActivationFields({ identity }).length > 0);
    assert.equal(doesGenericCompletenessActivateAllFeatures(), false);
  });

  test("marketing approval not required for service-only WhatsApp", () => {
    const missing = getMissingWhatsAppActivationFields(completeWhatsAppFixture);
    assert.ok(!missing.some((field) => /marketing/i.test(field)));
  });
});

describe("Phase 3A1.2 channel eligibility matrix", () => {
  test("operational and marketing channel matrix", () => {
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
        channel: "email",
        channelConsentStatus: "granted",
      }),
      true
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "email",
        channelConsentStatus: "expired",
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "phone",
        channelConsentStatus: "withdrawn",
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "in-person",
        channelConsentStatus: "suppressed",
      }),
      false
    );
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
        serviceCommunicationStatus: "granted",
        channel: "whatsapp",
        channelConsentStatus: "expired",
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "email",
        channelConsentStatus: null,
        requireMarketing: true,
        marketingStatus: null,
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "granted",
        channel: "email",
        channelConsentStatus: null,
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
        channel: "email",
        channelConsentStatus: null,
        requireMarketing: true,
        marketingStatus: "expired",
      }),
      false
    );
    assert.equal(
      canUseCommunicationChannel({
        serviceCommunicationStatus: "expired",
        channel: "email",
        channelConsentStatus: null,
      }),
      false
    );
  });
});

describe("Phase 3A1.2 publication gates", () => {
  test("core publication has no warranty dependency; fixtures can pass", () => {
    const pubSource = readFileSync(
      join(root, "src/features/legal/legal-publication.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      pubSource,
      /canPublishLegalPolicies[\s\S]*isWarrantyReady/
    );
    assert.match(pubSource, /canPublishWarrantyPolicy/);
    assert.equal(canPublishLegalPolicies(), false);
    assert.equal(isWarrantyPublicationReady(), false);
    assert.equal(canPublishWarrantyPolicy("published"), false);

    const identity = completeCoreIdentity();
    assert.equal(canPublishLegalPolicies("published", identity), true);
    assert.equal(
      isWarrantyPublicationReady({
        status: "owner-approved",
        identity,
        periodsPending: false,
        matrixApproved: true,
        legalReviewComplete: true,
      }),
      true
    );
    assert.equal(
      canPublishWarrantyPolicy("published", {
        status: "published",
        identity,
        periodsPending: false,
        matrixApproved: true,
        legalReviewComplete: true,
      }),
      true
    );
    assert.equal(allWarrantyPeriodsPending(), true);
  });
});

describe("Phase 3A1.2 entity registration requirement", () => {
  test("proprietorship and partnership free of CIN/LLPIN; other needs owner decision", () => {
    assert.equal(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "proprietorship",
      }).length,
      0
    );
    assert.equal(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "partnership",
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
    assert.ok(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "private-limited",
      }).some((field) => field.includes("CIN"))
    );
    assert.ok(
      getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "other",
        registrationIdentifierRequirement: "pending-owner-decision",
      }).includes("registrationIdentifierRequirement")
    );
    assert.ok(
      !getMissingEntityRegistrationFields({
        ...BUSINESS_IDENTITY,
        gstinApplicability: "not-applicable",
        entityType: "other",
        registrationIdentifierRequirement: "not-applicable",
      }).includes("registrationIdentifierRequirement")
    );
  });
});

describe("Phase 3A1.2 regression", () => {
  test("routes, sitemap, no lead/WhatsApp API, claims unchanged", () => {
    for (const page of [
      "privacy/page.tsx",
      "terms/page.tsx",
      "warranty/page.tsx",
      "data-rights/page.tsx",
      "communication-consent/page.tsx",
    ]) {
      assert.ok(existsSync(join(root, "src/app/(legal)", page)));
    }
    const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
    assert.doesNotMatch(sitemap, /privacy|terms|warranty|data-rights|communication-consent/);
    assert.equal(existsSync(join(root, "src/app/api/leads")), false);
    const claims = readFileSync(
      join(root, "src/features/public-site/home-r4/claims.ts"),
      "utf8"
    );
    assert.match(claims, /warrantyYears:\s*10/);
  });
});
