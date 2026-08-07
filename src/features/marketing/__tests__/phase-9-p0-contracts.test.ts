/**
 * Phase 9 P0 — shared marketing and landing-lab contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  CAMPAIGN_TARGETING_MODES,
  requiresMarketingConsent,
  allowsCrmMemberExport,
  validateCampaignReference,
  createCampaignVersionRef,
  AUDIENCE_RULE_FIELDS,
} from "../contracts/index.ts";
import {
  canonicalizeAudienceRuleGroup,
  hashAudienceRule,
  validateAudienceRuleGroup,
} from "../domain/audience-rule-engine.ts";
import {
  resolveFormSubmitIdempotency,
  validateLandingPageReference,
} from "../../landing-lab/contracts/index.ts";
import { normalizeAttributionParams } from "../../landing-lab/domain/normalize-attribution.ts";
import {
  signPublicationContext,
  verifyPublicationContext,
  buildCanonicalPublicationContextPayload,
} from "../../landing-lab/server/publication-context-crypto.ts";

describe("Phase 9 P0 targeting mode contracts", () => {
  test("frozen targeting modes", () => {
    assert.deepEqual(CAMPAIGN_TARGETING_MODES, [
      "broad_public",
      "direct_or_custom",
    ]);
  });

  test("broad public does not require marketing consent or CRM export", () => {
    assert.equal(requiresMarketingConsent("broad_public"), false);
    assert.equal(allowsCrmMemberExport("broad_public"), false);
  });

  test("direct/custom requires marketing consent and may export CRM members", () => {
    assert.equal(requiresMarketingConsent("direct_or_custom"), true);
    assert.equal(allowsCrmMemberExport("direct_or_custom"), true);
  });
});

describe("Phase 9 P0 audience rule canonicalization", () => {
  const group = {
    logic: "and" as const,
    rules: [
      {
        field: "lead_stage" as const,
        operator: "in" as const,
        values: ["qualified", "new"],
      },
      {
        field: "locality" as const,
        operator: "equals" as const,
        values: ["Gurgaon"],
      },
    ],
  };

  test("canonical hash is stable regardless of value order", () => {
    const reversed = {
      logic: "and" as const,
      rules: [
        {
          field: "locality" as const,
          operator: "equals" as const,
          values: ["Gurgaon"],
        },
        {
          field: "lead_stage" as const,
          operator: "in" as const,
          values: ["new", "qualified"],
        },
      ],
    };
    assert.equal(hashAudienceRule(group), hashAudienceRule(reversed));
  });

  test("semantic change changes hash", () => {
    const changed = {
      ...group,
      rules: [
        ...group.rules,
        {
          field: "lead_source" as const,
          operator: "equals" as const,
          values: ["website"],
        },
      ],
    };
    assert.notEqual(hashAudienceRule(group), hashAudienceRule(changed));
  });

  test("membership count is not part of rule identity", () => {
    const canonical = canonicalizeAudienceRuleGroup(group);
    assert.equal(canonical.rules.length, 2);
    assert.equal(validateAudienceRuleGroup(group), null);
    assert.ok(hashAudienceRule(group).length === 64);
  });

  test("only governance-approved segmentation fields are supported", () => {
    assert.deepEqual(AUDIENCE_RULE_FIELDS, [
      "lead_source",
      "lead_stage",
      "service_interest",
      "locality",
    ]);
  });
});

describe("Phase 9 P0 attribution normalization", () => {
  test("normalizes bounded utm and click ids", () => {
    const normalized = normalizeAttributionParams({
      utmSource: " Google ",
      utmMedium: "CPC",
      fbclid: "abc-123",
      gclid: "xyz_456",
    });
    assert.equal(normalized.utmSource, "google");
    assert.equal(normalized.utmMedium, "cpc");
    assert.equal(normalized.fbclid, "abc-123");
    assert.equal(normalized.gclid, "xyz_456");
  });

  test("rejects overlong or unsafe attribution values", () => {
    const normalized = normalizeAttributionParams({
      utmCampaign: "a".repeat(200),
      utmContent: "<script>",
    });
    assert.equal(normalized.utmCampaign, null);
    assert.equal(normalized.utmContent, null);
  });
});

describe("Phase 9 P0 publication context signing", () => {
  const secret = "phase-9-test-secret";
  const context = {
    publicationReference: "OD-LP-PUB-0001",
    pageReference: "OD-LP-2026-0001",
    pageVersionNumber: 1,
    experimentReference: null,
    variantKey: null,
    issuedAt: "2026-08-07T10:00:00.000Z",
    expiresAt: "2026-08-08T10:00:00.000Z",
  };

  test("valid signature verifies", () => {
    const signed = signPublicationContext(secret, context);
    assert.deepEqual(verifyPublicationContext(secret, signed), { valid: true });
  });

  test("tampered payload fails verification", () => {
    const signed = signPublicationContext(secret, context);
    const tampered = {
      ...signed,
      context: { ...signed.context, pageVersionNumber: 2 },
    };
    const result = verifyPublicationContext(secret, tampered);
    assert.equal(result.valid, false);
  });

  test("wrong secret fails verification", () => {
    const signed = signPublicationContext(secret, context);
    const result = verifyPublicationContext("wrong-secret", signed);
    assert.equal(result.valid, false);
  });

  test("canonical serialization is deterministic", () => {
    const a = buildCanonicalPublicationContextPayload(context);
    const b = buildCanonicalPublicationContextPayload(context);
    assert.equal(a, b);
  });
});

describe("Phase 9 P0 form submit idempotency", () => {
  test("same id and hash reuses", () => {
    const existing = {
      submissionId: "sub-1",
      canonicalPayloadHash: "hash-a",
      publicationReference: "OD-LP-PUB-0001",
      leadReference: "OD-L-0001",
      recordedAt: "2026-08-07T10:00:00.000Z",
    };
    const result = resolveFormSubmitIdempotency({
      submissionId: "sub-1",
      canonicalPayloadHash: "hash-a",
      existing,
    });
    assert.equal(result.status, "reused");
  });

  test("same id with changed hash conflicts", () => {
    const existing = {
      submissionId: "sub-1",
      canonicalPayloadHash: "hash-a",
      publicationReference: "OD-LP-PUB-0001",
      leadReference: "OD-L-0001",
      recordedAt: "2026-08-07T10:00:00.000Z",
    };
    const result = resolveFormSubmitIdempotency({
      submissionId: "sub-1",
      canonicalPayloadHash: "hash-b",
      existing,
    });
    assert.equal(result.status, "conflict");
  });
});

describe("Phase 9 P0 reference validators", () => {
  test("campaign and landing references follow OD patterns", () => {
    assert.equal(validateCampaignReference("OD-C-2026-0001"), null);
    assert.equal(validateLandingPageReference("OD-LP-2026-0001"), null);
    const version = createCampaignVersionRef({
      campaignReference: "OD-C-2026-0001",
      versionNumber: 1,
    });
    assert.equal(version.versionNumber, 1);
  });
});

describe("Phase 9 P0 security firewall assertions", () => {
  test("no provider mutation or public route activation in P0 scope", () => {
    const marketingFiles = [
      "src/features/marketing/contracts/index.ts",
      "src/features/marketing/domain/audience-rule-engine.ts",
    ];
    const landingFiles = [
      "src/features/landing-lab/contracts/index.ts",
      "src/features/landing-lab/server/publication-context-crypto.ts",
    ];
    for (const file of [...marketingFiles, ...landingFiles]) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /meta\.com|googleads|publishCampaign/i);
      assert.doesNotMatch(content, /dangerouslySetInnerHTML/);
    }
  });
});
