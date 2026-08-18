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
import { getLandingLabHmacSecret, isLandingLabPublicEnabled } from "../server/landing-lab-env.ts";
import { hashLandingVisitorKey } from "../server/visitor-key-hash.ts";
import { validateLeadIntakePayload } from "../../lead-intake/server/lead-intake-validation.ts";
import { handleLeadIntakeRequest } from "../../lead-intake/server/lead-intake-runtime.ts";
import { getLeadIntakeServerEnv } from "../../../config/server-env.ts";
import { signPublicationContext, verifyPublicationContext } from "../server/publication-context-crypto.ts";
import { buildSamplePublicationContext } from "../fixtures/landing-fixtures.ts";
import { SERVICE_ENQUIRY_COPY_VERSION, SERVICE_COMMUNICATION_COPY_VERSION, LEAD_INTAKE_NOTICE_VERSION, LEAD_INTAKE_PLANNER_VERSION } from "../../lead-intake/contracts.ts";
import type { createAdminClient } from "../../../lib/supabase/admin.ts";

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

  test("live form does not invent customer requirements", () => {
    const live = readFileSync(join(root, "src/features/landing-lab/components/LiveLandingLeadForm.tsx"), "utf8");
    assert.doesNotMatch(live, /defaultChecked/);
    assert.match(live, /defaultValue=""/);
    assert.match(live, /Select service/);
    assert.match(live, /Select property/);
    assert.match(live, /Select timeline/);
    assert.match(live, /Rooms \(optional\)/);
    assert.doesNotMatch(live, /type="hidden"[^>]*name="service"/);
    assert.doesNotMatch(live, /type="hidden"[^>]*name="property"/);
    assert.doesNotMatch(live, /type="hidden"[^>]*name="timeline"/);
    assert.doesNotMatch(live, /type="hidden"[^>]*name="rooms"/);
    const emptyRooms = validateLeadIntakePayload(intakeBody({
      requirements: {
        service: "complete-home-interiors",
        property: "apartment-2bhk",
        timeline: "within-3-months",
        rooms: [],
      },
    }));
    assert.equal(emptyRooms.ok, true);
  });

  test("public gate default OFF prevents live page resolution without anon RPC bypass", () => {
    assert.equal(isLandingLabPublicEnabled({}), false);
    const loaderSrc = readFileSync(join(root, "src/features/landing-lab/server/load-live-landing-page.ts"), "utf8");
    assert.match(loaderSrc, /if \(!isEnabled\(\)\) return null/);
    assert.match(loaderSrc, /if \(!secret\) return null/);
    assert.match(loaderSrc, /if \(!supabase\) return null/);
    assert.match(loaderSrc, /createLandingLabServiceClient/);
    assert.doesNotMatch(loaderSrc, /@\/lib\/supabase\/server/);
    const sql = readFileSync(
      join(root, "supabase/migrations/20260819140000_landing_page_lab_experimentation_foundation.sql"),
      "utf8"
    );
    assert.doesNotMatch(sql, /grant execute on function public\.get_live_landing_publication\(text\) to anon/);
    assert.doesNotMatch(sql, /grant execute on function public\.verify_live_landing_publication_context\([^)]*\) to anon/);
    assert.match(sql, /grant execute on function public\.get_live_landing_publication\(text\) to service_role/);
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

  test("dedicated landing HMAC signs and verifies independently of lead hash secret", async () => {
    const landingSecret = "phase-9b-landing-hmac-secret-32chars-min!!";
    const leadSecret = "phase-9b-lead-hash-secret-32chars-min!!!!";
    assert.notEqual(landingSecret, leadSecret);
    assert.equal(
      getLandingLabHmacSecret({
        ONEDECORE_LANDING_LAB_HMAC_SECRET: landingSecret,
        ONEDECORE_LEAD_HASH_SECRET: leadSecret,
      }),
      landingSecret
    );

    const signedWithLanding = signPublicationContext(landingSecret, buildSamplePublicationContext());
    const signedWithLead = signPublicationContext(leadSecret, buildSamplePublicationContext());
    assert.equal(verifyPublicationContext(landingSecret, signedWithLanding).valid, true);
    assert.equal(verifyPublicationContext(leadSecret, signedWithLanding).valid, false);
    assert.equal(verifyPublicationContext(landingSecret, signedWithLead).valid, false);

    const rpcCalls: string[] = [];
    const adminMock = (() =>
      ({
        rpc: async (fn: string) => {
          rpcCalls.push(fn);
          if (fn === "verify_live_landing_publication_context") {
            return { data: { ok: true }, error: null };
          }
          if (fn === "submit_lead_intake") {
            return {
              data: {
                outcome: "created",
                submission_reference: "OD-L-2026-000001",
                retry_after_seconds: null,
                duplicate: false,
              },
              error: null,
            };
          }
          throw new Error(`unexpected rpc ${fn}`);
        },
      })) as unknown as typeof createAdminClient;

    const localEnv = () =>
      getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: leadSecret,
      });

    const request = {
      method: "POST",
      contentType: "application/json",
      origin: "http://localhost:3100",
      host: "localhost:3100",
      remoteAddress: "127.0.0.1",
      forwardedFor: null,
      nodeEnv: "development",
    } as const;

    const accepted = await handleLeadIntakeRequest(
      {
        ...request,
        rawBody: JSON.stringify(intakeBody({ landingPublicationContext: signedWithLanding })),
      },
      {
        getEnv: localEnv,
        getLandingLabHmacSecret: () =>
          getLandingLabHmacSecret({
            ONEDECORE_LANDING_LAB_HMAC_SECRET: landingSecret,
            ONEDECORE_LEAD_HASH_SECRET: leadSecret,
          }),
        createAdminClient: adminMock,
      }
    );
    assert.equal(accepted.httpStatus, 201);
    assert.equal(accepted.body.ok, true);
    assert.ok(rpcCalls.includes("verify_live_landing_publication_context"));
    assert.ok(rpcCalls.includes("submit_lead_intake"));

    rpcCalls.length = 0;
    const rejected = await handleLeadIntakeRequest(
      {
        ...request,
        rawBody: JSON.stringify(intakeBody({ landingPublicationContext: signedWithLead })),
      },
      {
        getEnv: localEnv,
        getLandingLabHmacSecret: () =>
          getLandingLabHmacSecret({
            ONEDECORE_LANDING_LAB_HMAC_SECRET: landingSecret,
            ONEDECORE_LEAD_HASH_SECRET: leadSecret,
          }),
        createAdminClient: adminMock,
      }
    );
    assert.equal(rejected.httpStatus, 400);
    assert.equal(rejected.body.code, "VALIDATION_REJECTED");
    assert.deepEqual(rejected.body.fields, ["landingPublicationContext"]);
    assert.ok(!rpcCalls.includes("submit_lead_intake"));
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
