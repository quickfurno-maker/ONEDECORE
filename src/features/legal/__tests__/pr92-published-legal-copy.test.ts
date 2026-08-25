/**
 * PR #92 — published-mode legal copy must stay customer-facing and fail-closed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CONSENT_VERSIONS,
  LEGAL_PUBLICATION_MODE,
  LEAD_INTAKE_ACTIVATION,
  getConsentVersionByPurpose,
  getLeadIntakeActivationMissingFields,
  getPrivacyNoticeDisplayVersion,
  getPrivacyNoticeEffectiveDateLabel,
  getPrivacyPolicySections,
  getPublishedPrivacyNoticeText,
  getPublishedTermsOfUseText,
  getTermsOfUseDisplayVersion,
  getTermsOfUseEffectiveDateLabel,
  getTermsOfUseSections,
  isLegalDraftMode,
  marketingConsentIsOptional,
} from "../index.ts";

const FORBIDDEN_PUBLISHED = [
  /NO COUNSEL REVIEW YET/i,
  /Publication blockers/i,
  /under[- ]review/i,
  /not invented/i,
  /production lead intake remains disabled/i,
  /owner-facing draft/i,
  /bespoke signed DPA/i,
  /DPA is not claimed/i,
  /not claimed signed/i,
  /when processing begins/i,
  /proposed for owner approval/i,
  /not yet effective/i,
  /OWNER APPROVED/i,
  /NOT COUNSEL REVIEWED/i,
  /solely to understand your request and respond/i,
];

describe("PR #92 published vs draft legal surfaces", () => {
  test("draft-review mode remains active and fail-closed", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "draft-review");
    assert.equal(isLegalDraftMode(), true);
    assert.equal(LEAD_INTAKE_ACTIVATION.privacyTermsVersionApproved, false);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceEnquiryCopyApproved, false);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceCommunicationCopyApproved, false);
    assert.equal(LEAD_INTAKE_ACTIVATION.leadProcessorsRegistered, false);
    const missing = getLeadIntakeActivationMissingFields();
    assert.ok(missing.includes("privacyTermsVersionApproved"));
    assert.ok(missing.includes("leadProcessorsRegistered"));
  });

  test("draft-review sections still include internal review appendix", () => {
    const draftPrivacy = getPrivacyPolicySections("draft-review");
    assert.ok(draftPrivacy.some((s) => s.id === "draft-review-status"));
    const draftText = draftPrivacy.flatMap((s) => s.body).join("\n");
    assert.match(draftText, /NO COUNSEL REVIEW YET/i);
  });

  test("published Privacy/Terms omit internal governance language", () => {
    const privacy = getPublishedPrivacyNoticeText();
    const terms = getPublishedTermsOfUseText();
    for (const pattern of FORBIDDEN_PUBLISHED) {
      assert.doesNotMatch(privacy, pattern, `privacy matched ${pattern}`);
      assert.doesNotMatch(terms, pattern, `terms matched ${pattern}`);
    }
    assert.ok(!getPrivacyPolicySections("published").some((s) => s.id === "draft-review-status"));
    assert.ok(!getTermsOfUseSections("published").some((s) => s.id === "draft-review-status"));
  });

  test("published Privacy/Terms expose version and effective-date support", () => {
    assert.equal(getPrivacyNoticeDisplayVersion("published"), "privacy-notice-v1.0");
    assert.equal(getTermsOfUseDisplayVersion("published"), "terms-of-use-v1.0");
    assert.match(
      getPrivacyNoticeEffectiveDateLabel(null),
      /authorized production activation/i
    );
    assert.match(
      getTermsOfUseEffectiveDateLabel(null),
      /authorized production activation/i
    );
    assert.match(getPublishedPrivacyNoticeText(), /Supabase project region: Mumbai/i);
    assert.match(
      getPublishedPrivacyNoticeText(),
      /Hostinger-hosted infrastructure/i
    );
    assert.match(
      getPublishedTermsOfUseText(),
      /courts having jurisdiction in Pune, Maharashtra/i
    );
  });

  test("LegalPageShell hides draft chrome in published mode path", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/features/legal/components/LegalPageShell.tsx"),
      "utf8"
    );
    assert.match(shell, /isLegalDraftMode\(\)/);
    assert.match(shell, /\{draft \? <LegalDraftBanner \/> : null\}/);
    assert.match(shell, /\{draft \? <LegalOwnerReviewPanel \/> : null\}/);
    assert.match(shell, /Effective date:/);
    assert.match(shell, /Version:/);
  });

  test("consent registry keeps required/optional rules and revised enquiry copy", () => {
    assert.equal(marketingConsentIsOptional(), true);
    for (const version of CONSENT_VERSIONS) {
      assert.equal(version.defaultChecked, false);
    }
    const enquiry = getConsentVersionByPurpose("SERVICE_ENQUIRY");
    assert.ok(enquiry);
    assert.match(enquiry.expandedNotice, /CRM and consent records/i);
    assert.doesNotMatch(enquiry.expandedNotice, /solely to understand/i);
    const service = getConsentVersionByPurpose("SERVICE_COMMUNICATION");
    assert.ok(service);
    assert.equal(service.required, true);
    assert.ok(!service.channels.includes("whatsapp"));
    const whatsapp = getConsentVersionByPurpose("WHATSAPP_SERVICE");
    assert.ok(whatsapp);
    assert.equal(whatsapp.required, false);
    assert.deepEqual(whatsapp.channels, ["whatsapp"]);
  });
});
