/**
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
  getLeadFormMode,
  type LeadFormMode,
} from "../public/lead-form-mode.ts";
import {
  fingerprintLeadPayload,
  getOrCreateKey,
  resetAfterSuccess,
  resetOnPayloadChange,
  shouldReuseOnError,
} from "../public/lead-form-idempotency.ts";
import { submitLeadIntake } from "../public/lead-intake-client.ts";
import { planToLeadRequest } from "../public/plan-to-lead-request.ts";
import {
  getLeadFormStatusMessage,
  validateLeadFormFields,
} from "../public/lead-form-errors.ts";
import { isSafeSameSitePath } from "../same-site-path.ts";

const root = process.cwd();

function samplePlan(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    service: "complete-home-interiors",
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

describe("Phase 4B2 lead form mode", () => {
  test("defaults to copy-only for missing/invalid values", () => {
    assert.equal(getLeadFormMode({}), "copy-only");
    assert.equal(
      getLeadFormMode({ NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE: "" }),
      "copy-only"
    );
    assert.equal(
      getLeadFormMode({ NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE: "enabled" }),
      "copy-only"
    );
  });

  test("accepts copy-only, preview, active", () => {
    for (const mode of ["copy-only", "preview", "active"] as LeadFormMode[]) {
      assert.equal(
        getLeadFormMode({ NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE: mode }),
        mode
      );
    }
  });
});

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

describe("Phase 4B2 plan adapter and form fields", () => {
  test("maps planner + form fields without server-owned fields", () => {
    const result = planToLeadRequest({
      plan: samplePlan(),
      name: "Test Person",
      mobile: "+919876543210",
      email: "synthetic@example.test",
      locality: "Koregaon Park",
      message: "Hello",
      consent: {
        serviceEnquiry: true,
        servicePhone: true,
        serviceEmail: true,
        whatsappService: true,
      },
      attribution: { landingPath: "/" },
      antiBot: { website: "", formStartedAt: "2026-07-30T00:00:00.000Z" },
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.body.consent.serviceChannels.email, true);
    assert.equal(result.body.consent.whatsappService, true);
    assert.equal(result.body.consent.whatsappCopyVersion, WHATSAPP_COPY_VERSION);
    const raw = JSON.stringify(result.body);
    assert.doesNotMatch(raw, /"source"/);
    assert.doesNotMatch(raw, /"actor"/);
    assert.doesNotMatch(raw, /"status"/);
    assert.doesNotMatch(raw, /marketing/i);
  });

  test("rejects email without consent and consent without email", () => {
    const noConsent = planToLeadRequest({
      plan: samplePlan(),
      name: "Test Person",
      mobile: "+919876543210",
      email: "synthetic@example.test",
      consent: { serviceEnquiry: true, servicePhone: true },
      attribution: { landingPath: "/" },
      antiBot: { website: "", formStartedAt: "2026-07-30T00:00:00.000Z" },
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(noConsent.ok, false);

    const noEmail = planToLeadRequest({
      plan: samplePlan(),
      name: "Test Person",
      mobile: "+919876543210",
      consent: {
        serviceEnquiry: true,
        servicePhone: true,
        serviceEmail: true,
      },
      attribution: { landingPath: "/" },
      antiBot: { website: "", formStartedAt: "2026-07-30T00:00:00.000Z" },
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(noEmail.ok, false);
  });

  test("client validation requires consents and forbids marketing fields", () => {
    const errors = validateLeadFormFields({
      name: "A",
      mobile: "",
      email: "x@y.z",
      locality: "",
      message: "",
      serviceEnquiryConsent: false,
      servicePhoneConsent: false,
      serviceEmailConsent: false,
      hasEmail: true,
    });
    assert.ok(errors.length >= 3);

    const capture = readFileSync(
      join(root, "src/features/lead-intake/public/HomeLeadCapture.tsx"),
      "utf8"
    );
    assert.doesNotMatch(capture, /MARKETING/);
    assert.doesNotMatch(capture, /marketingConsent/);
    assert.match(capture, /SERVICE_ENQUIRY|serviceEnquiry|consentServiceEnquiry/);
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
  test("form uses fieldsets, labels, aria and no marketing", () => {
    const capture = readFileSync(
      join(root, "src/features/lead-intake/public/HomeLeadCapture.tsx"),
      "utf8"
    );
    assert.match(capture, /<fieldset/);
    assert.match(capture, /<legend/);
    assert.match(capture, /aria-invalid/);
    assert.match(capture, /aria-busy/);
    assert.match(capture, /aria-live/);
    assert.match(capture, /role="alert"/);
    assert.doesNotMatch(capture, /defaultChecked=\{true\}/);
  });

  test("HomePlan keeps copy-only path without fetch", () => {
    const homePlan = readFileSync(
      join(root, "src/features/public-site/home-r4/HomePlan.tsx"),
      "utf8"
    );
    assert.match(homePlan, /copy-only/);
    assert.doesNotMatch(homePlan, /\/api\/public\/lead-intake/);
    assert.match(homePlan, /HomeLeadCapture/);
  });

  test("env example documents form mode default", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(example, /NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=copy-only/);
  });

  test("same-site attribution hardening shared module", () => {
    assert.equal(isSafeSameSitePath("/portfolio?x=1#y"), true);
    assert.equal(isSafeSameSitePath("/%2f"), false);
  });
});
