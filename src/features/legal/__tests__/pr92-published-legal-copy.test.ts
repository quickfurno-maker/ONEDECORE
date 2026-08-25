/**
 * PR #92 — owner-approved vs published/effective activation invariants.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getLeadIntakeServerEnv } from "../../../config/server-env.ts";
import {
  BUSINESS_IDENTITY,
  CURRENT_CONSENT_VERSION_IDS,
  LEGAL_EFFECTIVE_DATE_PLACEHOLDER,
  LEGAL_PUBLICATION_MODE,
  LEAD_INTAKE_ACTIVATION,
  PRIVACY_NOTICE_EFFECTIVE_DATE,
  PRIVACY_NOTICE_OWNER_APPROVAL,
  PRIVACY_NOTICE_VERSION,
  TERMS_OF_USE_EFFECTIVE_DATE,
  TERMS_OF_USE_OWNER_APPROVAL,
  TERMS_OF_USE_VERSION,
  areLeadPathConsentVersionsEffective,
  areWebsiteLeadProcessorsReady,
  canPublishLegalPolicies,
  canRenderPublishedLegalDocument,
  getConsentVersionByPurpose,
  getCurrentConsentVersionByPurpose,
  getEffectiveConsentVersionByPurpose,
  getLeadIntakeActivationMissingFields,
  getMissingWebsiteLeadProcessorEvidence,
  getPrivacyNoticeDisplayVersion,
  getPrivacyNoticeEffectiveDateLabel,
  getPrivacyPolicySections,
  getPublishedPrivacyNoticeText,
  getPublishedTermsOfUseText,
  getTermsOfUseDisplayVersion,
  getTermsOfUseEffectiveDateLabel,
  isConsentVersionEffective,
  isConsentVersionOwnerApprovedNotEffective,
  isLegalDraftMode,
  isLegalOwnerApprovedMode,
  isLegalPublishedMode,
  marketingConsentIsOptional,
} from "../index.ts";

const secret = "x".repeat(32);

describe("PR #92 owner-approved activation readiness", () => {
  test("owner-approved mode is distinct from published/effective", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "owner-approved");
    assert.equal(isLegalDraftMode(), false);
    assert.equal(isLegalOwnerApprovedMode(), true);
    assert.equal(isLegalPublishedMode(), false);
    assert.equal(canPublishLegalPolicies(), false);
    assert.equal(PRIVACY_NOTICE_EFFECTIVE_DATE, null);
    assert.equal(TERMS_OF_USE_EFFECTIVE_DATE, null);
  });

  test("owner approval flags true; processor gate remains false", () => {
    assert.equal(LEAD_INTAKE_ACTIVATION.privacyTermsVersionApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceEnquiryCopyApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceCommunicationCopyApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.leadProcessorsRegistered, false);
    assert.ok(
      getLeadIntakeActivationMissingFields().includes("leadProcessorsRegistered")
    );
    assert.equal(areWebsiteLeadProcessorsReady(), false);
    assert.ok(getMissingWebsiteLeadProcessorEvidence().length > 0);
  });

  test("counsel approval remains null / not claimed", () => {
    assert.equal(BUSINESS_IDENTITY.legalCounselApprovalReference, null);
    assert.equal(PRIVACY_NOTICE_OWNER_APPROVAL.counselApproval, null);
    assert.equal(TERMS_OF_USE_OWNER_APPROVAL.counselApproval, null);
  });

  test("approved consent v1.0 is not effective until effectiveFrom is set", () => {
    assert.equal(CURRENT_CONSENT_VERSION_IDS.SERVICE_ENQUIRY, "service-enquiry-v1.0");
    assert.equal(
      CURRENT_CONSENT_VERSION_IDS.SERVICE_COMMUNICATION,
      "service-communication-v1.0"
    );
    assert.equal(CURRENT_CONSENT_VERSION_IDS.WHATSAPP_SERVICE, "whatsapp-service-v1.0");
    assert.equal(CURRENT_CONSENT_VERSION_IDS.MARKETING, "marketing-v0.1-draft");

    for (const purpose of [
      "SERVICE_ENQUIRY",
      "SERVICE_COMMUNICATION",
      "WHATSAPP_SERVICE",
    ] as const) {
      const version = getCurrentConsentVersionByPurpose(purpose);
      assert.equal(version.status, "approved");
      assert.equal(version.effectiveFrom, null);
      assert.equal(version.legalApproval, null);
      assert.ok(version.ownerApproval);
      assert.equal(version.defaultChecked, false);
      assert.equal(isConsentVersionEffective(version), false);
      assert.equal(isConsentVersionOwnerApprovedNotEffective(version), true);
      assert.throws(() => getEffectiveConsentVersionByPurpose(purpose));
    }

    assert.equal(areLeadPathConsentVersionsEffective(), false);
    const whatsapp = getCurrentConsentVersionByPurpose("WHATSAPP_SERVICE");
    assert.equal(whatsapp.required, false);
    assert.deepEqual(whatsapp.channels, ["whatsapp"]);
    assert.equal(marketingConsentIsOptional(), true);
    const marketing = getConsentVersionByPurpose("MARKETING");
    assert.ok(marketing);
    assert.equal(marketing.status, "draft-review");
    assert.equal(marketing.ownerApproval, null);
  });

  test("service consent approvals match exact approved v1.0 copy", () => {
    const enquiry = getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY");
    assert.match(enquiry.expandedNotice, /CRM and consent records/i);
    assert.doesNotMatch(enquiry.expandedNotice, /solely to understand/i);
    assert.equal(PRIVACY_NOTICE_VERSION, "privacy-notice-v1.0");
    assert.equal(TERMS_OF_USE_VERSION, "terms-of-use-v1.0");
    assert.equal(getPrivacyNoticeDisplayVersion(), "privacy-notice-v1.0");
    assert.equal(getTermsOfUseDisplayVersion(), "terms-of-use-v1.0");
  });

  test("published mode requires real effective date and forbids placeholder", () => {
    assert.equal(
      canRenderPublishedLegalDocument({
        mode: "published",
        effectiveDate: null,
      }),
      false
    );
    assert.equal(
      canRenderPublishedLegalDocument({
        mode: "published",
        effectiveDate: LEGAL_EFFECTIVE_DATE_PLACEHOLDER,
      }),
      false
    );
    assert.equal(
      canRenderPublishedLegalDocument({
        mode: "published",
        effectiveDate: "2026-08-25",
      }),
      true
    );
    assert.throws(() =>
      getPrivacyNoticeEffectiveDateLabel(null, "published")
    );
    assert.throws(() => getTermsOfUseEffectiveDateLabel(null, "published"));
    const ownerLabel = getPrivacyNoticeEffectiveDateLabel(null, "owner-approved");
    assert.match(ownerLabel, /Not yet effective/i);
    assert.doesNotMatch(ownerLabel, new RegExp(LEGAL_EFFECTIVE_DATE_PLACEHOLDER, "i"));
  });

  test("owner-approved public pages omit internal governance phrases", () => {
    const privacy = getPublishedPrivacyNoticeText();
    const terms = getPublishedTermsOfUseText();
    for (const text of [privacy, terms]) {
      assert.doesNotMatch(text, /NO COUNSEL REVIEW YET/i);
      assert.doesNotMatch(text, /Publication blockers/i);
      assert.doesNotMatch(text, /under[- ]review/i);
      assert.doesNotMatch(text, /not invented/i);
      assert.doesNotMatch(text, /production lead intake remains disabled/i);
      assert.doesNotMatch(text, /owner-facing draft/i);
      assert.doesNotMatch(text, /bespoke signed DPA/i);
    }
    assert.ok(
      !getPrivacyPolicySections("owner-approved").some(
        (section) => section.id === "draft-review-status"
      )
    );
  });

  test("enabled intake remains fail-closed while processor/consent/publication incomplete", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        ONEDECORE_LEAD_INTAKE_MODE: "enabled",
        ONEDECORE_TRUST_PROXY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
  });
});
