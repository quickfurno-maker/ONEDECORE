/**
 * Phase 10 — production lead-intake activation gate + conversion readiness.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { getLeadIntakeServerEnv } from "../../../config/server-env.ts";
import {
  BUSINESS_IDENTITY,
  DEFAULT_CONTACT_ROLE_MAPPING,
  doesGenericCompletenessActivateAllFeatures,
  getMissingLeadIntakeActivationFields,
  type BusinessIdentity,
  type LeadIntakeActivationInput,
} from "../../legal/business-identity.ts";
import {
  LEAD_INTAKE_ACTIVATION,
  getLeadIntakeActivationMissingFields,
  isLeadIntakeActivationComplete,
} from "../../legal/lead-intake-activation.ts";
import { LEGAL_PUBLICATION_MODE } from "../../legal/legal-publication.ts";

const root = process.cwd();
const secret = "x".repeat(32);
const MANAGED = "https://example.supabase.co";

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
    authorisedRepresentative: "Authorised representative fixture",
    grievanceContact: "Grievance officer fixture",
    jurisdictionClause: "Courts at Pune, Maharashtra (draft fixture)",
    legalCounselApprovalReference: "COUNSEL-REF-FIXTURE",
    contactRoleMapping: { ...DEFAULT_CONTACT_ROLE_MAPPING },
    ...overrides,
  };
}

function completeActivation(
  overrides: Partial<LeadIntakeActivationInput> = {}
): LeadIntakeActivationInput {
  return {
    identity: completeCoreIdentity(),
    privacyTermsVersionApproved: true,
    serviceEnquiryCopyApproved: true,
    serviceCommunicationCopyApproved: true,
    leadRetentionDecided: true,
    consentRetentionDecided: true,
    auditRetentionDecided: true,
    suppressionRetentionDecided: true,
    leadProcessorsRegistered: true,
    ...overrides,
  };
}

describe("Phase 10 lead-intake activation source", () => {
  test("canonical source defaults: activation complete; intake still fail-closed", () => {
    assert.equal(LEAD_INTAKE_ACTIVATION.privacyTermsVersionApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceEnquiryCopyApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.serviceCommunicationCopyApproved, true);
    assert.equal(LEAD_INTAKE_ACTIVATION.leadProcessorsRegistered, true);
    assert.equal(isLeadIntakeActivationComplete(), true);
    const missing = getLeadIntakeActivationMissingFields();
    assert.ok(!missing.includes("leadProcessorsRegistered"));
    assert.ok(!missing.includes("privacyTermsVersionApproved"));
    assert.ok(!missing.includes("legalEntityName"));
  });

  test("generic business completeness alone does not activate intake", () => {
    assert.equal(doesGenericCompletenessActivateAllFeatures(), false);
    const identityOnly = getMissingLeadIntakeActivationFields({
      identity: completeCoreIdentity(),
    });
    assert.ok(identityOnly.includes("privacyTermsVersionApproved"));
    assert.ok(identityOnly.length > 0);
  });

  test("enabled remains blocked by default canonical source", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        ONEDECORE_LEAD_INTAKE_MODE: "enabled",
        ONEDECORE_TRUST_PROXY: "true",
        NEXT_PUBLIC_SUPABASE_URL: MANAGED,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
  });

  test("explicit complete activation flags alone cannot enable while publication/consent/processors incomplete", () => {
    const activation = completeActivation();
    assert.deepEqual(getMissingLeadIntakeActivationFields(activation), []);
    assert.equal(isLeadIntakeActivationComplete(activation), true);
    assert.throws(() =>
      getLeadIntakeServerEnv(
        {
          ONEDECORE_LEAD_INTAKE_MODE: "enabled",
          ONEDECORE_TRUST_PROXY: "true",
          NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
          ONEDECORE_LEAD_HASH_SECRET: secret,
        },
        activation
      )
    );
  });

  test("server-env consumes LEAD_INTAKE_ACTIVATION module", () => {
    const src = readFileSync(join(root, "src/config/server-env.ts"), "utf8");
    assert.match(src, /LEAD_INTAKE_ACTIVATION/);
    assert.match(src, /getMissingLeadIntakeActivationFields\(activation\)/);
  });

  test("legal publication remains owner-approved until activation publishes", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "owner-approved");
    const privacy = readFileSync(
      join(root, "src/features/legal/privacy-policy-content.ts"),
      "utf8"
    );
    assert.match(privacy, /privacy-notice-v1\.0/);
    assert.match(privacy, /PRIVACY_NOTICE_EFFECTIVE_DATE:\s*string\s*\|\s*null\s*=\s*null/);
  });
});

describe("Phase 10 consultation conversion path", () => {
  test("HomeLeadCapture exposes in-form service/property/timeline from PM_PLANNER", () => {
    const capture = readFileSync(
      join(root, "src/features/lead-intake/public/HomeLeadCapture.tsx"),
      "utf8"
    );
    assert.match(capture, /PM_PLANNER/);
    assert.match(capture, /plan\.setService/);
    assert.match(capture, /plan\.setProperty/);
    assert.match(capture, /plan\.setTimeline/);
    assert.match(capture, /Your interior need/);
    assert.doesNotMatch(capture, /silently|fabricate defaults/i);
    assert.doesNotMatch(capture, /checked=\{true\}/);
  });

  test("active mode makes enquiry form primary over copy brief", () => {
    const homePlan = readFileSync(
      join(root, "src/features/public-site/home-r4/HomePlan.tsx"),
      "utf8"
    );
    assert.match(homePlan, /briefTitleActive/);
    assert.match(homePlan, /formPrimary/);
    assert.match(homePlan, /copy-only/);
    assert.match(homePlan, /HomeLeadCapture/);
    assert.match(homePlan, /copyBriefSecondaryLabel/);
    const activeBranch = homePlan.slice(
      homePlan.indexOf("formPrimary ?"),
      homePlan.indexOf('leadFormMode === "copy-only"')
    );
    assert.match(activeBranch, /HomeLeadCapture/);
    assert.match(activeBranch, /briefActions/);
    assert.ok(activeBranch.indexOf("HomeLeadCapture") < activeBranch.indexOf("briefActions"));
  });

  test("success copy stays request-received not booking-confirmed", () => {
    const errors = readFileSync(
      join(root, "src/features/lead-intake/public/lead-form-errors.ts"),
      "utf8"
    );
    assert.match(errors, /enquiry has been received/i);
    assert.doesNotMatch(errors, /booking confirmed/i);
  });
});
