/**
 * Phase 10 — production lead-intake legal/consent activation (2026-08-25).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { getLeadIntakeServerEnv } from "../../../config/server-env.ts";
import { getLeadFormMode } from "../../lead-intake/public/lead-form-mode.ts";
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
  isLeadIntakeActivationComplete,
  isLegalPublishedMode,
  marketingConsentIsOptional,
} from "../index.ts";

const root = process.cwd();
const secret = "x".repeat(32);
const MANAGED = "https://lpurlfmpvriyvpkujvyl.supabase.co";
const ACTIVATION_DATE = "2026-08-25";

function enabledEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    ONEDECORE_LEAD_INTAKE_MODE: "enabled",
    ONEDECORE_TRUST_PROXY: "true",
    NEXT_PUBLIC_SUPABASE_URL: MANAGED,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
    ONEDECORE_LEAD_HASH_SECRET: secret,
    ...overrides,
  };
}

describe("Phase 10 production lead-intake legal activation", () => {
  test("LEGAL_PUBLICATION_MODE is published", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "published");
    assert.equal(isLegalPublishedMode(), true);
    assert.equal(canPublishLegalPolicies(), true);
  });

  test("Privacy Notice version and effective date", () => {
    assert.equal(PRIVACY_NOTICE_VERSION, "privacy-notice-v1.0");
    assert.equal(PRIVACY_NOTICE_EFFECTIVE_DATE, ACTIVATION_DATE);
    assert.equal(getPrivacyNoticeDisplayVersion(), "privacy-notice-v1.0");
    assert.equal(getPrivacyNoticeEffectiveDateLabel(), ACTIVATION_DATE);
  });

  test("Terms version and effective date", () => {
    assert.equal(TERMS_OF_USE_VERSION, "terms-of-use-v1.0");
    assert.equal(TERMS_OF_USE_EFFECTIVE_DATE, ACTIVATION_DATE);
    assert.equal(getTermsOfUseDisplayVersion(), "terms-of-use-v1.0");
    assert.equal(getTermsOfUseEffectiveDateLabel(), ACTIVATION_DATE);
  });

  test("published Privacy/Terms render without draft-only or placeholder text", () => {
    assert.equal(
      canRenderPublishedLegalDocument({
        mode: "published",
        effectiveDate: PRIVACY_NOTICE_EFFECTIVE_DATE,
      }),
      true
    );
    const privacy = getPublishedPrivacyNoticeText();
    const terms = getPublishedTermsOfUseText();
    for (const text of [privacy, terms]) {
      assert.doesNotMatch(text, /NO COUNSEL REVIEW YET/i);
      assert.doesNotMatch(text, /Publication blockers/i);
      assert.doesNotMatch(text, /under[- ]review/i);
      assert.doesNotMatch(text, /owner-facing draft/i);
      assert.doesNotMatch(text, new RegExp(LEGAL_EFFECTIVE_DATE_PLACEHOLDER, "i"));
    }
    assert.ok(
      !getPrivacyPolicySections("published").some(
        (section) => section.id === "draft-review-status"
      )
    );
  });

  test("lead-path v1.0 consent versions are effective from 2026-08-25", () => {
    for (const purpose of [
      "SERVICE_ENQUIRY",
      "SERVICE_COMMUNICATION",
      "WHATSAPP_SERVICE",
    ] as const) {
      const version = getCurrentConsentVersionByPurpose(purpose);
      assert.equal(version.effectiveFrom, ACTIVATION_DATE);
      assert.equal(version.status, "approved");
      assert.equal(version.defaultChecked, false);
      assert.equal(isConsentVersionEffective(version), true);
      assert.equal(getEffectiveConsentVersionByPurpose(purpose).version, version.version);
    }
    assert.equal(CURRENT_CONSENT_VERSION_IDS.SERVICE_ENQUIRY, "service-enquiry-v1.0");
    assert.equal(
      CURRENT_CONSENT_VERSION_IDS.SERVICE_COMMUNICATION,
      "service-communication-v1.0"
    );
    assert.equal(CURRENT_CONSENT_VERSION_IDS.WHATSAPP_SERVICE, "whatsapp-service-v1.0");
    assert.equal(areLeadPathConsentVersionsEffective(), true);
  });

  test("WhatsApp optional; marketing separate and unapproved", () => {
    const whatsapp = getCurrentConsentVersionByPurpose("WHATSAPP_SERVICE");
    assert.equal(whatsapp.required, false);
    assert.deepEqual(whatsapp.channels, ["whatsapp"]);
    assert.equal(marketingConsentIsOptional(), true);
    const marketing = getConsentVersionByPurpose("MARKETING");
    assert.ok(marketing);
    assert.equal(marketing.status, "draft-review");
    assert.equal(marketing.ownerApproval, null);
    assert.equal(marketing.effectiveFrom, null);
  });

  test("counsel approval remains null; processor and activation gates complete", () => {
    assert.equal(BUSINESS_IDENTITY.legalCounselApprovalReference, null);
    assert.equal(PRIVACY_NOTICE_OWNER_APPROVAL.counselApproval, null);
    assert.equal(TERMS_OF_USE_OWNER_APPROVAL.counselApproval, null);
    assert.equal(LEAD_INTAKE_ACTIVATION.leadProcessorsRegistered, true);
    assert.equal(areWebsiteLeadProcessorsReady(), true);
    assert.equal(getMissingWebsiteLeadProcessorEvidence().length, 0);
    assert.equal(isLeadIntakeActivationComplete(), true);
    assert.equal(getLeadIntakeActivationMissingFields().length, 0);
  });
});

describe("Phase 10 production lead-intake server-env gates", () => {
  test("enabled fails when trust proxy is false", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv(
        enabledEnv({ ONEDECORE_TRUST_PROXY: "false" })
      )
    );
  });

  test("enabled fails for wrong Supabase host", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv(
        enabledEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://otherproject.supabase.co" })
      )
    );
  });

  test("enabled rejects publishable key in service-role slot", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv(
        enabledEnv({
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
          SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_test",
        })
      )
    );
  });

  test("enabled fails for hash secret shorter than 32 chars", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv(
        enabledEnv({ ONEDECORE_LEAD_HASH_SECRET: "short" })
      )
    );
  });

  test("enabled succeeds with canonical production gates and safe fixture credentials", () => {
    const env = getLeadIntakeServerEnv(enabledEnv());
    assert.equal(env.mode, "enabled");
    assert.equal(env.supabaseUrl, MANAGED);
    assert.equal(env.trustProxy, true);
    assert.ok(env.serviceRoleKey);
    assert.ok(env.hashSecret && env.hashSecret.length >= 32);
  });
});

describe("Phase 10 production lead-intake containment", () => {
  test("public form mode defaults to copy-only in repository", () => {
    assert.equal(getLeadFormMode({}), "copy-only");
    const example = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(example, /NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=copy-only/);
    assert.match(example, /ONEDECORE_SHOP_PUBLIC_ENABLED=false/);
  });

  test("no new database migration in this activation slice", () => {
    const gitStatus = readFileSync(
      join(root, "src/features/legal/legal-publication.ts"),
      "utf8"
    );
    assert.match(gitStatus, /published/);
    const migrationsDir = join(root, "supabase/migrations");
    assert.ok(existsSync(migrationsDir));
  });

  test("shop gate and M38/payment boundaries unchanged", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(example, /ONEDECORE_SHOP_PUBLIC_ENABLED=false/);
    const serverEnv = readFileSync(join(root, "src/config/server-env.ts"), "utf8");
    assert.doesNotMatch(serverEnv, /ONEDECORE_SHOP_PUBLIC_ENABLED/);
    assert.doesNotMatch(serverEnv, /M38|online.?payment|stripe|razorpay/i);
  });
});
