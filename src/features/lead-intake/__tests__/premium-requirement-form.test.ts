/**
 * The premium requirement form — configuration, adapter, contract and wiring.
 *
 * WHAT THIS FILE IS GUARDING
 *
 * The form asks two questions the previous contract forbade, so the failure
 * mode to fear is the one this repository has already been bitten by: the
 * TypeScript relaxes, every application test passes, and `submit_lead_intake`
 * refuses every real lead. So the tests below check the JOIN as well as each
 * side — the SQL allowlist, the SQL branch, the TS branch and the adapter all
 * have to agree about what `public-consult-v3` means.
 *
 * The budget ladders are checked verbatim because they are owner-supplied
 * numbers, and one object holding all five is exactly the place where a typo in
 * one ladder hides behind four correct ones.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  BUDGET_RANGES_BY_PROJECT_SCOPE,
  LEAD_BUDGET_RANGE_CODES,
  LEAD_PROJECT_SCOPE_CODES,
  PROJECT_SCOPE_LABELS,
  SERVICE_BY_PROJECT_SCOPE,
  budgetRangeLabel,
  budgetRangesForProjectScope,
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  projectScopeForServiceDeepLink,
  serviceForProjectScope,
  type LeadProjectScopeCode,
} from "../project-scope.ts";
import {
  LEAD_INTAKE_PLANNER_VERSIONS,
  PUBLIC_CONSULT_PLANNER_VERSION,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
} from "../contracts.ts";
import { requirementToLeadRequest } from "../public/requirement-to-lead-request.ts";
import { validateLeadIntakePayload } from "../server/lead-intake-validation.ts";
import {
  SINGLE_CONSENT_CONCISE_COPY,
  getConsentVersionById,
} from "../../legal/consent-registry.ts";

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
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

/** Every file under a directory, as repo-relative paths. */
function walk(rel: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, rel))) {
    const next = `${rel}/${entry}`;
    if (statSync(join(root, next)).isDirectory()) out.push(...walk(next));
    else out.push(next);
  }
  return out;
}

const FORM = "src/features/lead-intake/public/PremiumRequirementForm.tsx";
const CSS = "src/features/lead-intake/public/premium-requirement-form.css";
const CAPTURE = "src/features/public-site/discovery/HomeConsultationCapture.tsx";
const HOME = "src/features/public-site/discovery/DiscoveryHomePage.tsx";
const V4_MIGRATION =
  "supabase/migrations/20260908140000_public_unified_form_v4.sql";
const V3_MIGRATION =
  "supabase/migrations/20260907150000_public_requirement_form_v3.sql";
const V2_MIGRATION =
  "supabase/migrations/20260907130000_public_consultation_single_step_v2.sql";

const BASE = {
  area: "",
  name: "Asha Menon",
  mobile: "9876543210",
  consent: true,
  attribution: { landingPath: "/" },
  antiBot: { website: "", formStartedAt: FORM_STARTED_AT },
  idempotencyKey: "00000000-0000-4000-8000-000000000000",
};

/* ========================================================================== */
/* A. Configuration                                                            */
/* ========================================================================== */

