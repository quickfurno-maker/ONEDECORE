/**
 * Phase 10 — production lead-intake activation gate + conversion readiness.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { LEAD_FORM_SUCCESS_TITLE } from "../public/lead-form-errors.ts";
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

  test("enabled succeeds when canonical legal/consent gates and managed URL are satisfied", () => {
    const env = getLeadIntakeServerEnv({
      ONEDECORE_LEAD_INTAKE_MODE: "enabled",
      ONEDECORE_TRUST_PROXY: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
      ONEDECORE_LEAD_HASH_SECRET: secret,
    });
    assert.equal(env.mode, "enabled");
    assert.equal(env.trustProxy, true);
  });

  test("explicit complete activation flags enable with published legal/consent state", () => {
    const activation = completeActivation();
    assert.deepEqual(getMissingLeadIntakeActivationFields(activation), []);
    assert.equal(isLeadIntakeActivationComplete(activation), true);
    const env = getLeadIntakeServerEnv(
      {
        ONEDECORE_LEAD_INTAKE_MODE: "enabled",
        ONEDECORE_TRUST_PROXY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://lpurlfmpvriyvpkujvyl.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      },
      activation
    );
    assert.equal(env.mode, "enabled");
  });

  test("server-env consumes LEAD_INTAKE_ACTIVATION module", () => {
    const src = readFileSync(join(root, "src/config/server-env.ts"), "utf8");
    assert.match(src, /LEAD_INTAKE_ACTIVATION/);
    assert.match(src, /getMissingLeadIntakeActivationFields\(activation\)/);
  });

  test("legal publication is published with real effective date", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "published");
    const privacy = readFileSync(
      join(root, "src/features/legal/privacy-policy-content.ts"),
      "utf8"
    );
    /*
     * A real YYYY-MM-DD, not a placeholder — that is what "published" means
     * here. The literal date is deliberately NOT pinned: it moves with each
     * published version, and pinning it would turn every honest amendment into
     * a test failure in a file that is not about amendments.
     *
     * v1.0 must still appear, because the amendment supersedes it rather than
     * erasing it.
     */
    assert.match(privacy, /privacy-notice-v1\.0/);
    assert.match(
      privacy,
      /PRIVACY_NOTICE_EFFECTIVE_DATE:\s*string\s*\|\s*null\s*=\s*"\d{4}-\d{2}-\d{2}"/
    );
    assert.doesNotMatch(privacy, /PRIVACY_NOTICE_EFFECTIVE_DATE[^;]*placeholder/i);
  });
});

describe("Phase 10 consultation conversion path", () => {
  test("the canonical brief collects contact, area and consent — nothing else", () => {
    /*
     * THE SHAPE CHANGED WITH THE CONSOLIDATION.
     *
     * The single-panel redesign moved scope, budget and timeline into this
     * component, so it now owns the whole visible form: the requirement, the
     * optional Pune area, the contact fields, the optional message and the
     * single consent. It sets the service only by DERIVING it from the chosen
     * scope, and it must never touch `property`, which the v4 contract does
     * not carry at all.
     */
    const capture = readFileSync(
      join(root, "src/features/lead-intake/public/UnifiedLeadBrief.tsx"),
      "utf8"
    );
    assert.match(capture, /Your requirement/);
    assert.match(capture, /Your details/);
    assert.match(capture, /Area in Pune/);
    assert.match(capture, /plan\.setContact/);
    assert.doesNotMatch(capture, /plan\.setProperty/);
    // Derived from the scope, never asked for directly.
    assert.match(capture, /serviceForProjectScope\(scope\)/);
    /*
     * Comment-stripped: the docblock uses "silently" in prose about drift and
     * about the anti-bot window. The rule is about CODE that fabricates a
     * default the customer never gave.
     */
    const captureCode = capture
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    assert.doesNotMatch(captureCode, /silently|fabricate defaults/i);
    assert.doesNotMatch(capture, /checked=\{true\}/);
  });

  test("active mode makes the enquiry CTA primary over copy brief", () => {
    /*
     * The section used to MOUNT a second lead form. It opens the one canonical
     * sheet now, so what this asserts is the ordering that still matters: in
     * active mode the conversion control comes first and the copy-a-brief
     * fallback is secondary — and no form is mounted here at all.
     */
    const homePlan = readFileSync(
      join(root, "src/features/public-site/home-r4/HomePlan.tsx"),
      "utf8"
    );
    assert.match(homePlan, /briefTitleActive/);
    /*
     * `formPrimary` is gone with the build-time flag that fed it. The section
     * always offers the consultation now; whether a lead can actually be
     * submitted is answered by the running server when the sheet opens, which
     * is the only place that can know.
     */
    assert.doesNotMatch(homePlan, /formPrimary/);
    assert.doesNotMatch(homePlan, /leadFormMode/);
    assert.match(homePlan, /copyBriefSecondaryLabel/);
    assert.doesNotMatch(homePlan, /HomeLeadCapture/);
    assert.doesNotMatch(homePlan, /PremiumRequirementForm/);
    /*
     * The conversion control still comes before the copy-a-brief fallback.
     * `briefActions` is DEFINED near the top of the file and RENDERED after the
     * CTA, so the ordering that matters is where it is rendered.
     */
    assert.ok(
      homePlan.indexOf("openPlanner") < homePlan.lastIndexOf("{briefActions}"),
      "the consultation CTA must render before the secondary brief actions"
    );
  });

  test("success copy stays request-received not booking-confirmed", () => {
    /*
     * THE RULE IS UNCHANGED; THE WORDS MOVED.
     *
     * The confirmation now uses the owner-approved sentence and is held in a
     * named constant rather than inline, so this asserts the constant. What
     * must never drift is the PROMISE: we acknowledge receiving a request and
     * say we will follow up. We do not tell the visitor a consultation is
     * booked, scheduled or confirmed — nobody has agreed a time with them.
     */
    const errors = readFileSync(
      join(root, "src/features/lead-intake/public/lead-form-errors.ts"),
      "utf8"
    );
    assert.match(errors, /LEAD_FORM_SUCCESS_TITLE/);
    assert.equal(
      LEAD_FORM_SUCCESS_TITLE,
      "Thank you. We received your consultation request and will follow up."
    );
    assert.match(LEAD_FORM_SUCCESS_TITLE, /received/i);
    assert.doesNotMatch(
      LEAD_FORM_SUCCESS_TITLE,
      /booking confirmed|confirmed|scheduled|appointment|booked/i
    );
  });
});
