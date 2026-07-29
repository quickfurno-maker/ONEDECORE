/**
 * Phase 4A — lead intake application contract tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_INTAKE_PLANNER_VERSION,
  MARKETING_COPY_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
} from "../contracts.ts";
import { normalisePhoneToE164 } from "../server/phone-normalisation.ts";
import {
  buildCanonicalRequestPayload,
  fingerprintPhone,
  fingerprintRequest,
  hmacSha256Hex,
} from "../server/request-fingerprints.ts";
import {
  parseJsonBody,
  validateLeadIntakePayload,
} from "../server/lead-intake-validation.ts";
import { handleLeadIntakeRequest } from "../server/lead-intake-runtime.ts";
import { LeadIntakeError } from "../server/lead-intake-errors.ts";
import { getLeadIntakeMode, getLeadIntakeServerEnv } from "../../../config/server-env.ts";
import type { ValidatedLeadIntake } from "../contracts.ts";

const root = process.cwd();
const secret = "phase4a-local-test-hash-secret-32chars-min";

function basePayload(overrides: Record<string, unknown> = {}) {
  const body = {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    plannerVersion: LEAD_INTAKE_PLANNER_VERSION,
    contact: {
      name: "Test Person",
      mobile: "9876543210",
      email: "synthetic@example.test",
    },
    requirements: {
      service: "complete-home-interiors",
      property: "apartment-2bhk",
      timeline: "within-3-months",
      rooms: ["living", "kitchen"],
      budgetComfort: "6-12l",
      locality: "Koregaon Park",
      message: "Synthetic local-test brief",
    },
    consent: {
      serviceEnquiry: true,
      serviceCommunication: true,
      whatsappService: false,
      marketing: false,
      serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
      noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    },
    attribution: {
      landingPath: "/",
    },
    antiBot: {
      website: "",
      formStartedAt: new Date(Date.now() - 5_000).toISOString(),
    },
    ...overrides,
  };
  return body;
}

function validatedFixture(
  overrides: Partial<ValidatedLeadIntake> = {}
): ValidatedLeadIntake {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    plannerVersion: LEAD_INTAKE_PLANNER_VERSION,
    name: "Test Person",
    phoneE164: "+919876543210",
    email: "synthetic@example.test",
    service: "complete-home-interiors",
    property: "apartment-2bhk",
    timeline: "within-3-months",
    rooms: ["living", "kitchen"],
    budgetComfort: "6-12l",
    estimateSnapshot: null,
    locality: "Koregaon Park",
    message: "Synthetic local-test brief",
    landingPath: "/",
    attribution: { landingPath: "/" },
    consentWhatsapp: false,
    consentMarketing: false,
    copyServiceEnquiry: SERVICE_ENQUIRY_COPY_VERSION,
    copyServiceCommunication: SERVICE_COMMUNICATION_COPY_VERSION,
    copyWhatsapp: null,
    copyMarketing: null,
    noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    formStartedAt: new Date(Date.now() - 5_000).toISOString(),
    ...overrides,
  };
}

describe("Phase 4A lead intake runtime env", () => {
  test("default mode disabled", () => {
    assert.equal(getLeadIntakeMode({}), "disabled");
    assert.equal(
      getLeadIntakeServerEnv({ ONEDECORE_LEAD_INTAKE_MODE: "disabled" }).mode,
      "disabled"
    );
  });

  test("local-test forbidden in production", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        NODE_ENV: "production",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
    assert.equal(
      getLeadIntakeMode({
        NODE_ENV: "production",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
      }),
      "disabled"
    );
  });

  test("enabled blocked by legal gate", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        ONEDECORE_LEAD_INTAKE_MODE: "enabled",
        ONEDECORE_TRUST_PROXY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
  });

  test("publishable key rejected in service-role slot", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_test",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
  });

  test("missing hash secret rejected", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: "short",
      })
    );
  });
});

describe("Phase 4A phone normalisation", () => {
  test("accepts E.164 and explicit Indian mobile forms", () => {
    assert.equal(normalisePhoneToE164("+919876543210").ok, true);
    assert.deepEqual(normalisePhoneToE164("9876543210"), {
      ok: true,
      e164: "+919876543210",
    });
    assert.deepEqual(normalisePhoneToE164("09876543210"), {
      ok: true,
      e164: "+919876543210",
    });
    assert.deepEqual(normalisePhoneToE164("919876543210"), {
      ok: true,
      e164: "+919876543210",
    });
  });

  test("rejects ambiguous digit strings", () => {
    assert.equal(normalisePhoneToE164("12345").ok, false);
    assert.equal(normalisePhoneToE164("441234567890").ok, false);
  });
});

describe("Phase 4A validation", () => {
  test("exact valid payload", () => {
    const result = validateLeadIntakePayload(basePayload());
    assert.equal(result.ok, true);
  });

  test("unknown keys rejected", () => {
    const result = validateLeadIntakePayload(
      basePayload({ extra: true } as Record<string, unknown>)
    );
    assert.equal(result.ok, false);
  });

  test("malformed JSON and body size", () => {
    assert.equal(parseJsonBody("{").ok, false);
    assert.equal(parseJsonBody("x".repeat(33 * 1024)).ok, false);
  });

  test("name/phone/email bounds and ambiguous phone", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: { name: "A", mobile: "9876543210" },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: { name: "Test Person", mobile: "12345" },
        })
      ).ok,
      false
    );
  });

  test("invalid IDs and duplicate rooms", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          requirements: {
            ...basePayload().requirements,
            service: "not-a-service",
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          requirements: {
            ...basePayload().requirements,
            rooms: ["living", "living"],
          },
        })
      ).ok,
      false
    );
  });

  test("required consent and optional version rules", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            serviceEnquiry: false,
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            whatsappService: true,
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            whatsappService: true,
            whatsappCopyVersion: WHATSAPP_COPY_VERSION,
          },
        })
      ).ok,
      true
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            marketing: true,
            marketingCopyVersion: MARKETING_COPY_VERSION,
          },
        })
      ).ok,
      true
    );
  });

  test("AI/media consent keys rejected", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            aiAssistance: true,
          },
        })
      ).ok,
      false
    );
  });

  test("honeypot and timing", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          antiBot: {
            website: "http://spam.test",
            formStartedAt: new Date(Date.now() - 5_000).toISOString(),
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          antiBot: {
            website: "",
            formStartedAt: new Date().toISOString(),
          },
        })
      ).ok,
      false
    );
  });
});

describe("Phase 4A fingerprints", () => {
  test("deterministic canonical hash independent of field order", () => {
    const a = validatedFixture();
    const b = validatedFixture();
    assert.equal(
      fingerprintRequest(secret, a),
      fingerprintRequest(secret, b)
    );
    assert.equal(
      buildCanonicalRequestPayload(a),
      buildCanonicalRequestPayload(b)
    );
    const changed = validatedFixture({
      noticeVersion: "privacy-notice-other",
    });
    assert.notEqual(
      fingerprintRequest(secret, a),
      fingerprintRequest(secret, changed)
    );
    assert.equal(
      fingerprintPhone(secret, "+919876543210"),
      hmacSha256Hex(secret, "phone:+919876543210")
    );
  });
});

describe("Phase 4A route runtime", () => {
  test("disabled returns 503", async () => {
    const result = await handleLeadIntakeRequest(
      {
        method: "POST",
        contentType: "application/json",
        origin: "http://localhost:3100",
        host: "localhost:3100",
        rawBody: JSON.stringify(basePayload()),
        remoteAddress: "127.0.0.1",
        forwardedFor: null,
        nodeEnv: "development",
      },
      {
        getEnv: () =>
          getLeadIntakeServerEnv({ ONEDECORE_LEAD_INTAKE_MODE: "disabled" }),
      }
    );
    assert.equal(result.httpStatus, 503);
    assert.equal(result.body.code, "LEAD_INTAKE_DISABLED");
  });

  test("non-POST rejected", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest({
          method: "GET",
          contentType: "application/json",
          origin: "http://localhost:3100",
          host: "localhost:3100",
          rawBody: "{}",
          remoteAddress: "127.0.0.1",
          forwardedFor: null,
          nodeEnv: "development",
        }),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.httpStatus === 405
    );
  });

  test("non-JSON rejected", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest({
          method: "POST",
          contentType: "text/plain",
          origin: "http://localhost:3100",
          host: "localhost:3100",
          rawBody: "x",
          remoteAddress: "127.0.0.1",
          forwardedFor: null,
          nodeEnv: "development",
        }),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.httpStatus === 415
    );
  });

  test("same-origin enforced", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest({
          method: "POST",
          contentType: "application/json",
          origin: "https://evil.example",
          host: "localhost:3100",
          rawBody: "{}",
          remoteAddress: "127.0.0.1",
          forwardedFor: null,
          nodeEnv: "development",
        }),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.httpStatus === 403
    );
  });

  test("local-test host restriction", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest(
          {
            method: "POST",
            contentType: "application/json",
            origin: "https://onedecore.example",
            host: "onedecore.example",
            rawBody: JSON.stringify(basePayload()),
            remoteAddress: "1.2.3.4",
            forwardedFor: null,
            nodeEnv: "development",
          },
          {
            getEnv: () =>
              getLeadIntakeServerEnv({
                NODE_ENV: "development",
                ONEDECORE_LEAD_INTAKE_MODE: "local-test",
                NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
                SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
                ONEDECORE_LEAD_HASH_SECRET: secret,
              }),
          }
        ),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.code === "LOCAL_TEST_HOST_REQUIRED"
    );
  });

  test("validation error returns safe field codes", async () => {
    const result = await handleLeadIntakeRequest(
      {
        method: "POST",
        contentType: "application/json",
        origin: "http://localhost:3100",
        host: "localhost:3100",
        rawBody: JSON.stringify(
          basePayload({
            contact: { name: "X", mobile: "9876543210" },
          })
        ),
        remoteAddress: "127.0.0.1",
        forwardedFor: null,
        nodeEnv: "development",
      },
      {
        getEnv: () =>
          getLeadIntakeServerEnv({
            NODE_ENV: "development",
            ONEDECORE_LEAD_INTAKE_MODE: "local-test",
            NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
            ONEDECORE_LEAD_HASH_SECRET: secret,
          }),
      }
    );
    assert.equal(result.httpStatus, 400);
    assert.equal(result.body.code, "VALIDATION_REJECTED");
    assert.ok(Array.isArray(result.body.fields));
  });
});

describe("Phase 4A homepage and server-only guards", () => {
  test("homepage has no intake fetch and copy flow unchanged", () => {
    const home = join(root, "src/features/public-site/home-r4");
    const files = [
      "HomePlanner.tsx",
      "HomePlan.tsx",
      "PlanContext.tsx",
      "content.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(home, file), "utf8");
      assert.doesNotMatch(src, /\/api\/public\/lead-intake/);
      assert.doesNotMatch(src, /lead-intake/);
    }
    const content = readFileSync(join(home, "content.ts"), "utf8");
    assert.match(content, /Nothing is submitted/);
    assert.match(content, /Copy My Interior Brief/);
  });

  test("server-only imports and env example placeholders", () => {
    const serverFiles = [
      "src/config/server-env.ts",
      "src/lib/supabase/admin.ts",
      "src/features/lead-intake/server/lead-intake-runtime.ts",
      "src/app/api/public/lead-intake/route.ts",
    ];
    for (const file of serverFiles) {
      const src = readFileSync(join(root, file), "utf8");
      assert.match(src, /server-only/);
      assert.doesNotMatch(src, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
      assert.doesNotMatch(src, /NEXT_PUBLIC_.*HASH_SECRET/);
    }
    const example = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(example, /ONEDECORE_LEAD_INTAKE_MODE=/);
    assert.match(example, /SUPABASE_SERVICE_ROLE_KEY=/);
    assert.match(example, /ONEDECORE_LEAD_HASH_SECRET=/);
    assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{10,}/);
    assert.ok(existsSync(join(root, "src/app/api/public/lead-intake/route.ts")));
  });

  test("slash route remains static in app page", () => {
    const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
    assert.doesNotMatch(page, /lead-intake/);
    assert.doesNotMatch(page, /export const dynamic\s*=\s*["']force-dynamic["']/);
  });
});