describe("A. the five scopes and their ladders", () => {
  test("exactly five scopes, in order, with the owner's labels", () => {
    assert.deepEqual(
      [...LEAD_PROJECT_SCOPE_CODES],
      ["kitchen", "1-bhk", "2-bhk", "3-bhk", "villa"]
    );
    assert.deepEqual(
      LEAD_PROJECT_SCOPE_CODES.map((s) => PROJECT_SCOPE_LABELS[s]),
      ["Kitchen", "1 BHK", "2 BHK", "3 BHK", "Villa"]
    );
  });

  const EXPECTED: Record<LeadProjectScopeCode, readonly string[]> = {
    kitchen: ["Below ₹1 Lakh", "₹1–2 Lakh", "₹2–3 Lakh", "Above ₹3 Lakh"],
    "1-bhk": ["₹3–5 Lakh", "₹5–7 Lakh", "₹7–10 Lakh", "Above ₹10 Lakh"],
    "2-bhk": ["₹4–8 Lakh", "₹8–12 Lakh", "₹12–16 Lakh", "Above ₹16 Lakh"],
    "3-bhk": ["₹5–9 Lakh", "₹9–13 Lakh", "₹13–16 Lakh", "Above ₹16 Lakh"],
    villa: ["₹5–10 Lakh", "₹10–15 Lakh", "₹15–20 Lakh", "Above ₹20 Lakh"],
  };

  for (const scope of LEAD_PROJECT_SCOPE_CODES) {
    test(`${scope} offers exactly its four bands, in order`, () => {
      assert.deepEqual(
        budgetRangesForProjectScope(scope).map((o) => o.label),
        EXPECTED[scope]
      );
    });
  }

  test("no duplicate budget codes anywhere", () => {
    /*
     * 2 BHK and 3 BHK share the LABEL "Above ₹16 Lakh" with different bands
     * beneath. If they ever shared a CODE, a budget chosen under one scope
     * would survive a switch to the other and look deliberate.
     */
    assert.equal(
      new Set(LEAD_BUDGET_RANGE_CODES).size,
      LEAD_BUDGET_RANGE_CODES.length
    );
    assert.equal(LEAD_BUDGET_RANGE_CODES.length, 20);
  });

  test("before a scope is chosen there is no ladder — which is what disables the field", () => {
    assert.deepEqual(budgetRangesForProjectScope(""), []);
    assert.deepEqual(budgetRangesForProjectScope("4-bhk"), []);
  });

  test("isLeadProjectScopeCode narrows to the five and nothing else", () => {
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      assert.equal(isLeadProjectScopeCode(scope), true);
    }
    for (const nope of ["", "Kitchen", "1bhk", "4-bhk", null, 7]) {
      assert.equal(isLeadProjectScopeCode(nope), false);
    }
  });

  test("scope maps to a real service, and never to custom-wardrobes", () => {
    assert.equal(serviceForProjectScope("kitchen"), "modular-kitchens");
    for (const scope of ["1-bhk", "2-bhk", "3-bhk", "villa"] as const) {
      assert.equal(serviceForProjectScope(scope), "complete-home-interiors");
    }
    assert.equal(
      Object.values(SERVICE_BY_PROJECT_SCOPE).includes(
        "custom-wardrobes" as never
      ),
      false,
      "no scope on this form may claim a service the form does not offer"
    );
    assert.equal(serviceForProjectScope("nonsense"), null);
  });

  test("a budget is valid only for its OWN scope", () => {
    /*
     * The shared primitive both other layers are written against. Every budget
     * must pass for its own scope and fail for all four others — that pairing
     * is the whole reason the codes are namespaced.
     */
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      for (const option of BUDGET_RANGES_BY_PROJECT_SCOPE[scope]) {
        assert.equal(isBudgetRangeForScope(scope, option.code), true);
        for (const other of LEAD_PROJECT_SCOPE_CODES) {
          if (other === scope) continue;
          assert.equal(
            isBudgetRangeForScope(other, option.code),
            false,
            `${option.code} must not survive a switch to ${other}`
          );
        }
      }
    }
    // An empty budget is never "valid": otherwise submit would read a blank as
    // an answered question.
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      assert.equal(isBudgetRangeForScope(scope, ""), false);
    }
  });

  test("a ?service= deep link preselects only where it is unambiguous", () => {
    /*
     * `public-nav.ts` still links each service to /?service=<code>#consultation.
     * Only modular-kitchens names exactly one scope. complete-home-interiors
     * covers four, and custom-wardrobes covers none — preselecting either would
     * answer a question the visitor never did.
     */
    assert.equal(projectScopeForServiceDeepLink("modular-kitchens"), "kitchen");
    assert.equal(projectScopeForServiceDeepLink("complete-home-interiors"), null);
    assert.equal(projectScopeForServiceDeepLink("custom-wardrobes"), null);
    assert.equal(projectScopeForServiceDeepLink(null), null);
    assert.equal(projectScopeForServiceDeepLink("kitchen"), null);
  });

  test("a stored code can be read back as a label, but only with its scope", () => {
    assert.equal(budgetRangeLabel("2-bhk", "2bhk-12-16l"), "₹12–16 Lakh");
    assert.equal(budgetRangeLabel("kitchen", "2bhk-12-16l"), null);
  });
});

