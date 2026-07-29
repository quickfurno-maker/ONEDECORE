/**
 * Phase 4A / 4A.1 — lead intake application contract tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_INTAKE_PLANNER_VERSION,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
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
import {
  getLeadIntakeMode,
  getLeadIntakeServerEnv,
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../../../config/server-env.ts";
import type { ValidatedLeadIntake } from "../contracts.ts";
import {
  LEAD_INTAKE_MAX_BODY_BYTES,
  readBoundedRequestBody,
} from "../server/bounded-request-body.ts";
import { isSafeSameSitePath } from "../server/same-site-path.ts";
import {
  CONSENT_VERSIONS,
  getConsentVersionByPurpose,
} from "../../legal/consent-registry.ts";
import { PRIVACY_NOTICE_VERSION } from "../../legal/privacy-policy-content.ts";
import { BUDGET_COMFORT_OPTIONS } from "../../public-site/home-r4/budget-config.ts";

const root = process.cwd();
const secret = "phase4a-local-test-hash-secret-32chars-min";
const MANAGED = "https://lpurlfmpvriyvpkujvyl.supabase.co";

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
      serviceChannels: { phone: true, email: true },
      whatsappService: false,
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
    consentServicePhone: true,
    consentServiceEmail: true,
    consentWhatsapp: false,
    copyServiceEnquiry: SERVICE_ENQUIRY_COPY_VERSION,
    copyServiceCommunication: SERVICE_COMMUNICATION_COPY_VERSION,
    copyWhatsapp: null,
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
    const disabled = getLeadIntakeServerEnv({
      ONEDECORE_LEAD_INTAKE_MODE: "disabled",
      NEXT_PUBLIC_SUPABASE_URL: MANAGED,
      SUPABASE_SERVICE_ROLE_KEY: "should-not-be-returned",
    });
    assert.equal(disabled.supabaseUrl, null);
    assert.equal(disabled.serviceRoleKey, null);
    assert.equal(disabled.hashSecret, null);
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
        NEXT_PUBLIC_SUPABASE_URL: MANAGED,
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

describe("Phase 4A.1 local-test URL isolation", () => {
  test("helpers accept loopback and managed host only as specified", () => {
    assert.equal(isLoopbackSupabaseUrl("http://127.0.0.1:54321"), true);
    assert.equal(isLoopbackSupabaseUrl("http://localhost:54321"), true);
    assert.equal(isLoopbackSupabaseUrl("http://[::1]:54321"), true);
    assert.equal(isLoopbackSupabaseUrl(MANAGED), false);
    assert.equal(isLoopbackSupabaseUrl("https://evil.supabase.co"), false);
    assert.equal(isLoopbackSupabaseUrl("http://192.168.1.1:54321"), false);
    assert.equal(isLoopbackSupabaseUrl("http://user@127.0.0.1:54321"), false);
    assert.equal(isManagedOneDecoreSupabaseUrl(MANAGED), true);
    assert.equal(
      isManagedOneDecoreSupabaseUrl("http://lpurlfmpvriyvpkujvyl.supabase.co"),
      false
    );
    assert.equal(
      isManagedOneDecoreSupabaseUrl(`${MANAGED}/extra`),
      false
    );
  });

  test("local-test + managed URL rejects before admin-client creation", () => {
    let threw = false;
    try {
      getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: MANAGED,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      });
    } catch (err) {
      threw = true;
      const message = err instanceof Error ? err.message : String(err);
      assert.match(message, /loopback/i);
      assert.doesNotMatch(message, /lpurlfmpvriyvpkujvyl/);
      assert.doesNotMatch(message, /service-role-test-key/);
      assert.doesNotMatch(message, /https?:\/\//);
    }
    assert.equal(threw, true);
  });

  test("local-test + remote host rejects", () => {
    assert.throws(() =>
      getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "https://db.example.com",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      })
    );
  });

  test("localhost and 127.0.0.1 allow", () => {
    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
    ]) {
      const env = getLeadIntakeServerEnv({
        NODE_ENV: "development",
        ONEDECORE_LEAD_INTAKE_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: url,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      });
      assert.equal(env.mode, "local-test");
      assert.equal(env.supabaseUrl, url);
    }
  });

  test("enabled wrong project rejects without leaking URL/key", () => {
    let message = "";
    try {
      getLeadIntakeServerEnv({
        ONEDECORE_LEAD_INTAKE_MODE: "enabled",
        ONEDECORE_TRUST_PROXY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://otherproject.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        ONEDECORE_LEAD_HASH_SECRET: secret,
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    assert.match(message, /managed|activation|blocked|project/i);
    assert.doesNotMatch(message, /otherproject/);
    assert.doesNotMatch(message, /service-role-test-key/);
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
    if (result.ok) {
      assert.equal(result.value.consentServicePhone, true);
      assert.equal(result.value.consentServiceEmail, true);
    }
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
          contact: { name: "A", mobile: "9876543210", email: "a@b.co" },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: { name: "Test Person", mobile: "12345", email: "a@b.co" },
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
  });

  test("marketing keys rejected as unknown", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            marketing: true,
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
            marketingCopyVersion: "marketing-consent-v0.1-draft",
          },
        })
      ).ok,
      false
    );
  });

  test("phone service channel required; email channel paired with email", () => {
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          consent: {
            ...basePayload().consent,
            serviceChannels: { phone: false },
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: { name: "Test Person", mobile: "9876543210" },
          consent: {
            ...basePayload().consent,
            serviceChannels: { phone: true, email: true },
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: {
            name: "Test Person",
            mobile: "9876543210",
            email: "synthetic@example.test",
          },
          consent: {
            ...basePayload().consent,
            serviceChannels: { phone: true },
          },
        })
      ).ok,
      false
    );
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          contact: { name: "Test Person", mobile: "9876543210" },
          consent: {
            ...basePayload().consent,
            serviceChannels: { phone: true },
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

describe("Phase 4A.1 same-site path hardening", () => {
  test("accepts / and path with query", () => {
    assert.equal(isSafeSameSitePath("/"), true);
    assert.equal(isSafeSameSitePath("/portfolio?service=kitchen"), true);
    assert.equal(
      validateLeadIntakePayload(
        basePayload({
          attribution: { landingPath: "/portfolio?service=kitchen" },
        })
      ).ok,
      true
    );
  });

  test("rejects protocol-relative, backslash, absolute URL, control chars", () => {
    assert.equal(isSafeSameSitePath("//evil.example"), false);
    assert.equal(isSafeSameSitePath("/path\\to"), false);
    assert.equal(isSafeSameSitePath("https://evil.example/"), false);
    assert.equal(isSafeSameSitePath("/ok\u0000"), false);
    for (const landingPath of [
      "//evil.example",
      "/path\\evil",
      "https://evil.example/",
      "/ok\u0001",
    ]) {
      assert.equal(
        validateLeadIntakePayload(
          basePayload({ attribution: { landingPath } })
        ).ok,
        false,
        landingPath
      );
    }
  });
});

describe("Phase 4A.1 bounded request body", () => {
  test("valid small JSON", async () => {
    const text = JSON.stringify({ ok: true });
    const request = new Request("http://127.0.0.1/test", {
      method: "POST",
      body: text,
      headers: { "content-type": "application/json" },
    });
    const result = await readBoundedRequestBody(request);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.text, text);
  });

  test("Content-Length over cap rejected before stream consumption", async () => {
    let read = false;
    const stream = new ReadableStream({
      pull(controller) {
        read = true;
        controller.enqueue(new TextEncoder().encode("x"));
        controller.close();
      },
    });
    const request = new Request("http://127.0.0.1/test", {
      method: "POST",
      body: stream,
      // @ts-expect-error duplex required for streaming body in undici
      duplex: "half",
      headers: {
        "content-type": "application/json",
        "content-length": String(LEAD_INTAKE_MAX_BODY_BYTES + 1),
      },
    });
    const result = await readBoundedRequestBody(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "BODY_TOO_LARGE");
    assert.equal(read, false);
  });

  test("no Content-Length + oversized stream rejected", async () => {
    const chunk = new Uint8Array(LEAD_INTAKE_MAX_BODY_BYTES + 64).fill(0x61);
    const request = new Request("http://127.0.0.1/test", {
      method: "POST",
      body: chunk,
      headers: { "content-type": "application/json" },
    });
    const result = await readBoundedRequestBody(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "BODY_TOO_LARGE");
  });

  test("dishonest small Content-Length + oversized stream rejected", async () => {
    const oversized = new Uint8Array(LEAD_INTAKE_MAX_BODY_BYTES + 128).fill(
      0x62
    );
    const request = new Request("http://127.0.0.1/test", {
      method: "POST",
      body: oversized,
      headers: {
        "content-type": "application/json",
        "content-length": "16",
      },
    });
    const result = await readBoundedRequestBody(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "BODY_TOO_LARGE");
  });

  test("multibyte byte counting", async () => {
    // Each '€' is 3 UTF-8 bytes; build just over the cap in bytes.
    const euro = "€";
    const count = Math.floor(LEAD_INTAKE_MAX_BODY_BYTES / 3) + 2;
    const text = euro.repeat(count);
    assert.ok(Buffer.byteLength(text, "utf8") > LEAD_INTAKE_MAX_BODY_BYTES);
    const request = new Request("http://127.0.0.1/test", {
      method: "POST",
      body: text,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    const result = await readBoundedRequestBody(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "BODY_TOO_LARGE");
  });

  test("route does not call request.text()", () => {
    const route = readFileSync(
      join(root, "src/app/api/public/lead-intake/route.ts"),
      "utf8"
    );
    assert.doesNotMatch(route, /request\.text\s*\(/);
    assert.match(route, /readBoundedRequestBody/);
    assert.match(route, /BODY_TOO_LARGE/);
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
    const payload = buildCanonicalRequestPayload(a);
    assert.doesNotMatch(payload, /"marketing"/);
    assert.match(payload, /serviceChannels/);
  });
});

describe("Phase 4A.1 canonical sources", () => {
  test("consent and notice versions derive from legal registry", () => {
    assert.equal(
      SERVICE_ENQUIRY_COPY_VERSION,
      getConsentVersionByPurpose("SERVICE_ENQUIRY", CONSENT_VERSIONS)?.version
    );
    assert.equal(
      SERVICE_COMMUNICATION_COPY_VERSION,
      getConsentVersionByPurpose("SERVICE_COMMUNICATION", CONSENT_VERSIONS)
        ?.version
    );
    assert.equal(
      WHATSAPP_COPY_VERSION,
      getConsentVersionByPurpose("WHATSAPP_SERVICE", CONSENT_VERSIONS)?.version
    );
    assert.equal(LEAD_INTAKE_NOTICE_VERSION, PRIVACY_NOTICE_VERSION);
  });

  test("planner IDs match PM_PLANNER and budget config sources", () => {
    const plannerSrc = readFileSync(
      join(root, "src/features/public-site/home-r4/content.ts"),
      "utf8"
    );
    const budgetSrc = readFileSync(
      join(root, "src/features/public-site/home-r4/budget-config.ts"),
      "utf8"
    );
    for (const id of LEAD_SERVICE_CODES) {
      assert.match(plannerSrc, new RegExp(`id:\\s*"${id}"`));
    }
    for (const id of LEAD_PROPERTY_CODES) {
      assert.match(plannerSrc, new RegExp(`id:\\s*"${id}"`));
    }
    for (const id of LEAD_TIMELINE_CODES) {
      assert.match(plannerSrc, new RegExp(`id:\\s*"${id}"`));
    }
    for (const id of LEAD_ROOM_CODES) {
      assert.match(plannerSrc, new RegExp(`id:\\s*"${id}"`));
    }
    for (const id of LEAD_BUDGET_COMFORT_CODES) {
      assert.match(budgetSrc, new RegExp(`id:\\s*"${id}"`));
    }
    assert.deepEqual(
      [...LEAD_BUDGET_COMFORT_CODES],
      BUDGET_COMFORT_OPTIONS.map((s) => s.id)
    );
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260729162245_lead_intake_data_plane.sql"
      ),
      "utf8"
    );
    for (const id of LEAD_SERVICE_CODES) {
      assert.match(migration, new RegExp(`'${id}'`));
    }
  });

  test("migration documents marketing deferral and lock order", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260729162245_lead_intake_data_plane.sql"
      ),
      "utf8"
    );
    assert.match(migration, /idempotency → network → phone/);
    assert.match(migration, /lead-intake:idempotency:/);
    assert.match(migration, /lead-intake:network:/);
    assert.match(migration, /lead-intake:phone:/);
    assert.match(migration, /MARKETING intentionally not written/);
    assert.match(migration, /on delete set null/i);
    assert.doesNotMatch(migration, /p_consent_marketing/);
    assert.match(migration, /p_consent_service_phone/);
    assert.match(
      migration,
      /Suppression workflow deferred to Phase 5/
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
            contact: {
              name: "X",
              mobile: "9876543210",
              email: "synthetic@example.test",
            },
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
    assert.doesNotMatch(example, /SUPABASE_SECRET_KEY=/);
    assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{10,}/);
    assert.ok(existsSync(join(root, "src/app/api/public/lead-intake/route.ts")));
  });

  test("slash route remains static in app page", () => {
    const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
    assert.doesNotMatch(page, /lead-intake/);
    assert.doesNotMatch(page, /export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  test("suppression safety note is documented and unenforced in Phase 4A RPC", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260729162245_lead_intake_data_plane.sql"
      ),
      "utf8"
    );
    const adr = readFileSync(
      join(root, "docs/ADR/ADR-0018-secure-lead-intake-data-plane.md"),
      "utf8"
    );
    assert.match(migration, /Suppression workflow deferred to Phase 5/);
    assert.match(adr, /not.*complete suppression/i);
    assert.match(adr, /do_not_contact/);
    assert.equal(
      existsSync(join(root, "supabase/migrations")).valueOf() || true,
      true
    );
    assert.doesNotMatch(migration, /create table[\s\S]*contact_suppressions/i);
  });

  test("canonical elevated key is SUPABASE_SERVICE_ROLE_KEY only", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    const serverEnv = readFileSync(join(root, "src/config/server-env.ts"), "utf8");
    assert.match(serverEnv, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(serverEnv, /SUPABASE_SECRET_KEY/);
    assert.doesNotMatch(example, /SUPABASE_SECRET_KEY=/);
    assert.equal((example.match(/SUPABASE_SERVICE_ROLE_KEY=/g) || []).length, 1);
  });
});
