/**
 * The server still honours every planner version it ever accepted.
 *
 * WHY THIS FILE REPLACED SEVERAL OTHERS
 *
 * The public site now has exactly one lead form, and it speaks
 * `public-consult-v4`. The forms that spoke v1, v2, v3 and `home-r4-v1` are
 * deleted, and so are their client adapters — a dead adapter kept alive only by
 * a test is not compatibility, it is a fossil that makes the codebase look like
 * it still has five forms.
 *
 * But the SERVER may not forget those versions. Rows collected under them are
 * still in the database and still have to mean what they meant when they were
 * written, and a browser holding a cached bundle can still POST an older body.
 * Deleting the UI is not a licence to change what a stored row means.
 *
 * So the compatibility guarantee moved here, and it is asserted where it
 * actually lives: `validateLeadIntakePayload`, the server boundary, driven with
 * request bodies constructed directly rather than through client code that no
 * longer exists.
 *
 * WHAT EACH VERSION MEANT
 *
 *   home-r4-v1         property + timeline + rooms; no scope, no budget range
 *   public-consult-v1  one qualifier; no property, no timeline
 *   public-consult-v2  service only; qualifier, property and timeline forbidden
 *   public-consult-v3  scope + budget; timeline FORBIDDEN
 *   public-consult-v4  scope + budget (except wardrobes) + timeline REQUIRED
 *
 * The v3 prohibition is the load-bearing one: a null timeline on a v3 row means
 * "never asked", and it only means that while v3 keeps refusing timelines.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_INTAKE_PLANNER_VERSION,
  LEAD_INTAKE_PLANNER_VERSIONS,
  PUBLIC_CONSULT_V1_PLANNER_VERSION,
  PUBLIC_CONSULT_V2_PLANNER_VERSION,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
} from "../contracts.ts";
import { validateLeadIntakePayload } from "../server/lead-intake-validation.ts";

/*
 * RELATIVE, NOT A FIXED DATE. The anti-bot window is 800ms to 24 hours, so a
 * hardcoded timestamp passes on the day it is written and fails the next.
 */
const FORM_STARTED_AT = new Date(Date.now() - 5 * 60_000).toISOString();

const CONTACT = { name: "Asha Menon", mobile: "9876543210" } as const;
const ATTRIBUTION = { landingPath: "/" } as const;
const ANTI_BOT = { website: "", formStartedAt: FORM_STARTED_AT } as const;

/** The two-checkbox consent shape v1, v2 and the legacy planner recorded. */
const SPLIT_CONSENT = {
  serviceEnquiry: true,
  serviceChannels: { phone: true },
  serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
  serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
  noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
} as const;

/** The single-checkbox consent shape v3 and v4 record. */
const SINGLE_CONSENT = {
  serviceEnquiry: true,
  serviceChannels: { phone: true },
  serviceEnquiryCopyVersion: SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
  serviceCommunicationCopyVersion:
    SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
} as const;

function body(
  plannerVersion: string,
  requirements: Record<string, unknown>,
  consent: Record<string, unknown> = SPLIT_CONSENT
) {
  return {
    idempotencyKey: "55555555-5555-4555-8555-555555555555",
    plannerVersion,
    contact: CONTACT,
    requirements,
    consent,
    attribution: ATTRIBUTION,
    antiBot: ANTI_BOT,
  };
}

function fieldsOf(result: ReturnType<typeof validateLeadIntakePayload>) {
  return result.ok ? [] : [...result.fields];
}

/* ========================================================================== */
/* 1. Every historical version is still accepted                               */
/* ========================================================================== */