/* ========================================================================== */
/* B. UI                                                                       */
/* ========================================================================== */

describe("B. the form's states and structure", () => {
  const source = read(FORM);

  test("the budget field is disabled until a scope supplies a ladder", () => {
    assert.match(source, /const budgetLocked = budgetOptions\.length === 0;/);
    assert.match(source, /disabled=\{budgetLocked\}/);
    assert.match(
      source,
      /\{budgetLocked \? BUDGET_LOCKED_PLACEHOLDER : BUDGET_PLACEHOLDER\}/
    );
  });

  test("changing the scope clears the budget", () => {
    assert.match(source, /const onProjectScopeChange = \(value: string\) => \{/);
    assert.match(
      source,
      /if \(!isBudgetRangeForScope\(value, budgetRange\)\) \{\s*\n\s*setBudgetRange\(""\);/
    );
  });

  test("area is optional; name and mobile are not", () => {
    // The area input carries no aria-invalid and no error branch at all.
    assert.match(source, /\{AREA_OPTIONAL_SUFFIX\}/);
    assert.match(source, /name="locality"/);
    assert.match(source, /aria-invalid=\{errors\.name \? true : undefined\}/);
    assert.match(source, /aria-invalid=\{errors\.mobile \? true : undefined\}/);
    assert.doesNotMatch(source, /errors\.area/);
  });

  test("the mobile field is capped at ten and normalises a pasted +91", () => {
    assert.match(source, /maxLength=\{10\}/);
    assert.match(source, /acceptIndianMobileKeystroke/);
    assert.match(source, /onPaste=/);
    assert.match(source, /acceptIndianMobileInput\(text\)/);
  });

  test("exactly ONE consent checkbox is rendered", () => {
    const checkboxes = source.match(/type="checkbox"/g) ?? [];
    assert.equal(checkboxes.length, 1, "the form shows one consent box");
    assert.match(source, /\{SINGLE_CONSENT_CONCISE_COPY\}/);
    // The three-box wording must not reappear here.
    assert.doesNotMatch(source, /whatsappConsent/);
  });

  test("the CTA blocks a double submit and shows a sending state", () => {
    assert.match(source, /if \(isSubmitting \|\| submittingRef\.current\) return;/);
    assert.match(source, /disabled=\{isSubmitting\}/);
    assert.match(source, /"Sending…" : SUBMIT_LABEL/);
  });

  test("errors are announced, not merely coloured", () => {
    assert.match(source, /role="alert"/);
    assert.match(source, /aria-describedby=/);
    assert.match(source, /aria-live="polite"/);
  });

  test("the honeypot is still present and still hidden", () => {
    assert.match(source, /LEAD_FORM_HONEYPOT_FIELD/);
    assert.match(source, /className="od-req-form__trap"/);
    assert.match(source, /aria-hidden="true"/);
  });

  test("every class the component uses is actually styled", () => {
    /*
     * This exists because it caught a real bug: the honeypot markup was added to
     * the component after the stylesheet was written, so `od-req-form__trap` had
     * no rule and the hidden "Website" field rendered visibly between the
     * consent line and the CTA. A source-text test that only checked the class
     * NAME was present in the JSX would have stayed green.
     */
    const css = read(CSS);
    const used = new Set(source.match(/od-req-form__[a-z-]+/g) ?? []);
    const missing = [...used].filter((cls) => !css.includes(`.${cls}`));
    assert.deepEqual(missing, [], `unstyled classes: ${missing.join(", ")}`);
  });

  test("the honeypot is hidden from view but still fillable by a bot", () => {
    const css = read(CSS);
    const at = css.indexOf(".od-req-form__trap");
    assert.ok(at > 0);
    const rule = css.slice(at, css.indexOf("}", at));
    assert.match(rule, /position:\s*absolute/);
    assert.match(rule, /clip-path:\s*inset\(50%\)/);
    // `display: none` would stop bots filling it, which defeats the trap.
    assert.doesNotMatch(rule, /display:\s*none/);
  });

  test("the CSS carries every state the brief asked for", () => {
    const css = read(CSS);
    for (const hook of [
      'data-state="complete"',
      'data-state="error"',
      ":disabled",
      ":focus-visible",
      "@media (hover: hover)",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      assert.ok(css.includes(hook), `CSS must declare ${hook}`);
    }
    const speed = /--od-req-speed:\s*(\d+)ms/.exec(css);
    assert.ok(speed, "one declared transition speed");
    const ms = Number(speed![1]);
    assert.ok(ms >= 150 && ms <= 250, `${ms}ms is outside 150-250ms`);
    // 16px minimum stops iOS zooming the page on focus.
    assert.match(css, /font-size:\s*max\(0\.98rem,\s*16px\)/);
  });
});

/* ========================================================================== */
/* C. Contract — the adapter and the server agree                              */
/* ========================================================================== */

describe("C. every scope produces an acceptable payload", () => {
  for (const scope of LEAD_PROJECT_SCOPE_CODES) {
    test(`${scope} round-trips through the adapter and the server validator`, () => {
      const budget = BUDGET_RANGES_BY_PROJECT_SCOPE[scope][0]!.code;
      const draft = requirementToLeadRequest({
        ...BASE,
        projectScope: scope,
        budgetRange: budget,
      });
      assert.equal(draft.ok, true, `${scope} must be accepted`);
      if (!draft.ok) return;

      assert.equal(draft.body.plannerVersion, "public-consult-v3");
      assert.equal(draft.body.requirements.projectScope, scope);
      assert.equal(draft.body.requirements.budgetRange, budget);
      assert.equal(
        draft.body.requirements.service,
        SERVICE_BY_PROJECT_SCOPE[scope],
        "the service is derived from the scope, not supplied"
      );

      const validated = validateLeadIntakePayload(draft.body);
      assert.equal(
        validated.ok,
        true,
        `server rejected ${scope}: ${validated.ok ? "" : validated.fields.join(", ")}`
      );
    });
  }

  test("a blank area is accepted and simply omitted", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      projectScope: "2-bhk",
      budgetRange: "2bhk-8-12l",
      area: "   ",
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal("locality" in draft.body.requirements, false);
    assert.equal(validateLeadIntakePayload(draft.body).ok, true);
  });

  test("an area that is supplied is trimmed and carried", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      projectScope: "villa",
      budgetRange: "villa-10-15l",
      area: "  Kharadi  ",
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.body.requirements.locality, "Kharadi");
  });
});

