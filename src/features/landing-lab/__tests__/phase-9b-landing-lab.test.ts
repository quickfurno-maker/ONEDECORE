/**
 * Phase 9B — Landing Page Lab migration-independent prebuild tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  validateLandingBlock,
  validateLandingPageBlocks,
  type HeroBlock,
} from "../contracts/blocks.ts";
import {
  assertLandingPageVersionMutable,
  isLandingPageVersionFrozen,
  validateLandingExperiment,
  validateLandingPublication,
  validateLandingPublicationBinding,
  validateLandingPageVersion,
} from "../contracts/page-model.ts";
import { resolveFormSubmitIdempotency } from "../contracts/form-submit-success.ts";
import {
  previewVariantAllocationDistribution,
  resolveDeterministicVariant,
} from "../domain/routing.ts";
import { buildCanonicalLeadPayloadHash } from "../domain/form-success-idempotency.ts";
import {
  assertNoFabricatedMarketingConsent,
  buildAttributionTouchpointAfterLeadSuccess,
  buildFormSubmitSuccessAfterLeadSuccess,
  buildLandingLeadSubmissionContext,
  validateSignedPublicationContext,
} from "../domain/lead-intake-boundary.ts";
import {
  buildAlternateLandingPageVersion,
  buildSampleLandingBlocks,
  buildSampleLandingExperiment,
  buildSampleLandingPageVersion,
  buildSampleLandingPublication,
  buildSamplePublicationContext,
  LANDING_LAB_PREBUILD_BANNER,
} from "../fixtures/landing-fixtures.ts";
import {
  signPublicationContext,
  verifyPublicationContext,
} from "../server/publication-context-crypto.ts";

const root = process.cwd();
const secret = "phase-9b-test-secret";

describe("Phase 9B block schemas", () => {
  test("valid sample blocks pass validation", () => {
    const blocks = buildSampleLandingBlocks();
    assert.equal(validateLandingPageBlocks(blocks), null);
    for (const block of blocks) {
      assert.equal(validateLandingBlock(block), null);
    }
  });

  test("rejects duplicate block ids", () => {
    const blocks = buildSampleLandingBlocks();
    const duplicate = [...blocks, blocks[0]!];
    assert.match(validateLandingPageBlocks(duplicate) ?? "", /Duplicate block id/);
  });

  test("rejects unsafe HTML in text fields", () => {
    const hero: HeroBlock = {
      blockId: "hero-xss",
      type: "hero",
      headline: "<script>alert(1)</script>",
      subheadline: null,
      primaryCtaLabel: "Book",
      primaryCtaUrl: null,
      imageUrl: null,
    };
    assert.match(validateLandingBlock(hero) ?? "", /unsafe HTML/i);
  });

  test("rejects javascript URLs", () => {
    const hero: HeroBlock = {
      blockId: "hero-bad-url",
      type: "hero",
      headline: "Safe headline",
      subheadline: null,
      primaryCtaLabel: "Book",
      primaryCtaUrl: "javascript:alert(1)",
      imageUrl: null,
    };
    assert.match(validateLandingBlock(hero) ?? "", /safe http/i);
  });

  test("requires lead form and footer blocks", () => {
    const blocks = buildSampleLandingBlocks().filter(
      (block) => block.type !== "lead_form_placeholder" && block.type !== "footer"
    );
    assert.match(validateLandingPageBlocks(blocks) ?? "", /lead_form_placeholder|footer/);
  });
});

describe("Phase 9B page model", () => {
  test("frozen versions are immutable", () => {
    const version = buildSampleLandingPageVersion();
    assert.equal(isLandingPageVersionFrozen(version), true);
    assert.match(assertLandingPageVersionMutable(version) ?? "", /immutable/i);
  });

  test("publication binds exact frozen version", () => {
    const publication = buildSampleLandingPublication();
    const version = buildSampleLandingPageVersion();
    assert.equal(validateLandingPublicationBinding({ publication, version }), null);
    assert.equal(
      validateLandingPublicationBinding({
        publication: { ...publication, pageVersionNumber: 2 },
        version,
      }),
      "Publication must bind an exact page version number."
    );
  });

  test("experiment allocation must sum to 100", () => {
    const experiment = buildSampleLandingExperiment();
    assert.equal(validateLandingExperiment(experiment), null);
    const invalid = {
      ...experiment,
      variants: experiment.variants.map((variant, index) =>
        index === 0 ? { ...variant, allocationPercent: 40 } : variant
      ),
    };
    assert.match(validateLandingExperiment(invalid) ?? "", /sum to exactly 100/);
  });

  test("landing page version validates blocks", () => {
    assert.equal(validateLandingPageVersion(buildSampleLandingPageVersion()), null);
    assert.equal(validateLandingPublication(buildSampleLandingPublication()), null);
    assert.equal(
      validateLandingPublication({
        ...buildSampleLandingPublication(),
        status: "paused",
      }),
      null
    );
    assert.equal(
      validateLandingPublication({
        ...buildSampleLandingPublication(),
        status: "archived",
      }),
      null
    );
    assert.match(
      validateLandingPublication({
        ...buildSampleLandingPublication(),
        status: "scheduled" as never,
      }) ?? "",
      /invalid/i
    );
  });

  test("experiment rejects a fourth variant and accepts A/B/C totaling 100", () => {
    const experiment = buildSampleLandingExperiment();
    const fourth = {
      ...experiment,
      variants: [
        ...experiment.variants,
        {
          variantKey: "variant-c",
          pageReference: "OD-LP-2026-0001",
          pageVersionNumber: 2,
          allocationPercent: 10,
          label: "C",
        },
        {
          variantKey: "variant-d",
          pageReference: "OD-LP-2026-0001",
          pageVersionNumber: 2,
          allocationPercent: 10,
          label: "D",
        },
      ].map((variant, index, all) =>
        index === 0 ? { ...variant, allocationPercent: 100 - (all.length - 1) * 10 } : variant
      ),
    };
    assert.match(validateLandingExperiment(fourth) ?? "", /maximum variant count/);

    const abc = {
      ...experiment,
      variants: [
        { ...experiment.variants[0]!, allocationPercent: 34, variantKey: "control" },
        { ...experiment.variants[1]!, allocationPercent: 33, variantKey: "variant-b" },
        {
          variantKey: "variant-c",
          pageReference: "OD-LP-2026-0001",
          pageVersionNumber: 2,
          allocationPercent: 33,
          label: "C",
        },
      ],
    };
    assert.equal(validateLandingExperiment(abc), null);
  });
});

describe("Phase 9B deterministic routing", () => {
  const experiment = buildSampleLandingExperiment();

  test("same visitor key resolves to same variant", () => {
    const first = resolveDeterministicVariant({
      experiment,
      visitorKey: "visitor-abc-123",
    });
    const second = resolveDeterministicVariant({
      experiment,
      visitorKey: "visitor-abc-123",
    });
    assert.equal(first, second);
  });

  test("different visitor keys may resolve differently", () => {
    const keys = Array.from({ length: 20 }, (_, index) => `visitor-${index}`);
    const variants = new Set(
      keys.map((visitorKey) =>
        resolveDeterministicVariant({ experiment, visitorKey })
      )
    );
    assert.ok(variants.size >= 2);
  });

  test("routing does not use Math.random", () => {
    const routingSrc = readFileSync(
      join(root, "src/features/landing-lab/domain/routing.ts"),
      "utf8"
    );
    assert.doesNotMatch(routingSrc, /Math\.random/);
  });

  test("allocation preview approximates configured split", () => {
    const sampleKeys = Array.from({ length: 200 }, (_, index) => `sample-${index}`);
    const distribution = previewVariantAllocationDistribution({
      experiment,
      sampleVisitorKeys: sampleKeys,
    });
    assert.equal(
      (distribution.control ?? 0) + (distribution["variant-b"] ?? 0),
      sampleKeys.length
    );
    assert.ok((distribution.control ?? 0) > 50);
    assert.ok((distribution["variant-b"] ?? 0) > 50);
  });
});

describe("Phase 9B publication context HMAC", () => {
  test("signed context validates through boundary wrapper", () => {
    const signed = signPublicationContext(secret, buildSamplePublicationContext());
    const result = validateSignedPublicationContext(secret, signed);
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.context.pageVersionNumber, 1);
    }
  });

  test("tampered signature fails boundary wrapper", () => {
    const signed = signPublicationContext(secret, buildSamplePublicationContext());
    const tampered = {
      ...signed,
      context: { ...signed.context, variantKey: "tampered" },
    };
    const result = validateSignedPublicationContext(secret, tampered);
    assert.equal(result.valid, false);
    assert.deepEqual(verifyPublicationContext(secret, tampered), result);
  });

  test("already-expired publication context is rejected", () => {
    const expired = {
      ...buildSamplePublicationContext(),
      expiresAt: "2020-01-01T00:00:00.000Z",
    };
    const signed = signPublicationContext(secret, expired);
    const result = verifyPublicationContext(secret, signed);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.reason, /expired/i);
    }
  });
});

describe("Phase 9B lead intake boundary", () => {
  test("builds submission context from signed publication", () => {
    const signed = signPublicationContext(secret, buildSamplePublicationContext());
    const result = buildLandingLeadSubmissionContext({
      secret,
      signedPublicationContext: signed,
      fieldValues: { name: "Keshav", phone: "9876543210" },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.context.publicationReference, "OD-LP-PUB-0001");
      assert.equal(result.context.canonicalPayloadHash.length, 64);
    }
  });

  test("form submit success is built only after lead success context", () => {
    const signed = signPublicationContext(secret, buildSamplePublicationContext());
    const built = buildLandingLeadSubmissionContext({
      secret,
      signedPublicationContext: signed,
      fieldValues: { name: "Keshav", phone: "9876543210" },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;

    const event = buildFormSubmitSuccessAfterLeadSuccess({
      submissionId: "sub-9b-001",
      leadReference: "OD-L-0001",
      recordedAt: "2026-08-07T12:00:00.000Z",
      submissionContext: built.context,
    });
    assert.equal(event.leadReference, "OD-L-0001");
    assert.equal(event.canonicalPayloadHash, built.context.canonicalPayloadHash);
  });

  test("rejects fabricated marketing consent", () => {
    assert.match(
      assertNoFabricatedMarketingConsent({ marketing: true }) ?? "",
      /MARKETING consent cannot be fabricated/i
    );
    assert.equal(
      assertNoFabricatedMarketingConsent({ serviceEnquiry: true }),
      null
    );
  });

  test("attribution touchpoint is created after lead success", () => {
    const touchpoint = buildAttributionTouchpointAfterLeadSuccess({
      touchpointId: "tp-001",
      occurredAt: "2026-08-07T12:00:00.000Z",
      publicationContext: buildSamplePublicationContext(),
      leadReference: "OD-L-0001",
      campaignReference: "OD-C-2026-0001",
      campaignVersionNumber: 1,
      attribution: {
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "gurgaon-interiors",
      },
    });
    assert.equal(touchpoint.leadReference, "OD-L-0001");
    assert.equal(touchpoint.utmSource, "google");
    assert.equal(touchpoint.utmMedium, "cpc");
  });
});

describe("Phase 9B canonical payload hashing and idempotency", () => {
  test("canonical hash is stable regardless of field order", () => {
    const hashA = buildCanonicalLeadPayloadHash({
      publicationReference: "OD-LP-PUB-0001",
      pageReference: "OD-LP-2026-0001",
      pageVersionNumber: 1,
      experimentReference: null,
      variantKey: null,
      fields: { name: "Keshav", phone: "9876543210" },
    });
    const hashB = buildCanonicalLeadPayloadHash({
      publicationReference: "OD-LP-PUB-0001",
      pageReference: "OD-LP-2026-0001",
      pageVersionNumber: 1,
      experimentReference: null,
      variantKey: null,
      fields: { phone: "9876543210", name: "Keshav" },
    });
    assert.equal(hashA, hashB);
  });

  test("idempotency reuses matching hash and conflicts on mismatch", () => {
    const existing = {
      submissionId: "sub-1",
      canonicalPayloadHash: "hash-a",
      publicationReference: "OD-LP-PUB-0001",
      leadReference: "OD-L-0001",
      recordedAt: "2026-08-07T10:00:00.000Z",
    };
    assert.equal(
      resolveFormSubmitIdempotency({
        submissionId: "sub-1",
        canonicalPayloadHash: "hash-a",
        existing,
      }).status,
      "reused"
    );
    assert.equal(
      resolveFormSubmitIdempotency({
        submissionId: "sub-1",
        canonicalPayloadHash: "hash-b",
        existing,
      }).status,
      "conflict"
    );
  });
});

describe("Phase 9B UI prebuild contracts", () => {
  const componentPaths = [
    "src/features/landing-lab/components/LandingPageEditorShell.tsx",
    "src/features/landing-lab/components/BlockPalette.tsx",
    "src/features/landing-lab/components/PageBlockEditor.tsx",
    "src/features/landing-lab/components/PageOutline.tsx",
    "src/features/landing-lab/components/LandingPagePreview.tsx",
    "src/features/landing-lab/components/VersionBanner.tsx",
    "src/features/landing-lab/components/PublicationSummary.tsx",
    "src/features/landing-lab/components/ExperimentVariantPanel.tsx",
    "src/features/landing-lab/components/AttributionPreview.tsx",
    "src/features/landing-lab/components/LeadFormBlockPreview.tsx",
    "src/features/landing-lab/components/VariantComparison.tsx",
    "src/features/landing-lab/components/HumanWinnerControl.tsx",
  ];

  test("prebuild banner is present in editor shell and publication summary", () => {
    const editor = readFileSync(join(root, componentPaths[0]!), "utf8");
    const publication = readFileSync(join(root, componentPaths[6]!), "utf8");
    assert.match(editor, /LANDING_LAB_PREBUILD_BANNER/);
    assert.match(publication, /LANDING_LAB_PREBUILD_BANNER/);
    assert.equal(
      LANDING_LAB_PREBUILD_BANNER.includes("PREVIEW"),
      true
    );
    assert.match(LANDING_LAB_PREBUILD_BANNER, /not a public publication/i);
  });

  test("lead form preview is non-submitting", () => {
    const leadForm = readFileSync(join(root, componentPaths[9]!), "utf8");
    assert.match(leadForm, /preventDefault/);
    assert.match(leadForm, /disabled/);
    assert.match(leadForm, /does not submit/i);
    assert.doesNotMatch(leadForm, /fetch\(|supabase/i);
  });

  test("variant comparison uses frozen versions fixture", () => {
    const left = buildSampleLandingPageVersion();
    const right = buildAlternateLandingPageVersion();
    assert.notEqual(left.blocks[0]?.type === "hero" ? left.blocks[0].headline : "", "");
    assert.notEqual(right.blocks[0]?.type === "hero" ? right.blocks[0].headline : "", "");
    assert.notEqual(
      left.blocks[0]?.type === "hero" ? left.blocks[0].headline : "",
      right.blocks[0]?.type === "hero" ? right.blocks[0].headline : ""
    );
  });

  test("no dangerouslySetInnerHTML in landing-lab components", () => {
    for (const path of componentPaths) {
      const content = readFileSync(join(root, path), "utf8");
      assert.doesNotMatch(content, /dangerouslySetInnerHTML/);
    }
  });
});

describe("Phase 9B security firewall assertions", () => {
  const scopedFiles = [
    "src/features/landing-lab/contracts/blocks.ts",
    "src/features/landing-lab/contracts/page-model.ts",
    "src/features/landing-lab/domain/routing.ts",
    "src/features/landing-lab/domain/lead-intake-boundary.ts",
    "src/features/landing-lab/domain/form-success-idempotency.ts",
    "src/features/landing-lab/fixtures/landing-fixtures.ts",
    ...[
      "LandingPageEditorShell",
      "LeadFormBlockPreview",
      "ExperimentVariantPanel",
    ].map((name) => `src/features/landing-lab/components/${name}.tsx`),
  ];

  test("no provider APIs, public routes, or tracking SDKs", () => {
    for (const file of scopedFiles) {
      const content = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(content, /meta\.com|googleads|gtag|fbq|segment\.com/i);
      assert.doesNotMatch(content, /app\/\(public\)|createRouteHandler/i);
    }
  });

  test("no migrations or M19-M21 references in phase 9B scope", () => {
    for (const file of scopedFiles) {
      const content = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(content, /supabase\/migrations\/M1[9-9]|supabase\/migrations\/M2[0-1]/);
    }
  });
});