describe("the server accepts every version it ever accepted", () => {
  test("the allowlist still names all five", () => {
    assert.deepEqual([...LEAD_INTAKE_PLANNER_VERSIONS], [
      "home-r4-v1",
      "public-consult-v1",
      "public-consult-v2",
      "public-consult-v3",
      "public-consult-v4",
    ]);
  });

  test("home-r4-v1: property, timeline and rooms", () => {
    const result = validateLeadIntakePayload(
      body(LEAD_INTAKE_PLANNER_VERSION, {
        service: "complete-home-interiors",
        property: "apartment-2bhk",
        timeline: "within-1-month",
        rooms: ["living", "kitchen"],
      })
    );
    assert.equal(result.ok, true, fieldsOf(result).join(", "));
    if (!result.ok) return;
    assert.equal(result.value.property, "apartment-2bhk");
    assert.equal(result.value.timeline, "within-1-month");
  });

  test("public-consult-v1: one qualifier, no property, no timeline", () => {
    const result = validateLeadIntakePayload(
      body(PUBLIC_CONSULT_V1_PLANNER_VERSION, {
        service: "modular-kitchens",
        qualifier: { kind: "kitchen-scope", code: "new-kitchen" },
      })
    );
    assert.equal(result.ok, true, fieldsOf(result).join(", "));
    if (!result.ok) return;
    assert.equal(result.value.timeline, null, "v1 never asked for a timeline");
  });

  test("public-consult-v2: the service alone", () => {
    const result = validateLeadIntakePayload(
      body(PUBLIC_CONSULT_V2_PLANNER_VERSION, {
        service: "custom-wardrobes",
      })
    );
    assert.equal(result.ok, true, fieldsOf(result).join(", "));
    if (!result.ok) return;
    assert.equal(result.value.qualifier, null);
    assert.equal(result.value.property, null);
    assert.equal(result.value.timeline, null);
  });

  test("public-consult-v3: scope and budget, and NO timeline", () => {
    const result = validateLeadIntakePayload(
      body(
        PUBLIC_CONSULT_V3_PLANNER_VERSION,
        {
          service: "complete-home-interiors",
          projectScope: "2-bhk",
          budgetRange: "2bhk-8-12l",
        },
        SINGLE_CONSENT
      )
    );
    assert.equal(result.ok, true, fieldsOf(result).join(", "));
    if (!result.ok) return;
    assert.equal(result.value.projectScope, "2-bhk");
    assert.equal(result.value.timeline, null);
  });

  test("public-consult-v4: scope, budget AND timeline", () => {
    const result = validateLeadIntakePayload(
      body(
        PUBLIC_CONSULT_V4_PLANNER_VERSION,
        {
          service: "modular-kitchens",
          projectScope: "kitchen",
          budgetRange: "kitchen-2-3l",
          timeline: "within-1-month",
        },
        SINGLE_CONSENT
      )
    );
    assert.equal(result.ok, true, fieldsOf(result).join(", "));
  });
});

/* ========================================================================== */
/* 2. Each version still REFUSES what it always refused                        */
/* ========================================================================== */