describe("C. forged combinations are refused on both sides", () => {
  test("the adapter refuses a budget from another scope", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      projectScope: "kitchen",
      budgetRange: "villa-above-20l",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.budgetRange"));
  });

  test("the SERVER refuses a cross-scope budget even when the client did not", () => {
    /*
     * The adapter cannot be the guarantee: it runs in the visitor's browser.
     * This is the same body a tampered client would send.
     */
    const body = forgedBody({
      projectScope: "kitchen",
      budgetRange: "villa-above-20l",
      service: "modular-kitchens",
    });
    const result = validateLeadIntakePayload(body);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.budgetRange"));
  });

  test("the server refuses a service that contradicts the scope", () => {
    const body = forgedBody({
      projectScope: "2-bhk",
      budgetRange: "2bhk-4-8l",
      service: "modular-kitchens",
    });
    const result = validateLeadIntakePayload(body);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.service"));
  });

  test("the server refuses an unknown scope", () => {
    const body = forgedBody({
      projectScope: "4-bhk",
      budgetRange: "2bhk-4-8l",
      service: "complete-home-interiors",
    });
    const result = validateLeadIntakePayload(body);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.projectScope"));
  });

  test("scope and budget are refused under v1 and v2, which never asked", () => {
    for (const version of ["public-consult-v1", "public-consult-v2"]) {
      const body = {
        ...forgedBody({
          projectScope: "2-bhk",
          budgetRange: "2bhk-4-8l",
          service: "complete-home-interiors",
        }),
        plannerVersion: version,
      };
      const result = validateLeadIntakePayload(body);
      assert.equal(result.ok, false, `${version} must refuse a scope`);
      if (result.ok) continue;
      assert.ok(
        result.fields.includes("requirements.projectScope"),
        `${version} must name the scope field`
      );
    }
  });

  test("an invalid mobile is refused", () => {
    for (const bad of ["12345", "1234567890", "98765432101", ""]) {
      const draft = requirementToLeadRequest({
        ...BASE,
        mobile: bad,
        projectScope: "1-bhk",
        budgetRange: "1bhk-3-5l",
      });
      assert.equal(draft.ok, false, `${bad} must be refused`);
      if (draft.ok) continue;
      assert.ok(draft.fields.includes("contact.mobile"));
    }
  });

  test("a missing name is refused", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      name: " ",
      projectScope: "1-bhk",
      budgetRange: "1bhk-3-5l",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("contact.name"));
  });

  test("missing consent is refused", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      consent: false,
      projectScope: "1-bhk",
      budgetRange: "1bhk-3-5l",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("consent.serviceEnquiry"));
  });

  test("v3 refuses everything v2 refuses", () => {
    for (const [key, value] of [
      ["qualifier", { kind: "home-size", code: "apartment-2bhk" }],
      ["property", "apartment-2bhk"],
      ["timeline", "immediate"],
      ["rooms", ["living"]],
      ["budgetComfort", "6-12l"],
      ["estimate", { any: "thing" }],
    ] as const) {
      const base = forgedBody({
        projectScope: "2-bhk",
        budgetRange: "2bhk-4-8l",
        service: "complete-home-interiors",
      });
      const body = {
        ...base,
        requirements: { ...base.requirements, [key]: value },
      };
      const result = validateLeadIntakePayload(body);
      assert.equal(result.ok, false, `v3 must refuse ${key}`);
      if (result.ok) continue;
      assert.ok(
        result.fields.some((f) => f.includes(key)),
        `v3 must name ${key}: got ${result.fields.join(", ")}`
      );
    }
  });
});

