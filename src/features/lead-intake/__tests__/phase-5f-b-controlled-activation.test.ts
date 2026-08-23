/**
 * Phase 5F-B — controlled public lead activation hardening tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { getLeadFormMode } from "../public/lead-form-mode.ts";
import {
  getLeadIntakeMode,
  getLeadIntakeServerEnv,
} from "../../../config/server-env.ts";
import {
  handleLeadIntakeRequest,
  isLocalTestHost,
  parseLocalTestHostname,
} from "../server/lead-intake-runtime.ts";
import { LeadIntakeError } from "../server/lead-intake-errors.ts";
import {
  LEAD_INTAKE_MAX_BODY_BYTES,
  parseJsonBody,
  validateLeadIntakePayload,
} from "../server/lead-intake-validation.ts";
import { isLeadTransitionAllowed } from "../../crm/contracts/lead-stages.ts";

const root = process.cwd();
const secret = "phase5f-local-test-hash-secret-32chars-min";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    plannerVersion: "home-r4-v1",
    contact: {
      name: "Synthetic Person",
      mobile: "+919876543210",
    },
    requirements: {
      service: "complete-home-interiors",
      property: "apartment-2bhk",
      timeline: "within-3-months",
      rooms: ["living"],
    },
    consent: {
      serviceEnquiry: true,
      serviceChannels: { phone: true },
      serviceEnquiryCopyVersion: "service-enquiry-v0.1-draft",
      serviceCommunicationCopyVersion: "service-communication-v0.1-draft",
      noticeVersion: "privacy-notice-v0.1-draft",
    },
    landingPath: "/",
    attribution: {},
    honeypot: "",
    submittedAtMs: Date.now(),
    ...overrides,
  };
}

function localTestEnv() {
  return getLeadIntakeServerEnv({
    NODE_ENV: "development",
    ONEDECORE_LEAD_INTAKE_MODE: "local-test",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
    ONEDECORE_LEAD_HASH_SECRET: secret,
  });
}

describe("Phase 5F-B browser and server gates", () => {
  test("browser default copy-only", () => {
    assert.equal(getLeadFormMode({}), "copy-only");
  });

  test("invalid browser mode fails closed to copy-only", () => {
    assert.equal(
      getLeadFormMode({ NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE: "bogus" }),
      "copy-only"
    );
  });

  test("server default disabled", () => {
    assert.equal(getLeadIntakeMode({}), "disabled");
  });

  test("invalid server env fails closed to disabled", () => {
    assert.equal(
      getLeadIntakeMode({ ONEDECORE_LEAD_INTAKE_MODE: "bogus" }),
      "disabled"
    );
  });

  test("server disabled returns 503 before DB call", async () => {
    let adminCalled = false;
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
        createAdminClient: () => {
          adminCalled = true;
          throw new Error("admin client should not be created");
        },
      }
    );
    assert.equal(result.httpStatus, 503);
    assert.equal(result.body.code, "LEAD_INTAKE_DISABLED");
    assert.equal(adminCalled, false);
  });

  test("active client cannot bypass disabled server", async () => {
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

  test("local-test prohibited in production", async () => {
    const result = await handleLeadIntakeRequest(
      {
        method: "POST",
        contentType: "application/json",
        origin: "http://localhost:3100",
        host: "localhost:3100",
        rawBody: JSON.stringify(basePayload()),
        remoteAddress: "127.0.0.1",
        forwardedFor: null,
        nodeEnv: "production",
      },
      {
        getEnv: () =>
          getLeadIntakeServerEnv({
            NODE_ENV: "production",
            ONEDECORE_LEAD_INTAKE_MODE: "local-test",
            NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
            ONEDECORE_LEAD_HASH_SECRET: secret,
          }),
      }
    );
    assert.equal(result.httpStatus, 503);
    assert.equal(result.body.code, "LEAD_INTAKE_DISABLED");
  });
});

describe("Phase 5F-B loopback host hardening", () => {
  const accepted: Array<[string, string]> = [
    ["localhost", "localhost"],
    ["localhost:3100", "localhost"],
    ["127.0.0.1", "127.0.0.1"],
    ["127.0.0.1:3100", "127.0.0.1"],
    ["[::1]", "::1"],
    ["[::1]:3100", "::1"],
    ["::1", "::1"],
  ];

  for (const [host, expectedHostname] of accepted) {
    test(`accepts ${host}`, () => {
      assert.equal(parseLocalTestHostname(host), expectedHostname);
      assert.equal(isLocalTestHost(host), true);
    });
  }

  const rejected = [
    "0.0.0.0",
    "192.168.1.1",
    "10.0.0.1",
    "onedecore.in",
    "www.onedecore.in",
    "localhost.attacker.com",
    "evil.onedecore.in",
  ];

  for (const host of rejected) {
    test(`rejects ${host}`, () => {
      assert.equal(isLocalTestHost(host), false);
    });
  }

  test("external host rejected at runtime", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest(
          {
            method: "POST",
            contentType: "application/json",
            origin: "https://onedecore.in",
            host: "onedecore.in",
            rawBody: JSON.stringify(basePayload()),
            remoteAddress: "1.2.3.4",
            forwardedFor: null,
            nodeEnv: "development",
          },
          { getEnv: () => localTestEnv() }
        ),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.code === "LOCAL_TEST_HOST_REQUIRED"
    );
  });

  test("spoofed forwarded header cannot create loopback authority", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest(
          {
            method: "POST",
            contentType: "application/json",
            origin: "https://onedecore.in",
            host: "onedecore.in",
            rawBody: JSON.stringify(basePayload()),
            remoteAddress: "1.2.3.4",
            forwardedFor: "127.0.0.1",
            nodeEnv: "development",
          },
          { getEnv: () => localTestEnv() }
        ),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.code === "LOCAL_TEST_HOST_REQUIRED"
    );
  });

  test("[::1] host accepted at runtime boundary", async () => {
    const result = await handleLeadIntakeRequest(
      {
        method: "POST",
        contentType: "application/json",
        origin: "http://[::1]:3100",
        host: "[::1]:3100",
        rawBody: JSON.stringify(
          basePayload({
            contact: { name: "X", mobile: "9876543210" },
          })
        ),
        remoteAddress: "::1",
        forwardedFor: null,
        nodeEnv: "development",
      },
      { getEnv: () => localTestEnv() }
    );
    assert.equal(result.httpStatus, 400);
    assert.equal(result.body.code, "VALIDATION_REJECTED");
  });
});

describe("Phase 5F-B input and error contract regression", () => {
  test("32 KiB body cap unchanged", () => {
    assert.equal(LEAD_INTAKE_MAX_BODY_BYTES, 32 * 1024);
    const parsed = parseJsonBody(`{"a":${JSON.stringify("x".repeat(33 * 1024))}}`);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "BODY_TOO_LARGE");
    }
  });

  test("JSON-only validation unchanged", async () => {
    await assert.rejects(
      () =>
        handleLeadIntakeRequest(
          {
            method: "POST",
            contentType: "text/plain",
            origin: "http://localhost:3100",
            host: "localhost:3100",
            rawBody: "not-json",
            remoteAddress: "127.0.0.1",
            forwardedFor: null,
            nodeEnv: "development",
          },
          { getEnv: () => localTestEnv() }
        ),
      (err: unknown) =>
        err instanceof LeadIntakeError && err.httpStatus === 415
    );
  });

  test("unknown field rejection unchanged", () => {
    const validated = validateLeadIntakePayload({
      ...basePayload(),
      unexpectedField: true,
    });
    assert.equal(validated.ok, false);
  });

  test("stable error normalization on disabled path", async () => {
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
    assert.equal(result.body.code, "LEAD_INTAKE_DISABLED");
    assert.doesNotMatch(JSON.stringify(result.body), /supabase|postgres|sql/i);
  });
});

describe("Phase 5F-B security and regression boundaries", () => {
  test("no browser secret in public lead-intake modules", () => {
    const files = [
      "src/features/lead-intake/public/lead-intake-client.ts",
      "src/features/lead-intake/public/HomeLeadCapture.tsx",
      "src/app/api/public/lead-intake/route.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE/);
      assert.doesNotMatch(src, /ONEDECORE_LEAD_HASH_SECRET/);
    }
  });

  test("M17 migration hardens identity without widening RPC grants", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260804140000_controlled_public_lead_activation_hardening.sql"
      ),
      "utf8"
    );
    assert.match(migration, /resolve_lead_intake_contact_by_phone/);
    assert.match(migration, /status in \('active', 'suppressed'\)/);
    assert.match(migration, /contact_identity_conflict/);
    assert.match(migration, /MARKETING intentionally not written/);
    assert.doesNotMatch(migration, /grant execute on function private\.resolve_lead_intake_contact_by_phone/);
  });

  test("source attribution remains server-controlled", () => {
    const service = readFileSync(
      join(root, "src/features/lead-intake/server/lead-intake-service.ts"),
      "utf8"
    );
    assert.match(service, /website-planner/);
    assert.doesNotMatch(service, /payload\.source/);
  });

  test("Closed-Won regression remains blocked", () => {
    assert.equal(isLeadTransitionAllowed("contacted", "closed_won"), false);
    assert.equal(isLeadTransitionAllowed("negotiation", "closed_won"), false);
  });

  test("no Phase 9 Landing Page Lab coupling", () => {
    const homePlan = readFileSync(
      join(root, "src/features/public-site/home-r4/HomePlan.tsx"),
      "utf8"
    );
    assert.doesNotMatch(homePlan, /landing-page-lab/i);
    assert.doesNotMatch(homePlan, /phase-9/i);
  });

  test("public form remains copy-only by default in page wiring", () => {
    const page = readFileSync(join(root, "src/app/interiors/page.tsx"), "utf8");
    assert.match(page, /getLeadFormMode/);
    const homePlan = readFileSync(
      join(root, "src/features/public-site/home-r4/HomePlan.tsx"),
      "utf8"
    );
    assert.match(homePlan, /copy-only/);
    assert.match(homePlan, /Nothing is submitted|copy-only/i);
  });
});
