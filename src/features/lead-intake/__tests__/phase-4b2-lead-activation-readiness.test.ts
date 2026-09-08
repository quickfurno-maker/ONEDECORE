/**
 * TRIMMED WHEN THE SITE CONSOLIDATED ON ONE FORM.
 *
 * The blocks that certified the deleted legacy planner form, its adapter and
 * the build-time `LEAD_FORM_MODE` gate are gone with the code they described —
 * a test that keeps dead UI alive is not coverage, it is an anchor. What
 * remains is what still governs the canonical v4 path: consent version
 * contracts, idempotency, API client outcome mapping and attribution
 * hardening.
 *
 * Phase 4B2 — public lead form gates, consent selector, adapter, idempotency, client.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CONSENT_VERSIONS,
  CURRENT_CONSENT_VERSION_IDS,
  getCurrentConsentVersionByPurpose,
  type ConsentPurposeCode,
} from "../../legal/consent-registry.ts";
import type { PlanSnapshot } from "../../public-site/home-r4/plan-state.ts";
import {
  LEAD_INTAKE_NOTICE_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
  type LeadIntakeRequestBody,
} from "../contracts.ts";
import {
  fingerprintLeadPayload,
  getOrCreateKey,
  resetAfterSuccess,
  resetOnPayloadChange,
  shouldReuseOnError,
} from "../public/lead-form-idempotency.ts";
import { submitLeadIntake } from "../public/lead-intake-client.ts";
import {
  getLeadFormStatusMessage,
  mapClientResultToUxState,
} from "../public/lead-form-errors.ts";
import { isSafeSameSitePath } from "../same-site-path.ts";

/*
 * RELATIVE, NOT A FIXED DATE.
 *
 * `antiBot.formStartedAt` must be between 800ms and 24 hours old, so a
 * hardcoded timestamp is a time bomb: these fixtures passed on the day they
 * were written and started failing the moment the date rolled over. Five
 * minutes ago is inside the window on every day.
 */
const FORM_STARTED_AT = new Date(Date.now() - 5 * 60_000).toISOString();


const root = process.cwd();

function samplePlan(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    service: "complete-home-interiors",
    projectScope: null,
    budgetRange: null,
    property: "apartment-2bhk",
    timeline: "within-1-month",
    rooms: ["living", "kitchen"],
    budgetComfort: "6-12l",
    estimateSummary: null,
    name: "",
    mobile: "",
    locality: "Koregaon Park",
    message: "Synthetic brief",
    whatsappConsent: false,
    privacyConsent: false,
    ...overrides,
  };
}

function sampleBody(
  overrides: Partial<LeadIntakeRequestBody> = {}
): LeadIntakeRequestBody {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    plannerVersion: "home-r4-v1",
    contact: { name: "Test Person", mobile: "+919876543210" },
    requirements: {
      service: "complete-home-interiors",
      property: "apartment-2bhk",
      timeline: "within-1-month",
      rooms: ["living"],
    },
    consent: {
      serviceEnquiry: true,
      serviceChannels: { phone: true },
      serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
      noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    },
    attribution: { landingPath: "/" },
    antiBot: { website: "", formStartedAt: new Date().toISOString() },
    ...overrides,
  };
}


describe("Phase 4B2 current consent version contract", () => {
  test("maps exactly one current version id per purpose", () => {
    const purposes = Object.keys(
      CURRENT_CONSENT_VERSION_IDS
    ) as ConsentPurposeCode[];
    assert.equal(purposes.length, 6);
    const ids = Object.values(CURRENT_CONSENT_VERSION_IDS);
    assert.equal(new Set(ids).size, ids.length);
    for (const purpose of purposes) {
      const version = getCurrentConsentVersionByPurpose(purpose);
      assert.equal(version.purposeCode, purpose);
      assert.equal(version.version, CURRENT_CONSENT_VERSION_IDS[purpose]);
      assert.ok(
        version.status === "draft-review" || version.status === "approved",
        `${purpose} status must be draft-review or approved`
      );
      if (version.status === "approved") {
        assert.equal(version.effectiveFrom, "2026-08-25");
      }
    }
  });

  test("fails on missing mapping, wrong purpose, duplicate id, missing version", () => {
    assert.throws(() =>
      getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY", CONSENT_VERSIONS, {
        ...CURRENT_CONSENT_VERSION_IDS,
        SERVICE_ENQUIRY: "",
      })
    );
    assert.throws(() =>
      getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY", CONSENT_VERSIONS, {
        ...CURRENT_CONSENT_VERSION_IDS,
        SERVICE_ENQUIRY: "marketing-v0.1-draft",
      })
    );
    assert.throws(() =>
      getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY", CONSENT_VERSIONS, {
        ...CURRENT_CONSENT_VERSION_IDS,
        SERVICE_ENQUIRY: "missing-version-id",
      })
    );
    assert.throws(() =>
      getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY", CONSENT_VERSIONS, {
        ...CURRENT_CONSENT_VERSION_IDS,
        MARKETING: CURRENT_CONSENT_VERSION_IDS.SERVICE_ENQUIRY,
      })
    );
  });

  test("lead contracts use explicit current versions", () => {
    assert.equal(
      SERVICE_ENQUIRY_COPY_VERSION,
      CURRENT_CONSENT_VERSION_IDS.SERVICE_ENQUIRY
    );
    assert.equal(
      SERVICE_COMMUNICATION_COPY_VERSION,
      CURRENT_CONSENT_VERSION_IDS.SERVICE_COMMUNICATION
    );
    assert.equal(
      WHATSAPP_COPY_VERSION,
      CURRENT_CONSENT_VERSION_IDS.WHATSAPP_SERVICE
    );
  });
});