/* ========================================================================== */
/* D. Consent evidence                                                         */
/* ========================================================================== */

describe("D. one checkbox, two required records, no fabricated optional", () => {
  test("both combined versions exist, are approved and are effective", () => {
    for (const id of [
      SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
      SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
    ]) {
      const version = getConsentVersionById(id);
      assert.equal(version.status, "approved");
      assert.equal(version.required, true);
      assert.equal(version.defaultChecked, false, "never pre-ticked");
      assert.ok(version.ownerApproval, "owner approval is recorded");
      assert.equal(version.retiredAt, null);
    }
  });

  test("both record the sentence the visitor actually reads", () => {
    for (const id of [
      SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
      SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
    ]) {
      assert.equal(
        getConsentVersionById(id).conciseCopy,
        SINGLE_CONSENT_CONCISE_COPY
      );
    }
    assert.match(read(FORM), /SINGLE_CONSENT_CONCISE_COPY/);
  });

  test("the two purposes stay separately auditable", () => {
    assert.equal(
      getConsentVersionById(SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION)
        .purposeCode,
      "SERVICE_ENQUIRY"
    );
    assert.equal(
      getConsentVersionById(SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION)
        .purposeCode,
      "SERVICE_COMMUNICATION"
    );
    assert.notEqual(
      getConsentVersionById(SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION)
        .expandedNotice,
      getConsentVersionById(SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION)
        .expandedNotice
    );
  });

  test("WhatsApp consent is never sent, and is refused if forged", () => {
    const draft = requirementToLeadRequest({
      ...BASE,
      projectScope: "kitchen",
      budgetRange: "kitchen-1-2l",
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(
      "whatsappService" in draft.body.consent,
      false,
      "an optional consent nobody was asked for is ABSENT, not false"
    );

    const base = forgedBody({
      projectScope: "kitchen",
      budgetRange: "kitchen-1-2l",
      service: "modular-kitchens",
    });
    const forged = {
      ...base,
      consent: { ...base.consent, whatsappService: true, whatsappCopyVersion: "whatsapp-service-v1.0" },
    };
    const result = validateLeadIntakePayload(forged);
    assert.equal(result.ok, false, "v3 must refuse a WhatsApp opt-in it never offered");
  });

  test("the two-checkbox copies are refused under v3, and vice versa", () => {
    const base = forgedBody({
      projectScope: "kitchen",
      budgetRange: "kitchen-1-2l",
      service: "modular-kitchens",
    });
    const wrongCopy = {
      ...base,
      consent: {
        ...base.consent,
        serviceEnquiryCopyVersion: "service-enquiry-v1.0",
        serviceCommunicationCopyVersion: "service-communication-v1.0",
      },
    };
    const result = validateLeadIntakePayload(wrongCopy);
    assert.equal(result.ok, false, "evidence must record the wording shown");
    if (result.ok) return;
    assert.ok(result.fields.includes("consent.serviceEnquiryCopyVersion"));
  });
});

/* ========================================================================== */
/* E. The app <-> database join                                                */
/* ========================================================================== */

describe("E. TypeScript and SQL agree about v3", () => {
  const sql = read(V3_MIGRATION);

  test("v3 was ADDED to the version list, and v4 was added after it", () => {
    /*
     * The rule this asserts is "add, never substitute", so the arrival of v4
     * has to leave v3 exactly where it was. What DID move is the pointer:
     * `PUBLIC_CONSULT_PLANNER_VERSION` names whichever version the current
     * public form speaks, and that is now v4. v3 is no longer canonical and is
     * still accepted -- which is the whole difference between adding a version
     * and replacing one.
     */
    assert.deepEqual(
      [...LEAD_INTAKE_PLANNER_VERSIONS],
      [
        "home-r4-v1",
        "public-consult-v1",
        "public-consult-v2",
        "public-consult-v3",
        "public-consult-v4",
      ]
    );
    assert.ok(
      (LEAD_INTAKE_PLANNER_VERSIONS as readonly string[]).includes(
        PUBLIC_CONSULT_V3_PLANNER_VERSION
      ),
      "v3 must stay accepted after v4 arrives"
    );
    assert.equal(PUBLIC_CONSULT_PLANNER_VERSION, PUBLIC_CONSULT_V4_PLANNER_VERSION);
  });

  test("the SQL allowlist is the same list", () => {
    /*
     * `create or replace` means the LAST definition is the one the database
     * runs, so the allowlist TypeScript has to agree with lives in the newest
     * migration, not in v3's. v3's own allowlist is asserted separately below,
     * as history that must not have been edited.
     */
    const match = /p_planner_version not in \(\s*([^)]*)\)/.exec(read(V4_MIGRATION));
    assert.ok(match, "the SQL must carry a planner-version allowlist");
    const listed = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [...LEAD_INTAKE_PLANNER_VERSIONS].sort());
  });

  test("v3's own migration was not edited to make room for v4", () => {
    /*
     * A forward-only migration adds a file; it does not reach back into one
     * that has already run. If v3's allowlist ever grows a fourth public
     * version, someone rewrote applied history.
     */
    const match = /p_planner_version not in \(\s*([^)]*)\)/.exec(sql);
    assert.ok(match);
    const listed = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [
      "home-r4-v1",
      "public-consult-v1",
      "public-consult-v2",
      "public-consult-v3",
    ]);
    assert.doesNotMatch(sql, /public-consult-v4/);
  });

  test("the SQL keeps a branch for every earlier version", () => {
    assert.match(sql, /if p_planner_version = 'home-r4-v1' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v1' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v2' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v3' then/);
    // v1 keeps its meaning: its rows carry a real qualifier.
    assert.match(sql, /raise exception 'validation: qualifier_required'/);
  });

  test("the SQL ladders are the SAME ladders", () => {
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      const codes = BUDGET_RANGES_BY_PROJECT_SCOPE[scope].map((o) => o.code);
      const row = new RegExp(
        `when '${scope}' then array\\[${codes
          .map((c) => `'${c}'`)
          .join(", ")}\\]`
      );
      assert.match(sql, row, `SQL ladder for ${scope} must match the TS one`);
    }
  });

  test("the SQL derives the same service the TypeScript does", () => {
    assert.match(sql, /when 'kitchen' then 'modular-kitchens'/);
    assert.match(sql, /else 'complete-home-interiors'/);
    assert.match(sql, /validation: service_scope_mismatch/);
    assert.match(sql, /validation: budget_range_scope_mismatch/);
  });

  test("scope and budget are refused outside v3 in SQL too", () => {
    assert.match(sql, /validation: scope_not_asked/);
    assert.match(
      sql,
      /p_planner_version <> 'public-consult-v3'\s*\n\s*and \(p_project_scope_code is not null or p_budget_range_code is not null\)/
    );
  });

  test("the migration is forward-only and keeps the definer boundary", () => {
    assert.match(sql, /create or replace function public\.submit_lead_intake\(/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /revoke all on function public\.submit_lead_intake\(/);
    assert.match(sql, /from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.submit_lead_intake\(/);
    // Columns are added, never dropped, and never backfilled with a guess.
    assert.match(sql, /add column if not exists project_scope_code text/);
    assert.match(sql, /add column if not exists budget_range_code text/);
    assert.doesNotMatch(sql, /drop column/i);
    assert.doesNotMatch(sql, /update public\.leads set/i);
  });

  test("the v2 migration is untouched by this change", () => {
    const v2 = read(V2_MIGRATION);
    assert.match(v2, /raise exception 'validation: budget_not_asked'/);
    assert.doesNotMatch(v2, /public-consult-v3/);
  });

  test("the new columns are persisted, not merely accepted", () => {
    assert.match(sql, /\n    project_scope_code,\n    budget_range_code,/);
    assert.match(sql, /\n    p_project_scope_code,\n    p_budget_range_code,/);
  });
});

/* ========================================================================== */
/* F. Wiring                                                                   */
/* ========================================================================== */

describe("F. the real surfaces use the real component", () => {
  test("the homepage mounts the canonical sheet, and no form of its own", () => {
    /*
     * THIS ASSERTION IS INVERTED FROM WHAT IT ONCE SAID, DELIBERATELY.
     *
     * The requirement form was the homepage's inline form and spoke v3. The
     * site now has ONE lead form — the guided sheet, speaking v4 — so the
     * homepage mounts that and embeds nothing. The v3 modules are still here
     * and still tested above, because rows collected under v3 must stay
     * readable; they are simply no longer mounted by a route.
     */
    const home = read(HOME);
    assert.match(home, /<HomePlannerSheet leadFormMode=\{leadFormMode\} \/>/);
    assert.doesNotMatch(home, /HomeConsultationCapture/);
    assert.doesNotMatch(home, /PremiumRequirementForm/);

    // The wrapper survives as the v3 surface; it must not gain a second form.
    const capture = read(CAPTURE);
    assert.match(capture, /PremiumRequirementForm/);
    assert.match(capture, /mode=\{mode\}/);
    assert.doesNotMatch(capture, /<ConsultationLeadForm/);
  });

  test("there is exactly ONE requirement form, and no review-only duplicate", () => {
    /*
     * WHY THIS TEST EXISTS
     *
     * The form was first built behind a localhost-only review route while the
     * design was being approved. That route has been removed: the approved form
     * belongs at the real public location, and a second surface rendering a
     * near-copy is how two implementations start to drift.
     *
     * So: nothing may render `PremiumRequirementForm` except the homepage
     * capture, and the review harness must stay deleted.
     */
    const mounts = walk("src")
      .filter((f) => f.endsWith(".tsx") && !f.includes("__tests__"))
      .filter((f) => !f.endsWith("PremiumRequirementForm.tsx"))
      .filter((f) => /<PremiumRequirementForm/.test(read(f)));
    assert.deepEqual(
      mounts.map((f) => f.replace(/\\/g, "/")),
      [CAPTURE],
      "only the homepage capture may mount the requirement form"
    );

    for (const gone of [
      "src/app/design-review",
      "src/features/lead-intake/public/RequirementFormReview.tsx",
      "src/features/lead-intake/public/requirement-form-review.css",
    ]) {
      assert.equal(
        existsSync(join(root, gone)),
        false,
        `${gone} is review-only scaffolding and must stay removed`
      );
    }
  });

  test("the form submits through the existing intake client", () => {
    const source = read(FORM);
    assert.match(source, /submitLeadIntake/);
    assert.match(source, /requirementToLeadRequest/);
    // The shared protections, not re-implemented ones.
    assert.match(source, /fingerprintLeadPayload/);
    assert.match(source, /collectLeadFormAttribution/);
    assert.match(source, /getOrCreateKey/);
  });

  test("the deep link is hydration-safe", () => {
    /*
     * Reading window.location.search during render would produce "" on the
     * server and a scope on hydration — a first-render mismatch on exactly the
     * URLs the deep link exists for. It is read after mount, inside a frame
     * callback, so the first paint matches the server byte for byte.
     */
    const src = read(FORM);
    const initializer = src.slice(
      src.indexOf("const [projectScope, setProjectScope]"),
      src.indexOf("const [budgetRange, setBudgetRange]")
    );
    assert.doesNotMatch(initializer, /window|URLSearchParams|location/);
    /*
     * A timeout, not a frame callback: rAF is suspended in a backgrounded tab,
     * so an "open in new tab" deep link would not preselect until the visitor
     * switched to it.
     *
     * Comment-stripped, because the component's own docblock EXPLAINS why rAF
     * was rejected — and a check that trips on prose is a check that teaches
     * you to write less of it.
     */
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    assert.match(codeOnly, /useEffect\(\(\) => \{[\s\S]{0,400}window\.setTimeout/);
    assert.doesNotMatch(codeOnly, /requestAnimationFrame/);
    assert.match(src, /URLSearchParams\(window\.location\.search\)\.get\("service"\)/);
    // A deep link must never overwrite a choice already made.
    assert.match(src, /current === "" \? scope : current/);
  });

  test("preview mode validates and never posts", () => {
    const source = read(FORM);
    assert.match(source, /const canNetworkSubmit = mode === "active";/);
    assert.match(source, /if \(!canNetworkSubmit\) \{\s*\n\s*setUxState\("idle"\);\s*\n\s*return;/);
  });

  test("the form is still gated by the fail-closed lead-form mode", () => {
    /*
     * Removing the review route must not remove the production control. The
     * capture renders nothing in `copy-only`, and the form itself only reaches
     * the network in `active` — both decided by
     * NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE, which defaults to copy-only.
     */
    const capture = read(CAPTURE);
    assert.match(capture, /if \(mode === "copy-only"\) \{\s*\n\s*return null;/);
  });
});

/* -------------------------------------------------------------------------- */

/** A v3 body as a tampered client would send it — bypassing the adapter. */
function forgedBody(over: {
  projectScope: string;
  budgetRange: string;
  service: string;
}) {
  return {
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    plannerVersion: "public-consult-v3",
    contact: { name: "Asha Menon", mobile: "9876543210" },
    requirements: {
      service: over.service,
      projectScope: over.projectScope,
      budgetRange: over.budgetRange,
    },
    consent: {
      serviceEnquiry: true as const,
      serviceChannels: { phone: true as const },
      serviceEnquiryCopyVersion: SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion:
        SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
      noticeVersion: read("src/features/legal/privacy-policy-content.ts").match(
        /PRIVACY_NOTICE_VERSION = "([^"]+)"/
      )![1],
    },
    attribution: { landingPath: "/" },
    antiBot: { website: "", formStartedAt: FORM_STARTED_AT },
  };
}
