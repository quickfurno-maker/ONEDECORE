/**
 * The unified public lead form — `public-consult-v4`, end to end in-process.
 *
 * WHAT THIS SUITE IS FOR
 *
 * The site has one lead form now. Its answers cross three boundaries before
 * they become a row: the adapter turns them into a request body, the server
 * validator decides whether that body is acceptable, and the SQL decides again
 * because it is `SECURITY DEFINER` and cannot trust either. This suite drives
 * the first two directly and asserts the third by reading its migration, so a
 * disagreement between the three shows up here rather than as an RPC failure on
 * a real enquiry.
 *
 * The failure it exists to prevent has happened before: TypeScript was relaxed
 * without the SQL, every application test stayed green, every database test
 * stayed green, and every real lead was refused. Neither suite could see the
 * seam. This one is the seam.
 *
 * THE WARDROBE EXCEPTION IS TESTED FROM BOTH SIDES
 *
 * `custom-wardrobes` has no project-scope list and no owner-approved budget
 * ladder, so the form asks for neither. Absence is therefore REQUIRED for that
 * service and presence is REQUIRED for the other two — and both directions are
 * asserted, because a rule enforced in only one direction lets a stale client
 * smuggle an invented scope onto a wardrobe enquiry.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEAD_TIMELINE_CODES,
  PUBLIC_CONSULT_PLANNER_VERSION,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  V4_SCOPED_SERVICES,
  v4RequiresScope,
} from "../contracts.ts";
import {
  BUDGET_RANGES_BY_PROJECT_SCOPE,
  LEAD_PROJECT_SCOPE_CODES,
  SERVICE_BY_PROJECT_SCOPE,
  SUBMIT_LABEL,
} from "../project-scope.ts";
import { unifiedLeadToRequest } from "../public/unified-lead-request.ts";
import { validateLeadIntakePayload } from "../server/lead-intake-validation.ts";
import {
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
} from "../contracts.ts";
import {
  getNextIncompleteStep,
  homeStepComplete,
  type PlanSnapshot,
} from "../../public-site/home-r4/plan-state.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const V4_MIGRATION =
  "supabase/migrations/20260908140000_public_unified_form_v4.sql";
const BRIEF = "src/features/lead-intake/public/UnifiedLeadBrief.tsx";
const PLANNER = "src/features/public-site/home-r4/HomePlanner.tsx";
const CTA = "src/features/public-site/discovery/DiscoveryConsultCta.tsx";
const ADAPTER = "src/features/lead-intake/public/unified-lead-request.ts";

/*
 * RELATIVE, NOT A FIXED DATE. The anti-bot window is 800ms to 24 hours, so a
 * hardcoded timestamp is a time bomb that passes on the day it is written and
 * fails the next morning.
 */
const FORM_STARTED_AT = new Date(Date.now() - 5 * 60_000).toISOString();

const BASE = {
  area: "",
  message: "",
  name: "Asha Menon",
  mobile: "9876543210",
  consent: true,
  attribution: { landingPath: "/" },
  antiBot: { website: "", formStartedAt: FORM_STARTED_AT },
  idempotencyKey: "44444444-4444-4444-8444-444444444444",
} as const;

const KITCHEN = {
  ...BASE,
  service: "modular-kitchens",
  projectScope: "kitchen",
  budgetRange: "kitchen-2-3l",
  timeline: "within-1-month",
} as const;

const WARDROBE = {
  ...BASE,
  service: "custom-wardrobes",
  projectScope: null,
  budgetRange: null,
  timeline: "immediate",
} as const;

/** The server validator's answer for a body the adapter produced. */
function throughServer(input: Parameters<typeof unifiedLeadToRequest>[0]) {
  const draft = unifiedLeadToRequest(input);
  assert.equal(draft.ok, true, "the adapter must accept this input");
  if (!draft.ok) throw new Error("unreachable");
  return { body: draft.body, result: validateLeadIntakePayload(draft.body) };
}

/* ========================================================================== */
/* 1. The adapter emits v4, and v4 is what the site now speaks                 */
/* ========================================================================== */