describe("Phase 4B2 idempotency session", () => {
  test("reuses key for identical payload; resets on change, success, conflict", () => {
    resetAfterSuccess();
    const bodyA = sampleBody({ contact: { name: "A", mobile: "+919876543210" } });
    const fpA = fingerprintLeadPayload(bodyA);
    const key1 = getOrCreateKey(fpA);
    const key2 = getOrCreateKey(fpA);
    assert.equal(key1, key2);
    assert.equal(shouldReuseOnError(500), true);
    assert.equal(shouldReuseOnError(503), true);
    assert.equal(shouldReuseOnError(429), true);
    assert.equal(shouldReuseOnError(null), true);
    assert.equal(shouldReuseOnError(409), false);

    const bodyB = sampleBody({ contact: { name: "B", mobile: "+919876543210" } });
    const fpB = fingerprintLeadPayload(bodyB);
    resetOnPayloadChange(fpB);
    const key3 = getOrCreateKey(fpB);
    assert.notEqual(key3, key1);

    resetAfterSuccess();
    const key4 = getOrCreateKey(fpB);
    assert.notEqual(key4, key3);
  });
});

describe("Phase 4B2 API client outcomes", () => {
  test("maps created, duplicate, disabled, validation, conflict, 429", async () => {
    const cases: Array<{
      status: number;
      body: Record<string, unknown>;
      kind: string;
      headers?: Record<string, string>;
    }> = [
      {
        status: 201,
        body: { ok: true, submissionReference: "REF-1" },
        kind: "success-created",
      },
      {
        status: 200,
        body: { ok: true, duplicate: true, submissionReference: "REF-1" },
        kind: "success-duplicate",
      },
      {
        status: 400,
        body: { ok: false, fields: ["contact.name"] },
        kind: "validation-error",
      },
      { status: 409, body: { ok: false, code: "IDEMPOTENCY_CONFLICT" }, kind: "conflict" },
      {
        status: 429,
        body: { ok: false },
        kind: "rate-limited",
        headers: { "Retry-After": "60" },
      },
      {
        status: 503,
        body: { ok: false, code: "LEAD_INTAKE_DISABLED" },
        kind: "disabled",
      },
      { status: 500, body: { ok: false }, kind: "unavailable" },
    ];

    for (const entry of cases) {
      const result = await submitLeadIntake(sampleBody(), {
        fetchImpl: async () =>
          new Response(JSON.stringify(entry.body), {
            status: entry.status,
            headers: {
              "content-type": "application/json",
              ...(entry.headers ?? {}),
            },
          }),
      });
      assert.equal(result.kind, entry.kind, String(entry.status));
    }
  });

  test("truthful success and disabled copy", () => {
    const created = getLeadFormStatusMessage("success-created", {
      submissionReference: "OD-TEST-1",
    });
    assert.equal(created?.title, "Your enquiry has been received.");
    assert.match(created?.body ?? "", /OD-TEST-1/);
    assert.doesNotMatch(created?.title ?? "", /appointment|WhatsApp sent|guaranteed/i);

    const disabled = getLeadFormStatusMessage("disabled");
    assert.equal(
      disabled?.title,
      "Online enquiry submission is not available."
    );
  });
});

describe("Phase 4B2 accessibility and copy-only regression", () => {



  test("same-site attribution hardening shared module", () => {
    assert.equal(isSafeSameSitePath("/portfolio?x=1#y"), true);
    assert.equal(isSafeSameSitePath("/%2f"), false);
  });
});
