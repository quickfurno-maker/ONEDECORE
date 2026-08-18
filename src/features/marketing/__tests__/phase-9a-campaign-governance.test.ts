/**
 * Phase 9A — campaign governance, eligibility, lifecycle, and UI security tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { evaluateMarketingEligibility } from "../domain/marketing-eligibility.ts";
import {
  resolveCampaignPermissionCapabilities,
  isCampaignSelfApproval,
  canApproveCampaignVersion,
} from "../domain/campaign-capabilities.ts";
import { validateCampaignLifecycleTransition } from "../domain/campaign-lifecycle.ts";
import { validateCampaignDraftConfig } from "../domain/campaign-validators.ts";
import {
  freezeAudienceVersion,
  assertAudienceVersionImmutable,
} from "../domain/audience-version.ts";
import { hashAudienceRule } from "../domain/audience-rule-engine.ts";
import { allowsCrmMemberExport } from "../contracts/targeting.ts";
import { SAMPLE_CAMPAIGN_DRAFT } from "../fixtures/campaign-fixtures.ts";

const root = process.cwd();

const directEligible = {
  targetingMode: "direct_or_custom" as const,
  marketingConsentGranted: true,
  marketingConsentWithdrawn: false,
  onDoNotContactList: false,
  suppressed: false,
  channelEligible: true,
  includesCrmPiiExport: true,
};

describe("Phase 9A marketing eligibility", () => {
  test("broad public denies CRM export", () => {
    const result = evaluateMarketingEligibility({
      targetingMode: "broad_public",
      marketingConsentGranted: false,
      marketingConsentWithdrawn: false,
      onDoNotContactList: false,
      suppressed: false,
      channelEligible: true,
      includesCrmPiiExport: true,
    });
    assert.equal(result.code, "DENIED_BROAD_PUBLIC_CRM_EXPORT");
  });

  test("broad public does not require marketing consent", () => {
    const result = evaluateMarketingEligibility({
      targetingMode: "broad_public",
      marketingConsentGranted: false,
      marketingConsentWithdrawn: false,
      onDoNotContactList: false,
      suppressed: false,
      channelEligible: true,
      includesCrmPiiExport: false,
    });
    assert.equal(result.eligible, true);
    assert.equal(allowsCrmMemberExport("broad_public"), false);
  });

  test("direct/custom requires MARKETING consent", () => {
    const denied = evaluateMarketingEligibility({
      ...directEligible,
      marketingConsentGranted: false,
    });
    assert.equal(denied.code, "DENIED_NO_MARKETING_CONSENT");
    const eligible = evaluateMarketingEligibility(directEligible);
    assert.equal(eligible.eligible, true);
  });

  test("DNC denies direct/custom", () => {
    const result = evaluateMarketingEligibility({
      ...directEligible,
      onDoNotContactList: true,
    });
    assert.equal(result.code, "DENIED_DNC");
  });

  test("suppression denies direct/custom", () => {
    const result = evaluateMarketingEligibility({
      ...directEligible,
      suppressed: true,
    });
    assert.equal(result.code, "DENIED_SUPPRESSION");
  });

  test("channel ineligible denies direct/custom", () => {
    const result = evaluateMarketingEligibility({
      ...directEligible,
      channelEligible: false,
    });
    assert.equal(result.code, "DENIED_CHANNEL_INELIGIBLE");
  });

  test("withdrawn MARKETING denies", () => {
    const result = evaluateMarketingEligibility({
      ...directEligible,
      marketingConsentWithdrawn: true,
    });
    assert.equal(result.code, "DENIED_NO_MARKETING_CONSENT");
  });

  test("WHATSAPP_SERVICE does not imply MARKETING (consent flag only)", () => {
    const result = evaluateMarketingEligibility({
      targetingMode: "direct_or_custom",
      marketingConsentGranted: false,
      marketingConsentWithdrawn: false,
      onDoNotContactList: false,
      suppressed: false,
      channelEligible: true,
      includesCrmPiiExport: true,
    });
    assert.equal(result.code, "DENIED_NO_MARKETING_CONSENT");
  });

  test("eligibility reasons contain no PII patterns", () => {
    const result = evaluateMarketingEligibility({
      ...directEligible,
      onDoNotContactList: true,
    });
    assert.doesNotMatch(result.reason, /@/);
    assert.doesNotMatch(result.reason, /\d{10}/);
  });
});

describe("Phase 9A audience version immutability", () => {
  test("frozen version hash is stable; semantic change changes hash", () => {
    const group = {
      logic: "and" as const,
      rules: [{ field: "locality" as const, operator: "equals" as const, values: ["noida"] }],
    };
    const v1 = freezeAudienceVersion({
      audienceVersionId: "aud-1",
      ruleGroup: group,
      frozenByProfileId: "sm-1",
    });
    const v2 = freezeAudienceVersion({
      audienceVersionId: "aud-1",
      ruleGroup: group,
      frozenByProfileId: "sm-1",
      frozenAt: v1.frozenAt,
    });
    assert.equal(v1.ruleHash, v2.ruleHash);
    assert.equal(assertAudienceVersionImmutable(v1, v2), null);

    const changed = freezeAudienceVersion({
      audienceVersionId: "aud-1",
      ruleGroup: {
        logic: "and",
        rules: [{ field: "locality", operator: "equals", values: ["gurgaon"] }],
      },
      frozenByProfileId: "sm-1",
    });
    assert.notEqual(v1.ruleHash, changed.ruleHash);
    assert.match(assertAudienceVersionImmutable(v1, changed) ?? "", /immutable/i);
  });

  test("membership count is not embedded in rule hash", () => {
    const hash = hashAudienceRule({
      logic: "and",
      rules: [{ field: "lead_stage", operator: "in", values: ["new"] }],
    });
    assert.equal(hash.length, 64);
  });

  test("canonical hash stable regardless of value order", () => {
    const a = hashAudienceRule({
      logic: "and",
      rules: [
        { field: "lead_stage", operator: "in", values: ["qualified", "new"] },
        { field: "locality", operator: "equals", values: ["Gurgaon"] },
      ],
    });
    const b = hashAudienceRule({
      logic: "and",
      rules: [
        { field: "locality", operator: "equals", values: ["gurgaon"] },
        { field: "lead_stage", operator: "in", values: ["new", "qualified"] },
      ],
    });
    assert.equal(a, b);
  });
});

describe("Phase 9A campaign capabilities", () => {
  test("sales manager can draft but cannot self-approve", () => {
    const actor = {
      profileId: "sm-1",
      role: "sales_manager" as const,
      isVersionCreator: true,
      isVersionRequester: true,
    };
    const caps = resolveCampaignPermissionCapabilities(actor);
    assert.equal(caps.canCreateCampaignDraft, true);
    assert.equal(caps.canApproveCampaign, false);
    assert.equal(isCampaignSelfApproval(actor), true);
    assert.equal(canApproveCampaignVersion(actor), false);
  });

  test("super admin can approve any pending version and has no publish/execute capability", () => {
    const caps = resolveCampaignPermissionCapabilities({
      profileId: "sa-1",
      role: "super_admin",
      isVersionCreator: true,
      isVersionRequester: true,
    });
    assert.equal(caps.canApproveCampaign, true);
    assert.equal("canPublishLater" in caps, false);
    assert.equal("canBulkExecuteCampaign" in caps, false);
  });

  test("sales executive has no campaign creation authority", () => {
    const caps = resolveCampaignPermissionCapabilities({
      profileId: "se-1",
      role: "sales_executive",
      isVersionCreator: false,
      isVersionRequester: false,
    });
    assert.equal(caps.canCreateCampaignDraft, false);
    assert.equal(caps.canApproveCampaign, false);
  });

  test("PM and designer have no campaign authority", () => {
    for (const role of ["project_manager", "designer"] as const) {
      const caps = resolveCampaignPermissionCapabilities({
        profileId: "x",
        role,
        isVersionCreator: false,
        isVersionRequester: false,
      });
      assert.equal(caps.canCreateCampaignDraft, false);
      assert.equal(caps.canApproveCampaign, false);
    }
  });
});

describe("Phase 9A lifecycle transitions", () => {
  test("manager cannot approve without capability", () => {
    const caps = resolveCampaignPermissionCapabilities({
      profileId: "sm-1",
      role: "sales_manager",
      isVersionCreator: true,
      isVersionRequester: true,
    });
    const result = validateCampaignLifecycleTransition({
      from: "pending_approval",
      to: "approved",
      capabilities: caps,
    });
    assert.equal(result.allowed, false);
  });

  test("approved versions have no Phase 9A execution transition", () => {
    const caps = resolveCampaignPermissionCapabilities({
      profileId: "sa-1",
      role: "super_admin",
      isVersionCreator: false,
      isVersionRequester: false,
    });
    const result = validateCampaignLifecycleTransition({
      from: "approved",
      to: "approved",
      capabilities: caps,
    });
    assert.equal(result.allowed, false);
  });
});

describe("Phase 9A campaign draft validators", () => {
  test("complete sample draft validates", () => {
    assert.equal(validateCampaignDraftConfig(SAMPLE_CAMPAIGN_DRAFT), null);
  });
});

describe("Phase 9A UI contract assertions", () => {
  const componentFiles = [
    "src/features/marketing/components/CampaignDraftEditor.tsx",
    "src/features/marketing/components/AudienceRuleBuilder.tsx",
    "src/features/marketing/components/AudienceVersionSummary.tsx",
    "src/features/marketing/components/MarketingEligibilitySummary.tsx",
    "src/features/marketing/components/CampaignApprovalPanel.tsx",
    "src/features/marketing/components/CampaignBudgetPanel.tsx",
    "src/features/marketing/components/CampaignCreativePreview.tsx",
    "src/features/marketing/components/CampaignVersionTimeline.tsx",
    "src/features/marketing/components/PrebuildBanner.tsx",
  ];

  test("draft editor uses callback props", () => {
    const src = readFileSync(
      join(root, "src/features/marketing/components/CampaignDraftEditor.tsx"),
      "utf8"
    );
    assert.match(src, /onSaveDraft/);
    assert.match(src, /onRequestApproval/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("approval panel uses callback props only", () => {
    const src = readFileSync(
      join(root, "src/features/marketing/components/CampaignApprovalPanel.tsx"),
      "utf8"
    );
    assert.match(src, /onApprove/);
    assert.match(src, /onReject/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("components expose aria-live status regions", () => {
    for (const file of componentFiles) {
      const src = readFileSync(join(root, file), "utf8");
      assert.match(src, /aria-live/);
    }
  });

  test("components do not use dangerouslySetInnerHTML", () => {
    for (const file of componentFiles) {
      const src = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
    }
  });
});

describe("Phase 9A security firewall", () => {
  test("no provider mutation or auto optimization in marketing domain", () => {
    const files = [
      "src/features/marketing/domain/marketing-eligibility.ts",
      "src/features/marketing/domain/campaign-capabilities.ts",
      "src/features/marketing/domain/campaign-lifecycle.ts",
      "src/features/marketing/domain/campaign-validators.ts",
      "src/features/marketing/domain/audience-version.ts",
      "src/features/marketing/fixtures/campaign-fixtures.ts",
      "src/features/marketing/components/CampaignApprovalPanel.tsx",
    ];
    for (const file of files) {
      const content = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(content, /meta\.com|googleads|publishCampaign|autoOptim/i);
      assert.doesNotMatch(content, /dangerouslySetInnerHTML/);
    }
  });

  test("no PII export helpers", () => {
    const content = readFileSync(
      join(root, "src/features/marketing/domain/marketing-eligibility.ts"),
      "utf8"
    );
    assert.doesNotMatch(content, /exportMembers|exportCsv|downloadList/i);
  });
});
