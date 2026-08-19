/**
 * Phase 9A M31 runtime containment and governance tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { CAMPAIGN_LIFECYCLE_STATES, CAMPAIGN_TERMINAL_STATES } from "../contracts/lifecycle.ts";
import { canApproveCampaignVersion, isCampaignSelfApproval } from "../domain/campaign-capabilities.ts";
import { verifyPublicationContext, signPublicationContext } from "../../landing-lab/server/publication-context-crypto.ts";

const root = process.cwd();

describe("Phase 9A M31 runtime containment", () => {
  test("M31 encodes campaign governance without 9B/9C/execution tables", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260818140000_campaign_consent_audience_approval_foundation.sql"),
      "utf8"
    );
    assert.match(migration, /campaigns\.read/);
    assert.match(migration, /marketing_consents\.manage/);
    assert.match(migration, /create table public.campaigns/);
    assert.match(migration, /create table public.campaign_versions/);
    assert.match(migration, /create table public.campaign_audience_rule_versions/);
    assert.match(migration, /create table public.campaign_approvals/);
    assert.match(migration, /private.marketing_idempotency_requests/);
    assert.match(migration, /CAMPAIGN_SELF_APPROVAL_DENIED/);
    assert.match(migration, /staff_marketing_consent/);
    assert.match(migration, /preview_campaign_audience/);
    assert.match(migration, /OD-C-/);
    assert.doesNotMatch(migration, /campaign_runs/);
    assert.doesNotMatch(migration, /contact_suppressions/);
    assert.doesNotMatch(migration, /landing_pages/);
    assert.doesNotMatch(migration, /campaigns\.execute/);
    assert.doesNotMatch(migration, /20260817140000/);
  });

  test("M30 is not rewritten", () => {
    const m30 = readFileSync(
      join(root, "supabase/migrations/20260817140000_project_execution_workspace.sql"),
      "utf8"
    );
    assert.doesNotMatch(m30, /create table public.campaigns/);
  });

  test("canonical lifecycle is four-state only", () => {
    assert.deepEqual(CAMPAIGN_LIFECYCLE_STATES, [
      "draft",
      "pending_approval",
      "approved",
      "rejected",
    ]);
    assert.deepEqual(CAMPAIGN_TERMINAL_STATES, ["approved", "rejected"]);
  });

  test("SM self approval is denied while SA may approve own version in helper", () => {
    assert.equal(
      canApproveCampaignVersion({
        profileId: "sm",
        role: "sales_manager",
        isVersionCreator: true,
        isVersionRequester: false,
      }),
      false
    );
    assert.equal(
      isCampaignSelfApproval({
        profileId: "sm",
        role: "sales_manager",
        isVersionCreator: false,
        isVersionRequester: true,
      }),
      true
    );
    assert.equal(
      canApproveCampaignVersion({
        profileId: "sa",
        role: "super_admin",
        isVersionCreator: true,
        isVersionRequester: true,
      }),
      true
    );
  });

  test("admin campaign routes exist and deny execution UI", () => {
    const list = readFileSync(join(root, "src/app/admin/campaigns/page.tsx"), "utf8");
    const detail = readFileSync(join(root, "src/app/admin/campaigns/[campaignId]/page.tsx"), "utf8");
    const nav = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
    assert.match(list, /Approval governance only/);
    assert.match(detail, /createNextCampaignVersionAction|Create next version|CampaignVersionForms/);
    assert.match(nav, /\/admin\/campaigns/);
    assert.doesNotMatch(list, /Schedule|Pause|Publish|Bulk execute|ROAS|spend/i);
    assert.doesNotMatch(detail, /meta\.com|googleads\.googleapis|whatsapp.*MARKETING send/i);
  });

  test("marketing consent UI records instruction evidence and keeps DNC separate", () => {
    const panel = readFileSync(
      join(root, "src/features/marketing/components/MarketingConsentPanel.tsx"),
      "utf8"
    );
    assert.match(panel, /does not bypass DNC/);
    assert.match(panel, /does not send marketing/);
    assert.match(panel, /recordMarketingConsentAction/);
  });

  test("no provider mutation clients in Phase 9A server modules", () => {
    const files = [
      "src/features/marketing/server/campaign-actions.ts",
      "src/features/marketing/server/campaign-queries.ts",
      "src/features/marketing/server/campaign-permissions.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(src, /facebook|meta\.com|googleads|n8n|createBrowserClient/i);
      assert.match(src, /server-only|use server/);
    }
  });

  test("production HMAC expiry verification remains unchanged", () => {
    const verifier = readFileSync(
      join(root, "src/features/landing-lab/server/publication-context-crypto.ts"),
      "utf8"
    );
    assert.match(verifier, /Publication context expired/);
    assert.match(verifier, /Date\.now\(\) > expires/);
    const signed = signPublicationContext("phase-9-test-secret", {
      publicationReference: "OD-LP-PUB-0001",
      pageReference: "OD-LP-2026-0001",
      pageVersionNumber: 1,
      experimentReference: null,
      variantKey: null,
      issuedAt: "2026-08-07T10:00:00.000Z",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    const result = verifyPublicationContext("phase-9-test-secret", signed);
    assert.equal(result.valid, false);
  });
});