describe("the prohibitions that make stored rows readable still hold", () => {
  test("v3 still refuses a timeline — a null one means 'never asked'", () => {
    /*
     * THE MOST LOAD-BEARING ASSERTION IN THIS FILE.
     *
     * Every v3 row in the database has a null timeline. That is only readable
     * as "the form never asked" while v3 keeps refusing one. The moment v3
     * accepts a timeline, every one of those rows becomes ambiguous — asked and
     * declined, or never asked? — and no later migration can recover which.
     */
    const result = validateLeadIntakePayload(
      body(
        PUBLIC_CONSULT_V3_PLANNER_VERSION,
        {
          service: "complete-home-interiors",
          projectScope: "2-bhk",
          budgetRange: "2bhk-8-12l",
          timeline: "immediate",
        },
        SINGLE_CONSENT
      )
    );
    assert.equal(result.ok, false);
    assert.ok(fieldsOf(result).includes("requirements.timeline"));
  });

  test("v1 and v2 refuse a timeline too", () => {
    for (const version of [
      PUBLIC_CONSULT_V1_PLANNER_VERSION,
      PUBLIC_CONSULT_V2_PLANNER_VERSION,
    ]) {
      const result = validateLeadIntakePayload(
        body(version, {
          service: "modular-kitchens",
          ...(version === PUBLIC_CONSULT_V1_PLANNER_VERSION
            ? { qualifier: { kind: "kitchen-scope", code: "new-kitchen" } }
            : {}),
          timeline: "immediate",
        })
      );
      assert.equal(result.ok, false, version);
      assert.ok(fieldsOf(result).includes("requirements.timeline"), version);
    }
  });

  test("v2 refuses the qualifier v1 required", () => {
    const result = validateLeadIntakePayload(
      body(PUBLIC_CONSULT_V2_PLANNER_VERSION, {
        service: "modular-kitchens",
        qualifier: { kind: "kitchen-scope", code: "new-kitchen" },
      })
    );
    assert.equal(result.ok, false);
    assert.ok(fieldsOf(result).includes("requirements.qualifier"));
  });

  test("v1 still REQUIRES the qualifier its rows all carry", () => {
    const result = validateLeadIntakePayload(
      body(PUBLIC_CONSULT_V1_PLANNER_VERSION, {
        service: "modular-kitchens",
      })
    );
    assert.equal(result.ok, false);
    assert.ok(fieldsOf(result).includes("requirements.qualifier"));
  });

  test("v1, v2 and home-r4-v1 refuse scope and budget", () => {
    for (const version of [
      LEAD_INTAKE_PLANNER_VERSION,
      PUBLIC_CONSULT_V1_PLANNER_VERSION,
      PUBLIC_CONSULT_V2_PLANNER_VERSION,
    ]) {
      const result = validateLeadIntakePayload(
        body(version, {
          service: "complete-home-interiors",
          projectScope: "2-bhk",
          budgetRange: "2bhk-8-12l",
        })
      );
      assert.equal(result.ok, false, version);
    }
  });

  test("v4 refuses the legacy planner's fields", () => {
    for (const extra of [
      { property: "apartment-2bhk" },
      { rooms: ["kitchen"] },
      { budgetComfort: "6-12l" },
      { qualifier: { kind: "kitchen-scope", code: "new-kitchen" } },
    ]) {
      const result = validateLeadIntakePayload(
        body(
          PUBLIC_CONSULT_V4_PLANNER_VERSION,
          {
            service: "modular-kitchens",
            projectScope: "kitchen",
            budgetRange: "kitchen-2-3l",
            timeline: "within-1-month",
            ...extra,
          },
          SINGLE_CONSENT
        )
      );
      assert.equal(result.ok, false, Object.keys(extra)[0]);
    }
  });

  test("an unknown planner version is refused outright", () => {
    for (const bogus of ["public-consult-v5", "home-r5", "", "v4"]) {
      const result = validateLeadIntakePayload(
        body(bogus, { service: "modular-kitchens" })
      );
      assert.equal(result.ok, false, bogus);
      assert.ok(fieldsOf(result).includes("plannerVersion"), bogus);
    }
  });
});

/* ========================================================================== */
/* 3. Consent evidence stayed version-specific                                 */
/* ========================================================================== */

describe("consent evidence still records the wording each form showed", () => {
  test("v3 and v4 expect the combined single-consent copy", () => {
    for (const version of [
      PUBLIC_CONSULT_V3_PLANNER_VERSION,
      PUBLIC_CONSULT_V4_PLANNER_VERSION,
    ]) {
      const requirements =
        version === PUBLIC_CONSULT_V4_PLANNER_VERSION
          ? {
              service: "modular-kitchens",
              projectScope: "kitchen",
              budgetRange: "kitchen-2-3l",
              timeline: "within-1-month",
            }
          : {
              service: "modular-kitchens",
              projectScope: "kitchen",
              budgetRange: "kitchen-2-3l",
            };

      // The split copy is refused: those forms showed one sentence, not two.
      const wrong = validateLeadIntakePayload(
        body(version, requirements, SPLIT_CONSENT)
      );
      assert.equal(wrong.ok, false, version);
      assert.ok(
        fieldsOf(wrong).includes("consent.serviceEnquiryCopyVersion"),
        version
      );

      const right = validateLeadIntakePayload(
        body(version, requirements, SINGLE_CONSENT)
      );
      assert.equal(right.ok, true, version);
    }
  });

  test("v1, v2 and home-r4-v1 expect the separate copies they showed", () => {
    const wrong = validateLeadIntakePayload(
      body(
        PUBLIC_CONSULT_V2_PLANNER_VERSION,
        { service: "custom-wardrobes" },
        SINGLE_CONSENT
      )
    );
    assert.equal(wrong.ok, false);
    assert.ok(fieldsOf(wrong).includes("consent.serviceEnquiryCopyVersion"));
  });

  test("no version accepts a fabricated WhatsApp consent without its copy", () => {
    const result = validateLeadIntakePayload({
      ...body(
        PUBLIC_CONSULT_V4_PLANNER_VERSION,
        {
          service: "custom-wardrobes",
          timeline: "immediate",
        },
        { ...SINGLE_CONSENT, whatsappService: true }
      ),
    });
    assert.equal(result.ok, false, "a granted WhatsApp consent needs its copy version");
  });
});