describe("the unified form speaks public-consult-v4", () => {
  test("the adapter stamps v4, and v4 is the canonical public version", () => {
    const draft = unifiedLeadToRequest(KITCHEN);
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.body.plannerVersion, "public-consult-v4");
    assert.equal(PUBLIC_CONSULT_PLANNER_VERSION, PUBLIC_CONSULT_V4_PLANNER_VERSION);
    // v3 is still a real version; it is simply not the current one.
    assert.notEqual(
      PUBLIC_CONSULT_V3_PLANNER_VERSION,
      PUBLIC_CONSULT_V4_PLANNER_VERSION
    );
  });

  test("the server accepts what the adapter produces", () => {
    const { result } = throughServer(KITCHEN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    /*
     * The validated value is FLAT — it is the argument list the RPC takes, not
     * the nested request body. Asserting against it here is deliberate: this is
     * the shape that actually reaches `submit_lead_intake`.
     */
    assert.equal(result.value.plannerVersion, "public-consult-v4");
    assert.equal(result.value.service, "modular-kitchens");
    assert.equal(result.value.projectScope, "kitchen");
    assert.equal(result.value.budgetRange, "kitchen-2-3l");
    assert.equal(result.value.timeline, "within-1-month");
    // The fields v4 does not ask for arrive as null, never as a guess.
    assert.equal(result.value.property, null);
    assert.equal(result.value.qualifier, null);
    assert.equal(result.value.budgetComfort, null);
    assert.equal(result.value.estimateSnapshot, null);
    assert.deepEqual([...result.value.rooms], []);
  });

  test("the SQL that runs is the one that knows about v4", () => {
    /*
     * `create or replace` means the newest definition wins, so the file the
     * database is actually running has to carry the branch. Read as text on
     * purpose: importing it would defeat the point of comparing two independent
     * definitions.
     */
    const sql = read(V4_MIGRATION);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v4' then/);
    assert.match(sql, /'public-consult-v4'/);
    // And no signature change, so no drop/recreate of a privileged function.
    assert.doesNotMatch(sql.toLowerCase(), /drop function/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
  });
});

/* ========================================================================== */
/* 2. The timeline — the field that MOVES between versions                     */
/* ========================================================================== */

describe("v4 asks for a timeline, and takes it from the approved vocabulary", () => {
  test("every code the planner offers is accepted", () => {
    for (const timeline of LEAD_TIMELINE_CODES) {
      const { result } = throughServer({ ...KITCHEN, timeline });
      assert.equal(result.ok, true, timeline);
      if (!result.ok) continue;
      assert.equal(result.value.timeline, timeline);
    }
  });

  test("a missing timeline is refused rather than defaulted", () => {
    const draft = unifiedLeadToRequest({ ...KITCHEN, timeline: null });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.timeline"));
  });

  test("free text is refused — this is an enum, not a note", () => {
    for (const bogus of ["asap", "Within 1 month", "next-year", ""]) {
      const draft = unifiedLeadToRequest({ ...KITCHEN, timeline: bogus });
      assert.equal(draft.ok, false, bogus);
      if (draft.ok) continue;
      assert.ok(draft.fields.includes("requirements.timeline"), bogus);
    }
  });

  test("v3's prohibition is untouched — its rows still mean what they meant", () => {
    /*
     * A null timeline on a v3 row means "never asked". If v3 ever started
     * accepting one, that reading would be gone from every row already stored,
     * which is the entire reason v4 was added beside it rather than v3 being
     * relaxed.
     */
    const { body } = throughServer(KITCHEN);
    const asV3 = {
      ...body,
      plannerVersion: PUBLIC_CONSULT_V3_PLANNER_VERSION,
    };
    const result = validateLeadIntakePayload(asV3);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.timeline"));

    const sql = read(V4_MIGRATION);
    assert.match(sql, /raise exception 'validation: timeline_not_asked'/);
    assert.match(sql, /raise exception 'validation: timeline_required'/);
  });
});

/* ========================================================================== */
/* 3. Scope and budget: derived, paired, and never invented                    */
/* ========================================================================== */

describe("the scope, the service and the budget ladder must agree", () => {
  test("every scope's own ladder is accepted end to end", () => {
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      const service = SERVICE_BY_PROJECT_SCOPE[scope];
      for (const option of BUDGET_RANGES_BY_PROJECT_SCOPE[scope]) {
        const { result } = throughServer({
          ...BASE,
          service,
          projectScope: scope,
          budgetRange: option.code,
          timeline: "within-2-months",
        });
        assert.equal(result.ok, true, `${scope}/${option.code}`);
      }
    }
  });

  test("a budget from ANOTHER scope's ladder is refused", () => {
    /*
     * The 2 BHK and 3 BHK ladders both end in the label "Above ₹16 Lakh". Only
     * the pairing tells them apart, and only the pairing catches a band left
     * over from a scope the visitor has since changed.
     */
    const draft = unifiedLeadToRequest({
      ...BASE,
      service: "complete-home-interiors",
      projectScope: "2-bhk",
      budgetRange: "3bhk-above-16l",
      timeline: "immediate",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.budgetRange"));
  });

  test("a scope belonging to a DIFFERENT service is refused", () => {
    const draft = unifiedLeadToRequest({
      ...BASE,
      service: "complete-home-interiors",
      projectScope: "kitchen",
      budgetRange: "kitchen-1-2l",
      timeline: "immediate",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.projectScope"));
  });

  test("a scope with no budget is half an answer, and is refused", () => {
    const draft = unifiedLeadToRequest({
      ...KITCHEN,
      budgetRange: null,
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.budgetRange"));
  });

  test("the SQL enforces the same pairing, independently", () => {
    const sql = read(V4_MIGRATION);
    assert.match(sql, /validation: budget_range_scope_mismatch/);
    assert.match(sql, /validation: service_scope_mismatch/);
    assert.match(sql, /validation: project_scope_required/);
    assert.match(sql, /validation: budget_range_required/);
    for (const scope of LEAD_PROJECT_SCOPE_CODES) {
      for (const option of BUDGET_RANGES_BY_PROJECT_SCOPE[scope]) {
        assert.ok(
          sql.includes(`'${option.code}'`),
          `the SQL ladder is missing ${option.code}`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 4. The wardrobe exception, enforced in both directions                      */
/* ========================================================================== */

describe("custom-wardrobes asks for no scope, and may not carry one", () => {
  test("the predicate is shared, not re-declared per call site", () => {
    assert.deepEqual([...V4_SCOPED_SERVICES], [
      "complete-home-interiors",
      "modular-kitchens",
    ]);
    assert.equal(v4RequiresScope("custom-wardrobes"), false);
    assert.equal(v4RequiresScope("modular-kitchens"), true);
    assert.equal(v4RequiresScope("complete-home-interiors"), true);
    /*
     * The adapter and the plan state still ask this function. The form no
     * longer does: its only visible options are the five scopes, so a service
     * that takes no scope cannot be chosen there in the first place.
     */
    for (const file of [ADAPTER, CTA]) {
      assert.match(code(read(file)), /v4RequiresScope/, file);
    }
  });

  test("a wardrobe enquiry with neither field is accepted", () => {
    const { body, result } = throughServer(WARDROBE);
    assert.equal(result.ok, true);
    // OMITTED, not null: the contract distinguishes "not asked" from "empty".
    assert.equal("projectScope" in body.requirements, false);
    assert.equal("budgetRange" in body.requirements, false);
  });

  test("a wardrobe enquiry carrying a scope is REFUSED, not stripped", () => {
    /*
     * Stripping would send a body the visitor's answers do not support. The
     * only honest response to a stale scope is to refuse it.
     */
    const draft = unifiedLeadToRequest({
      ...WARDROBE,
      projectScope: "2-bhk",
    });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("requirements.projectScope"));

    const withBudget = unifiedLeadToRequest({
      ...WARDROBE,
      budgetRange: "2bhk-4-8l",
    });
    assert.equal(withBudget.ok, false);
    if (withBudget.ok) return;
    assert.ok(withBudget.fields.includes("requirements.budgetRange"));
  });

  test("the server refuses the smuggled pair too, not just the adapter", () => {
    const { body } = throughServer(WARDROBE);
    const forged = {
      ...body,
      requirements: {
        ...body.requirements,
        projectScope: "2-bhk",
        budgetRange: "2bhk-4-8l",
      },
    };
    const result = validateLeadIntakePayload(forged);
    assert.equal(result.ok, false);
  });

  test("the SQL states the exception itself", () => {
    const sql = read(V4_MIGRATION);
    const branch = sql.slice(
      sql.indexOf("elsif p_planner_version = 'public-consult-v4' then")
    );
    assert.match(branch, /p_service_code = 'custom-wardrobes'/);
    assert.match(branch, /validation: scope_not_asked/);
  });
});

/* ========================================================================== */
/* 5. What v4 does NOT ask for                                                 */
/* ========================================================================== */

describe("v4 sends nothing the form never asked", () => {
  test("the accepted body carries no qualifier, property, rooms or estimate", () => {
    const { body } = throughServer(KITCHEN);
    for (const forbidden of [
      "qualifier",
      "property",
      "rooms",
      "budgetComfort",
      "estimate",
    ]) {
      assert.equal(
        forbidden in body.requirements,
        false,
        `v4 must not send ${forbidden}`
      );
    }
  });

  test("the server refuses each of them if one is forged in", () => {
    const { body } = throughServer(KITCHEN);
    const forgeries: Record<string, unknown>[] = [
      { qualifier: { kind: "kitchen-scope", code: "new-kitchen" } },
      { property: "apartment-2bhk" },
      { rooms: ["kitchen"] },
      { budgetComfort: "6-12l" },
      { estimate: { estimatorService: "complete-home" } },
    ];
    for (const extra of forgeries) {
      const result = validateLeadIntakePayload({
        ...body,
        requirements: { ...body.requirements, ...extra },
      });
      assert.equal(result.ok, false, Object.keys(extra)[0]);
    }
  });

  test("optional locality and message travel when given, and vanish when not", () => {
    const { body: bare } = throughServer(KITCHEN);
    assert.equal("locality" in bare.requirements, false);
    assert.equal("message" in bare.requirements, false);

    const { body: full, result } = throughServer({
      ...KITCHEN,
      area: "  Kharadi  ",
      message: "  Prefer warm oak  ",
    });
    assert.equal(full.requirements.locality, "Kharadi");
    assert.equal(full.requirements.message, "Prefer warm oak");
    assert.equal(result.ok, true);
  });
});

/* ========================================================================== */
/* 6. Consent evidence, and the consent nobody was asked for                   */
/* ========================================================================== */

describe("consent is recorded as the sentence the visitor actually read", () => {
  test("one checkbox, two purposes, combined copy versions", () => {
    const { body } = throughServer(KITCHEN);
    assert.equal(body.consent.serviceEnquiry, true);
    assert.deepEqual(body.consent.serviceChannels, { phone: true });
    assert.equal(
      body.consent.serviceEnquiryCopyVersion,
      SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION
    );
    assert.equal(
      body.consent.serviceCommunicationCopyVersion,
      SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION
    );
  });

  test("WhatsApp consent is ABSENT, not false", () => {
    /*
     * An absent optional consent is one nobody was asked for. A `false` one
     * implies a question that was shown and declined. This form does not ask,
     * so it must not answer.
     */
    const { body } = throughServer(KITCHEN);
    assert.equal("whatsappService" in body.consent, false);
    assert.equal("whatsappCopyVersion" in body.consent, false);
    const brief = code(read(BRIEF));
    assert.doesNotMatch(brief, /whatsappService|whatsappConsent/);
  });

  test("an unticked box is refused, with the field named", () => {
    const draft = unifiedLeadToRequest({ ...KITCHEN, consent: false });
    assert.equal(draft.ok, false);
    if (draft.ok) return;
    assert.ok(draft.fields.includes("consent.serviceEnquiry"));
  });
});

/* ========================================================================== */
/* 7. Contact, phone normalisation and the anti-bot window                     */
/* ========================================================================== */

describe("contact handling is the shared one, not a private copy", () => {
  test("a national number survives the accepted input formats", () => {
    for (const raw of [
      "9876543210",
      "+91 98765 43210",
      "91 98765 43210",
      "(98765) 43210",
      " 98765-43210 ",
    ]) {
      const draft = unifiedLeadToRequest({ ...KITCHEN, mobile: raw });
      assert.equal(draft.ok, true, raw);
      if (!draft.ok) continue;
      assert.equal(draft.body.contact.mobile, "9876543210", raw);
    }
  });

  test("an impossible number is refused rather than trimmed into shape", () => {
    /*
     * `098765-43210` is in this list on purpose: a leading zero is a trunk
     * prefix, not part of the number, and the shared helper refuses it rather
     * than quietly slicing a digit off the front.
     */
    for (const raw of ["1234567890", "98765", "abcdefghij", "", "098765-43210"]) {
      const draft = unifiedLeadToRequest({ ...KITCHEN, mobile: raw });
      assert.equal(draft.ok, false, raw);
      if (draft.ok) continue;
      assert.ok(draft.fields.includes("contact.mobile"), raw);
    }
  });

  test("the name is trimmed and bounded", () => {
    const { body } = throughServer({ ...KITCHEN, name: "  Asha Menon  " });
    assert.equal(body.contact.name, "Asha Menon");
    for (const bad of ["", "A", "x".repeat(121)]) {
      const draft = unifiedLeadToRequest({ ...KITCHEN, name: bad });
      assert.equal(draft.ok, false, JSON.stringify(bad));
    }
  });

  test("the honeypot and the timing window reach the server untouched", () => {
    const { body } = throughServer(KITCHEN);
    assert.equal(body.antiBot.website, "");
    assert.equal(body.antiBot.formStartedAt, FORM_STARTED_AT);

    // A filled honeypot is refused by the server, not by the adapter.
    const trapped = validateLeadIntakePayload({
      ...body,
      antiBot: { ...body.antiBot, website: "http://spam.example" },
    });
    assert.equal(trapped.ok, false);

    // So is a form that was "started" in the future.
    const impossible = validateLeadIntakePayload({
      ...body,
      antiBot: {
        ...body.antiBot,
        formStartedAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    assert.equal(impossible.ok, false);
  });

  test("the brief step stamps its own start time and keeps the honeypot", () => {
    const brief = code(read(BRIEF));
    assert.match(brief, /useState\(\(\) => new Date\(\)\.toISOString\(\)\)/);
    assert.match(brief, /LEAD_FORM_HONEYPOT_FIELD/);
    assert.match(brief, /aria-hidden="true"/);
  });
});

/* ========================================================================== */
/* 8. Double submission                                                        */
/* ========================================================================== */

describe("the same enquiry twice is one enquiry", () => {
  test("identical answers fingerprint identically, changed ones do not", () => {
    const a = unifiedLeadToRequest(KITCHEN);
    const b = unifiedLeadToRequest(KITCHEN);
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.deepEqual(a.body, b.body);

    const changed = unifiedLeadToRequest({ ...KITCHEN, timeline: "immediate" });
    assert.equal(changed.ok, true);
    if (!changed.ok) return;
    assert.notDeepEqual(changed.body, a.body);
  });

  test("the brief guards against a second in-flight submit", () => {
    const brief = code(read(BRIEF));
    assert.match(brief, /submittingRef\.current/);
    assert.match(brief, /fingerprintLeadPayload/);
    assert.match(brief, /resetOnPayloadChange/);
    assert.match(brief, /getOrCreateKey/);
    assert.match(brief, /resetAfterSuccess/);
  });
});

/* ========================================================================== */
/* 9. The sheet asks exactly what v4 accepts                                   */
/* ========================================================================== */

describe("the form and the contract ask the same questions", () => {
  test("the form collects scope, budget and timeline — and no more", () => {
    /*
     * THE CONTROLS MOVED INTO THE BRIEF WITH THE SINGLE-PANEL REDESIGN.
     *
     * They used to live on steps 1-3 of the sheet. The questions and the
     * contract behind them are unchanged; they are simply all on one screen
     * now, which is why this asserts against the brief rather than the planner.
     *
     * The service is no longer asked at all — it is derived from the scope by
     * `serviceForProjectScope`, the same mapping the server validator and the
     * SQL check the pair against.
     */
    const brief = code(read(BRIEF));
    assert.match(brief, /PROJECT_SCOPE_LABELS/);
    assert.match(brief, /budgetRangesForProjectScope/);
    assert.match(brief, /PM_PLANNER\.timelines/);
    assert.match(brief, /serviceForProjectScope/);
    /*
     * The controls for the fields v4 forbids are GONE, not hidden. A question
     * whose answer the contract refuses is a question we should not be asking.
     */
    for (const source of [brief, code(read(PLANNER))]) {
      assert.doesNotMatch(source, /PM_PLANNER\.properties/);
      assert.doesNotMatch(source, /PM_PLANNER\.rooms/);
      assert.doesNotMatch(source, /budgetComfortOptions/);
    }
  });

  test("the sheet is one panel, not a four-step walk", () => {
    /*
     * Four screens each asking one question spent three transitions collecting
     * what fits on one, and every transition is somewhere to abandon. The step
     * machinery stays in `PlanContext` — this was a UI pass — but the sheet no
     * longer renders a progress rail or Back/Continue.
     */
    const planner = code(read(PLANNER));
    assert.doesNotMatch(planner, /<PlanProgress/);
    assert.doesNotMatch(planner, /plan\.step === 1|plan\.step === 2|plan\.step === 3/);
    assert.doesNotMatch(planner, /backLabel|continueLabel/);
    assert.match(planner, /<UnifiedLeadBrief onSubmitted=\{plan\.markSubmitted\} \/>/);
    assert.equal(
      (planner.match(/<UnifiedLeadBrief/g) ?? []).length,
      1,
      "exactly one form is mounted"
    );
  });

  test("the submit button carries the owner-approved wording, from one place", () => {
    /*
     * "Get Free Quote" was approved with the scope and budget copy and lives
     * beside it. The button imports that constant rather than restating the
     * string, because a second copy is a second thing to forget when the
     * wording changes — which is how this button ended up reading something
     * else before this assertion existed.
     */
    assert.equal(SUBMIT_LABEL, "Get Free Quote");
    const brief = code(read(BRIEF));
    /*
     * Imported alongside the scope and budget helpers from the same module —
     * the approved wording lives beside the approved ladders, which is why one
     * import now brings all of them.
     */
    assert.match(brief, /SUBMIT_LABEL,\s+type LeadProjectScopeCode,\s+\} from "\.\.\/project-scope\.ts"/);
    assert.match(brief, /UNIFIED_BRIEF_SUBMITTING_LABEL : SUBMIT_LABEL/);
    // No local restatement of the approved wording.
    assert.doesNotMatch(brief, /"Get Free Quote"/);
    assert.doesNotMatch(brief, /Request free consultation/);
  });

  test("the brief step is the only thing that submits", () => {
    const planner = code(read(PLANNER));
    assert.match(planner, /UnifiedLeadBrief/);
    assert.doesNotMatch(planner, /submitLeadIntake/);
    const brief = code(read(BRIEF));
    assert.match(brief, /unifiedLeadToRequest/);
    assert.match(brief, /submitLeadIntake/);
  });

  test("the rail agrees with the contract about when a step is answered", () => {
    const base: PlanSnapshot = {
      service: null,
      projectScope: null,
      budgetRange: null,
      property: null,
      timeline: null,
      rooms: [],
      budgetComfort: null,
      estimateSummary: null,
      name: "",
      mobile: "",
      locality: "",
      message: "",
      whatsappConsent: false,
      privacyConsent: false,
    };

    // Scoped service: the home step is answered only by a matching pair.
    const kitchen = { ...base, service: "modular-kitchens" as const };
    assert.equal(homeStepComplete(kitchen), false);
    assert.equal(
      homeStepComplete({ ...kitchen, projectScope: "kitchen" }),
      false
    );
    assert.equal(
      homeStepComplete({
        ...kitchen,
        projectScope: "kitchen",
        budgetRange: "villa-above-20l",
      }),
      false
    );
    assert.equal(
      homeStepComplete({
        ...kitchen,
        projectScope: "kitchen",
        budgetRange: "kitchen-1-2l",
      }),
      true
    );

    // Wardrobes: nothing to answer, so the step is done and 3 is next.
    const wardrobe = { ...base, service: "custom-wardrobes" as const };
    assert.equal(homeStepComplete(wardrobe), true);
    assert.equal(getNextIncompleteStep(wardrobe), 3);
  });

  test("a CTA that preselects a service opens on the next real question", () => {
    /*
     * Wardrobes skip step 2 because it asks them nothing. Landing on a step
     * with one explanatory sentence and no control would read as a bug.
     */
    const cta = code(read(CTA));
    assert.match(cta, /openPlanner\(v4RequiresScope\(service\) \? 2 : 3\)/);
    assert.match(cta, /setService\(service\)/);
  });
});
