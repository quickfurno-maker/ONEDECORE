/**
 * Phase 9B M32 — repository implementation tests (wired Landing Lab).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  isLandingPublicationPubliclyRenderable,
  validateLandingExperiment,
  validateLandingPublication,
} from "../contracts/page-model.ts";
import { buildSampleLandingExperiment, buildSampleLandingPublication } from "../fixtures/landing-fixtures.ts";
import { isLandingLabPublicPath, resolveLandingVisitorKey } from "../domain/landing-visitor-key.ts";
import { isLandingLabPublicEnabled } from "../server/landing-lab-env.ts";
import { hashLandingVisitorKey } from "../server/visitor-key-hash.ts";
import { validateLeadIntakePayload } from "../../lead-intake/server/lead-intake-validation.ts";
import { signPublicationContext, verifyPublicationContext } from "../server/publication-context-crypto.ts";
import { buildSamplePublicationContext } from "../fixtures/landing-fixtures.ts";
import { SERVICE_ENQUIRY_COPY_VERSION, SERVICE_COMMUNICATION_COPY_VERSION, LEAD_INTAKE_NOTICE_VERSION, LEAD_INTAKE_PLANNER_VERSION } from "../../lead-intake/contracts.ts";

const root = process.cwd();
const secret = "phase-9b-m32-test-secret-value-32chars";

function intakeBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    plannerVersion: LEAD_INTAKE_PLANNER_VERSION,
    contact: { name: "Test Person", mobile: "+919876543210" },
    requirements: {
      service: "complete-home-interiors",
      property: "apartment-2bhk",
      timeline: "within-3-months",
      rooms: ["living"],
    },
    consent: {
      serviceEnquiry: true,
      serviceChannels: { phone: true },
      serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
      noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    },
    attribution: { landingPath: "/lp/gurgaon-interiors" },
    antiBot: {
      website: "",
      formStartedAt: new Date(Date.now() - 5_000).toISOString(),
    },
    ...overrides,
  };
}

describe("Phase 9B M32 publication and experiment contracts", () => {
  test("only live publications are publicly renderable", () => {
    assert.equal(isLandingPublicationPubliclyRenderable("live"), true);
    assert.equal(isLandingPublicationPubliclyRenderable("draft"), false);
    assert.equal(isLandingPublicationPubliclyRenderable("paused"), false);
    assert.equal(isLandingPublicationPubliclyRenderable("archived"), false);
  });

  test("scheduled is not a valid publication status", () => {
    assert.match(
      validateLandingPublication({
        ...buildSampleLandingPublication(),
        status: "scheduled" as never,
      }) ?? "",
      /invalid/i
    );
  });

  test("human winner only on concluded experiments", () => {
    const running = {
      ...buildSampleLandingExperiment(),
      status: "running" as const,
      winnerVariantKey: "control",
    };
    assert.match(validateLandingExperiment(running) ?? "", /concluding/i);
  });
});

describe("Phase 9B M32 proxy visitor cookie", () => {
  test("matcher paths isolate /lp from admin", () => {
    assert.equal(isLandingLabPublicPath("/lp/gurgaon-interiors"), true);
    assert.equal(isLandingLabPublicPath("/admin/landing-pages"), false);
    assert.equal(isLandingLabPublicPath("/auth/login"), false);
    const proxySrc = readFileSync(join(root, "src/proxy.ts"), "utf8");
    assert.match(proxySrc, /\/lp\/:path\*/);
    assert.match(proxySrc, /updateSession/);
    assert.match(proxySrc, /isLandingLabPublicPath/);
  });

  test("stable UUID visitor key is reused; missing cookie creates one", () => {
    const existing = "11111111-1111-4111-8111-111111111111";
    const reused = resolveLandingVisitorKey(existing);
    assert.equal(reused.created, false);
    assert.equal(reused.visitorKey, existing);
    const created = resolveLandingVisitorKey(undefined);
    assert.equal(created.created, true);
    assert.match(created.visitorKey, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe("Phase 9B M32 exposures and activation", () => {
  test("visitor hash is HMAC not raw UUID", () => {
    const visitor = "11111111-1111-4111-8111-111111111111";
    const hashed = hashLandingVisitorKey(secret, visitor);
    assert.equal(hashed.length, 64);
    assert.notEqual(hashed, visitor);
    const exposureSrc = readFileSync(
      join(root, "supabase/migrations/20260819140000_landing_page_lab_experimentation_foundation.sql"),
      "utf8"
    );
    assert.doesNotMatch(exposureSrc, /raw_ip|user_agent|fingerprint/);
    assert.match(exposureSrc, /visitor_key_hash/);
  });

  test("public landing lab gate defaults off", () => {
    assert.equal(isLandingLabPublicEnabled({}), false);
    assert.equal(isLandingLabPublicEnabled({ ONEDECORE_LANDING_LAB_PUBLIC_ENABLED: "true" }), true);
    const pageSrc = readFileSync(join(root, "src/app/lp/[slug]/page.tsx"), "utf8");
    assert.match(pageSrc, /robots/);
    assert.match(pageSrc, /index: false/);
    const sitemap = readFileSync(join(root, "src/app/sitemap.ts"), "utf8");
    assert.doesNotMatch(sitemap, /\/lp/);
  });

  test("no dangerouslySetInnerHTML in public renderer or live form", () => {
    for (const path of [
      "src/features/landing-lab/components/LandingPublicRenderer.tsx",
      "src/features/landing-lab/components/LiveLandingLeadForm.tsx",
      "src/app/lp/[slug]/page.tsx",
    ]) {
      assert.doesNotMatch(readFileSync(join(root, path), "utf8"), /dangerouslySetInnerHTML/);
    }
  });

  test("live form is distinct from non-submitting preview", () => {
    const preview = readFileSync(join(root, "src/features/landing-lab/components/LeadFormBlockPreview.tsx"), "utf8");
    const live = readFileSync(join(root, "src/features/landing-lab/components/LiveLandingLeadForm.tsx"), "utf8");
    assert.match(preview, /does not submit/i);
    assert.match(live, /\/api\/public\/lead-intake/);
    assert.doesNotMatch(live, /marketing:\s*true/i);
  });
});

describe("Phase 9B M32 lead intake attribution", () => {
  test("accepts fbclid and gclid and rejects unknown attribution keys", () => {
    const ok = validateLeadIntakePayload(
      intakeBody({
        attribution: {
          landingPath: "/lp/gurgaon-interiors",
          utmSource: "google",
          fbclid: "fb.1",
          gclid: "g.1",
        },
      })
    );
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.attribution.fbclid, "fb.1");
      assert.equal(ok.value.attribution.gclid, "g.1");
      assert.equal(ok.value.attribution.utmSource, "google");
    }

    const unknown = validateLeadIntakePayload(
      intakeBody({
        attribution: {
          landingPath: "/lp/gurgaon-interiors",
          pageReference: "OD-LP-2026-000001",
        },
      })
    );
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.ok(unknown.fields.some((field) => field.includes("pageReference")));
    }
  });

  test("rejects MARKETING fabrication on consent", () => {
    const result = validateLeadIntakePayload(
      intakeBody({
        consent: {
          serviceEnquiry: true,
          serviceChannels: { phone: true },
          serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
          serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
          noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
          marketing: true,
        },
      })
    );
    assert.equal(result.ok, false);
  });

  test("tampered signed publication context fails HMAC", () => {
    const signed = signPublicationContext(secret, buildSamplePublicationContext());
    const tampered = {
      ...signed,
      context: { ...signed.context, pageVersionNumber: 99 },
    };
    assert.equal(verifyPublicationContext(secret, tampered).valid, false);
  });
});

describe("Phase 9B M32 no provider execution", () => {
  test("M32 SQL has no Meta/Google provider mutations", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20260819140000_landing_page_lab_experimentation_foundation.sql"),
      "utf8"
    );
    assert.doesNotMatch(sql, /graph\.facebook|googleads|campaigns\.execute/);
    assert.match(sql, /landing_pages\.read/);
    assert.match(sql, /OD-LP-PUB-/);
  });
});
