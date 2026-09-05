/**
 * Public conversion UX — hero without CTAs, and a form that asks only what
 * the chosen service actually needs.
 *
 * THE TWO DEFECTS THIS GUARDS
 *
 * 1. The hero carried two CTA buttons per slide, duplicating the persistent
 *    sticky dock and spending a large share of the mobile first screen
 *    competing with it.
 *
 * 2. The form asked every visitor for BHK and a timeline. "How many BHK is your
 *    kitchen?" is a question that makes a serious visitor close the tab — and
 *    because the contract required those fields, the only way to honour a
 *    kitchen enquiry would have been to invent them. The rule these tests hold
 *    is that the database records what the customer said, never a default the
 *    UI made up.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CONSULTATION_QUALIFIERS,
  CONSULTATION_SERVICE_OPTIONS,
  qualifierForService,
} from "../public/consultation-copy.ts";
import { consultationToLeadRequest } from "../public/consultation-to-lead-request.ts";
import {
  LEAD_QUALIFIER_KIND_BY_SERVICE,
  LEAD_SERVICE_CODES,
  isAllowedLeadQualifier,
  propertyCodeFromQualifier,
} from "../planner-allowlist.ts";
import {
  LEAD_INTAKE_PLANNER_VERSION,
  PUBLIC_CONSULT_PLANNER_VERSION,
} from "../contracts.ts";
import { validateLeadFormFields } from "../public/lead-form-errors.ts";
import {
  acceptIndianMobileInput,
  acceptIndianMobileKeystroke,
} from "../public/indian-mobile.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const HERO = "src/features/public-site/discovery/DiscoveryHeroSlider.tsx";
const COPY = "src/features/public-site/discovery/discovery-copy.ts";
const CSS = "src/features/public-site/discovery/discovery.css";
const FORM = "src/features/lead-intake/public/ConsultationLeadForm.tsx";
const WRAPPER = "src/features/public-site/discovery/HomeConsultationCapture.tsx";
const STICKY = "src/features/public-site/discovery/DiscoveryStickyCta.tsx";
const ADAPTER = "src/features/lead-intake/public/consultation-to-lead-request.ts";
const MIGRATION =
  "supabase/migrations/20260905120000_public_consultation_qualifier.sql";

const BASE = {
  name: "Test Person",
  mobile: "9876543210",
  consent: { serviceEnquiry: true as const, servicePhone: true as const },
  attribution: { landingPath: "/" },
  antiBot: { website: "", formStartedAt: new Date().toISOString() },
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
};

/* ========================================================================== */
/* 1. The hero inspires; it does not convert                                   */
/* ========================================================================== */

describe("the hero carries no call to action", () => {
  test("no conversion link is rendered inside a slide", () => {
    const src = code(read(HERO));
    assert.doesNotMatch(src, /od-disc-hero__ctas/);
    assert.doesNotMatch(src, /slide\.primaryCta|slide\.secondaryCta/);
    // The slider renders no <Link> at all now.
    assert.doesNotMatch(src, /<Link\b/);
  });

  test("the slide data defines no CTA to render", () => {
    const src = code(read(COPY));
    const hero = src.slice(
      src.indexOf("DISCOVERY_HERO_SLIDES"),
      src.indexOf("DISCOVERY_CATEGORY_TILES")
    );
    assert.doesNotMatch(hero, /primaryCta|secondaryCta/);
  });

  test("slider behaviour and the trust bar survive", () => {
    const src = read(HERO);
    for (const kept of [
      "DiscoveryHeroTrustBar",
      "aria-roledescription",
      "prefers-reduced-motion",
      "onTouchStart",
      "onKeyDown",
      "od-disc-hero__progress",
    ]) {
      assert.ok(src.includes(kept), `slider must keep ${kept}`);
    }
  });

  test("the hero-named CTA class is gone, and the row it styled is not", () => {
    const css = read(CSS);
    // Renamed rather than deleted: the consultation band still uses the row.
    assert.doesNotMatch(css, /^\.od-disc-hero__ctas \{/m);
    assert.match(css, /\.od-disc-cta-row \{/);
  });

  test("the sticky dock remains the one persistent conversion action", () => {
    const sticky = read(STICKY);
    assert.match(sticky, /PUBLIC_CONSULTATION/);
    // And nothing added a second floating CTA.
    const page = read("src/features/public-site/discovery/DiscoveryHomePage.tsx");
    assert.equal((page.match(/<DiscoveryStickyCta/g) ?? []).length, 1);
  });
});

/* ========================================================================== */
/* 2. One question, and it is the right one                                    */
/* ========================================================================== */

describe("the qualifier is chosen by service", () => {
  test("complete home asks about the HOME", () => {
    const q = qualifierForService("complete-home-interiors");
    assert.ok(q);
    assert.equal(q.kind, "home-size");
    assert.match(q.label, /What kind of home/);
    assert.deepEqual(
      q.options.map((o) => o.value),
      [
        "apartment-1bhk",
        "apartment-2bhk",
        "apartment-3bhk",
        "apartment-4bhk-plus",
        "villa-rowhouse",
        "unsure",
      ]
    );
    // Deliberately NOT offered for a whole-home project.
    assert.ok(!q.options.some((o) => o.value === "single-room"));
  });

  test("a kitchen enquiry is NEVER asked for BHK", () => {
    const q = qualifierForService("modular-kitchens");
    assert.ok(q);
    assert.equal(q.kind, "kitchen-scope");
    assert.match(q.label, /kitchen/i);
    assert.doesNotMatch(q.label, /BHK|home type|property/i);
    for (const option of q.options) {
      assert.doesNotMatch(
        option.label,
        /BHK|villa|apartment/i,
        `kitchen option "${option.label}" must not mention property size`
      );
    }
  });

  test("a wardrobe enquiry is NEVER asked for BHK", () => {
    const q = qualifierForService("custom-wardrobes");
    assert.ok(q);
    assert.equal(q.kind, "wardrobe-count");
    assert.match(q.label, /how many wardrobes/i);
    for (const option of q.options) {
      assert.doesNotMatch(option.label, /BHK|villa|apartment/i);
    }
  });

  test("every real service has exactly one qualifier", () => {
    for (const service of LEAD_SERVICE_CODES) {
      const q = qualifierForService(service);
      assert.ok(q, `${service} needs a qualifier`);
      assert.equal(q.kind, LEAD_QUALIFIER_KIND_BY_SERVICE[service]);
      // Every offered option is server-allowlisted for that kind.
      for (const option of q.options) {
        assert.ok(
          isAllowedLeadQualifier(q.kind, option.value),
          `${service}/${option.value} is not allowlisted`
        );
      }
    }
  });

  test("the service list offers no unsure SERVICE", () => {
    // An "unsure" service would have to be mapped onto a real service code,
    // putting a service in CRM the customer never chose. The escape hatch lives
    // inside each qualifier instead.
    const values = CONSULTATION_SERVICE_OPTIONS.map((o) => o.value);
    assert.deepEqual(values, [...LEAD_SERVICE_CODES]);
    for (const service of Object.values(CONSULTATION_QUALIFIERS)) {
      assert.ok(service.options.some((o) => o.value === "unsure"));
    }
  });
});

/* ========================================================================== */
/* 3. Nothing is invented                                                      */
/* ========================================================================== */

describe("no fabricated property or timeline", () => {
  test("a kitchen lead carries a kitchen answer and NOTHING else", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "modular-kitchens",
      qualifierCode: "renovate-existing",
    });
    assert.ok(result.ok);

    const req = result.body.requirements;
    assert.equal(req.service, "modular-kitchens");
    assert.deepEqual(req.qualifier, {
      kind: "kitchen-scope",
      code: "renovate-existing",
    });

    // The decisive assertions.
    assert.equal(req.property, undefined, "no property may be invented");
    assert.equal(req.timeline, undefined, "no timeline may be invented");
    assert.equal(req.rooms, undefined);
    assert.equal(req.budgetComfort, undefined);
    assert.equal(result.body.plannerVersion, PUBLIC_CONSULT_PLANNER_VERSION);
  });

  test("a wardrobe lead round-trips as a wardrobe count", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "custom-wardrobes",
      qualifierCode: "three",
    });
    assert.ok(result.ok);
    assert.deepEqual(result.body.requirements.qualifier, {
      kind: "wardrobe-count",
      code: "three",
    });
    assert.equal(result.body.requirements.property, undefined);
  });

  test("a complete-home lead round-trips its real home size", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "complete-home-interiors",
      qualifierCode: "apartment-3bhk",
    });
    assert.ok(result.ok);
    assert.deepEqual(result.body.requirements.qualifier, {
      kind: "home-size",
      code: "apartment-3bhk",
    });
    // The customer DID answer a property question here, so the canonical column
    // may carry it — derived from their answer, never defaulted.
    assert.equal(
      propertyCodeFromQualifier("home-size", "apartment-3bhk"),
      "apartment-3bhk"
    );
  });

  test("an UNSURE answer never becomes a property", () => {
    assert.equal(propertyCodeFromQualifier("home-size", "unsure"), null);
    assert.equal(propertyCodeFromQualifier("kitchen-scope", "new-kitchen"), null);
    assert.equal(propertyCodeFromQualifier("wardrobe-count", "two"), null);
  });

  test("the adapter derives the kind and refuses a mismatched code", () => {
    // A tampered client sending a BHK for a wardrobe is rejected outright.
    const result = consultationToLeadRequest({
      ...BASE,
      service: "custom-wardrobes",
      qualifierCode: "apartment-2bhk",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.fields.includes("requirements.qualifier"));
    }
  });

  test("an unknown qualifier code is refused", () => {
    for (const bad of ["", "made-up", "single-room"]) {
      const result = consultationToLeadRequest({
        ...BASE,
        service: "modular-kitchens",
        qualifierCode: bad,
      });
      assert.equal(result.ok, false, `"${bad}" must be refused`);
    }
  });

  test("the public variant refuses every unasked field", () => {
    const src = code(read("src/features/lead-intake/server/lead-intake-validation.ts"));
    // Rejected, not ignored: silently dropping them would let the caller
    // believe an answer was stored.
    for (const unasked of ["property", "timeline", "rooms", "budgetComfort", "estimate"]) {
      assert.ok(src.includes(`"${unasked}"`), `must name ${unasked} as unasked`);
    }
    assert.match(src, /isPublicConsult[\s\S]{0,600}contact\.email/);
    assert.match(src, /isPublicConsult && input\.consent\.serviceChannels\.email/);
  });

  test("the SQL RPC enforces the same discriminator", () => {
    const sql = read(MIGRATION);
    // Exact planner-version allowlist.
    assert.match(sql, /p_planner_version not in \(\s*'home-r4-v1', 'public-consult-v1'/);
    // Legacy stays strict.
    assert.match(sql, /validation: qualifier_not_allowed/);
    // Public refuses unasked data.
    for (const rule of [
      "timeline_not_asked",
      "rooms_not_asked",
      "budget_not_asked",
      "estimate_not_asked",
      "qualifier_required",
      "property_qualifier_mismatch",
    ]) {
      assert.match(sql, new RegExp(`validation: ${rule}`), `SQL must enforce ${rule}`);
    }
    // Null-safe comparison so a mismatch fails closed.
    assert.match(sql, /p_property_code is distinct from/);
  });

  test("the adapter never writes a default anywhere", () => {
    const src = code(read(ADAPTER));
    for (const forbidden of [
      "apartment-2bhk",
      "after-2-months",
      "within-1-month",
      "single-room",
    ]) {
      assert.ok(
        !src.includes(forbidden),
        `the adapter must not contain the literal ${forbidden}`
      );
    }
  });
});

/* ========================================================================== */
/* 4. Switching service clears the stale answer                                */
/* ========================================================================== */

describe("the qualifier does not survive a service change", () => {
  test("the form clears it explicitly", () => {
    const src = code(read(FORM));
    const handler = src.slice(
      src.indexOf("const onServiceChange"),
      src.indexOf("const currentStep")
    );
    assert.match(handler, /setQualifierCode\(""\)/);
    // And the stale error goes with it.
    assert.match(handler, /delete next\.qualifier/);
  });

  test("a carried-over answer would be rejected anyway", () => {
    // Defence in depth: even if the UI leaked a stale code, the pair check
    // refuses it, so a 2 BHK can never ride along on a kitchen lead.
    assert.equal(isAllowedLeadQualifier("kitchen-scope", "apartment-2bhk"), false);
    assert.equal(isAllowedLeadQualifier("wardrobe-count", "new-kitchen"), false);
    assert.equal(isAllowedLeadQualifier("home-size", "three"), false);
  });
});

/* ========================================================================== */
/* 5. The form asks for the lead, not a questionnaire                          */
/* ========================================================================== */

describe("the visible form is short", () => {
  test("it uses native selects, not card or chip walls", () => {
    const src = read(FORM);
    assert.match(src, /<select/);
    assert.doesNotMatch(src, /role="radiogroup"/);
    // One dropdown per stage: service, then the single qualifier.
    assert.equal((src.match(/<select/g) ?? []).length, 2);
  });

  test("it never renders a timeline, rooms or budget control", () => {
    const src = read(FORM);
    for (const absent of ["timeline", "rooms", "budgetComfort", "estimate"]) {
      assert.ok(
        !src.includes(`name="${absent}"`),
        `the public form must not ask for ${absent}`
      );
    }
  });

  test("every control has a real label", () => {
    const src = read(FORM);
    for (const id of [
      "od-consult-service",
      "od-consult-qualifier",
      "od-consult-name",
      "od-consult-mobile",
      "od-consult-locality",
    ]) {
      assert.ok(src.includes(`htmlFor="${id}"`), `${id} needs a <label>`);
      assert.ok(src.includes(`id="${id}"`));
    }
  });

  test("consent is preserved and never pre-checked", () => {
    const src = read(FORM);
    assert.match(src, /getServiceEnquiryConsentCopy\(\)/);
    assert.match(src, /getServiceCommunicationConsentCopy\(\)/);
    assert.match(src, /getWhatsappServiceConsentCopy\(\)/);
    assert.match(src, /LEAD_FORM_PRIVACY_PATH/);
    assert.match(src, /LEAD_FORM_TERMS_PATH/);
    // All three start false; WhatsApp has no required marker.
    assert.match(src, /useState\(false\)/);
    assert.doesNotMatch(src, /whatsappConsent, setWhatsappConsent\] = useState\(true\)/);
  });

  test("the existing submission protections are reused, not reinvented", () => {
    const src = read(FORM);
    for (const kept of [
      "LEAD_FORM_HONEYPOT_FIELD",
      "collectLeadFormAttribution",
      "fingerprintLeadPayload",
      "getOrCreateKey",
      "shouldReuseOnError",
      "acceptIndianMobileInput",
      "submitLeadIntake",
    ]) {
      assert.ok(src.includes(kept), `must reuse ${kept}`);
    }
    // 10-digit national mobile UX is unchanged.
    assert.match(src, /data-od-lead-phone-ux="national-10"/);
    assert.match(src, /maxLength=\{10\}/);
  });

  test("a preselected service skips straight to its own question", () => {
    const src = read(FORM);
    // Handled after mount, never in the state initializer — see the hydration
    // test below.
    assert.match(src, /new URLSearchParams\(window\.location\.search\)\.get\("service"\)/);
    assert.match(src, /qualifierForService\(raw\)/);
    // And the wrapper mounts the adaptive form, not the legacy planner one.
    const wrapper = read(WRAPPER);
    assert.match(wrapper, /ConsultationLeadForm/);
    assert.doesNotMatch(code(wrapper), /HomeLeadCapture|PlanProvider/);
  });

  test("the deep link is hydration-safe", () => {
    /*
     * Reading `window.location.search` in the useState initializer renders ""
     * on the server and a chosen service on hydration — a first-render mismatch
     * on exactly the URLs the deep link exists for. The initial value comes
     * only from the prop; the URL is read after mount.
     */
    const src = code(read(FORM));
    const initializer = src.slice(
      src.indexOf("const [service, setService]"),
      src.indexOf("const [qualifierCode")
    );
    assert.doesNotMatch(initializer, /window|URLSearchParams|location/);
    assert.match(initializer, /initialService/);

    // The URL read happens inside an effect.
    assert.match(src, /useEffect\(\(\) => \{[\s\S]{0,400}URLSearchParams/);
  });

  test("a kitchen deep link never yields a BHK question", () => {
    // Whatever the URL says, the qualifier is derived from the service.
    const q = qualifierForService("modular-kitchens");
    assert.ok(q);
    assert.equal(q.kind, "kitchen-scope");
    assert.notEqual(q.kind, "home-size");
  });

  /* ---------------------------------------------------------------------- */
  /* Mobile input                                                            */
  /* ---------------------------------------------------------------------- */

  test("the mobile handler passes the VALUE, never a keystroke", () => {
    /*
     * `acceptIndianMobileKeystroke` takes the whole candidate value. Passing
     * `event.key` to it blocked Backspace, Delete, Tab and the arrow keys — an
     * accessibility and conversion regression.
     */
    const src = code(read(FORM));
    assert.doesNotMatch(src, /acceptIndianMobileKeystroke\(\s*event\.key/);
    assert.doesNotMatch(src, /onKeyDown/);
    assert.match(src, /onChange=\{\(event\) => applyMobileRaw\(event\.target\.value\)\}/);
    assert.match(src, /acceptIndianMobileKeystroke\(raw\)/);
  });

  test("it reuses the legacy paste normalisation", () => {
    const src = code(read(FORM));
    assert.match(src, /onPaste=/);
    assert.match(src, /clipboardData\.getData\("text"\)/);
    assert.match(src, /acceptIndianMobileInput\(text\)/);
    // maxLength stays, so the paste must be normalised BEFORE the browser
    // truncates a "+91..." value.
    assert.match(src, /maxLength=\{10\}/);
    assert.match(src, /inputMode="numeric"/);
    assert.match(src, /autoComplete="tel-national"/);
  });

  test("the canonical helper accepts progressive and pasted forms", () => {
    // Progressive national entry.
    for (const partial of ["", "7", "74", "744786", "7447863402"]) {
      assert.equal(
        acceptIndianMobileKeystroke(partial).ok,
        true,
        `progressive "${partial}" must be accepted`
      );
    }
    // Pasted E.164 / 91-prefixed forms normalise to the national 10.
    for (const pasted of ["+917447863402", "917447863402"]) {
      const result = acceptIndianMobileInput(pasted);
      assert.equal(result.ok, true, pasted);
      if (result.ok) assert.equal(result.national, "7447863402");
    }
    // An overlong digit run is NOT silently truncated.
    assert.equal(acceptIndianMobileKeystroke("74478634021234").ok, false);
  });

  test("field errors clear as the visitor corrects them", () => {
    const src = code(read(FORM));
    assert.match(src, /const clearFieldError = /);
    for (const key of [
      "service",
      "qualifier",
      "name",
      "mobile",
      "serviceEnquiryConsent",
      "servicePhoneConsent",
    ]) {
      assert.ok(
        src.includes(`clearFieldError("${key}")`),
        `${key} error must clear on correction`
      );
    }
  });

  test("submit appears only once the Contact stage is reached", () => {
    const src = code(read(FORM));
    // Offering "submit" while the contact fields are still hidden reads as a
    // broken step counter.
    assert.match(src, /\{qualifierCode \? \([\s\S]{0,200}type="submit"/);
  });
});

/* ========================================================================== */
/* 6. Backward compatibility                                                   */
/* ========================================================================== */

describe("the legacy planner contract still works", () => {
  test("both planner versions are accepted", () => {
    assert.equal(LEAD_INTAKE_PLANNER_VERSION, "home-r4-v1");
    assert.equal(PUBLIC_CONSULT_PLANNER_VERSION, "public-consult-v1");
    assert.notEqual(LEAD_INTAKE_PLANNER_VERSION, PUBLIC_CONSULT_PLANNER_VERSION);
  });

  test("the planner variant still demands property and timeline", () => {
    const planner = validateLeadFormFields({
      name: "Test Person",
      mobile: "9876543210",
      locality: "",
      message: "",
      serviceEnquiryConsent: true,
      servicePhoneConsent: true,
      service: "complete-home-interiors",
    });
    assert.equal(planner.ok, false);
    assert.ok(planner.fields.property, "planner must still require property");
    assert.ok(planner.fields.timeline, "planner must still require timeline");
  });

  test("the consultation variant demands the qualifier instead", () => {
    const missing = validateLeadFormFields({
      name: "Test Person",
      mobile: "9876543210",
      locality: "",
      message: "",
      serviceEnquiryConsent: true,
      servicePhoneConsent: true,
      service: "modular-kitchens",
      variant: "consultation",
      qualifier: "",
    });
    assert.equal(missing.ok, false);
    assert.ok(missing.fields.qualifier);
    // It must NOT ask for answers the form never showed.
    assert.equal(missing.fields.property, undefined);
    assert.equal(missing.fields.timeline, undefined);

    const complete = validateLeadFormFields({
      name: "Test Person",
      mobile: "9876543210",
      locality: "",
      message: "",
      serviceEnquiryConsent: true,
      servicePhoneConsent: true,
      service: "modular-kitchens",
      variant: "consultation",
      qualifier: "new-kitchen",
    });
    assert.equal(complete.ok, true);
  });

  test("the legacy form is untouched and still mounted by the planner page", () => {
    const legacy = read("src/features/lead-intake/public/HomeLeadCapture.tsx");
    assert.match(legacy, /planToLeadRequest/);
    assert.match(read("src/features/public-site/home-r4/HomePlan.tsx"), /HomeLeadCapture/);
  });
});

/* ========================================================================== */
/* 7. The migration is truthful and forward-only                               */
/* ========================================================================== */

describe("the migration only enables truth", () => {
  test("it makes the columns optional rather than defaulting them", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /alter column property_code drop not null/);
    assert.match(sql, /alter column timeline_code drop not null/);
    // No backfill of any kind.
    assert.doesNotMatch(sql, /update public\.leads set/i);
  });

  test("supplied values are still allowlisted", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /p_property_code is not null and p_property_code not in/);
    assert.match(sql, /p_timeline_code is not null and p_timeline_code not in/);
  });

  test("the qualifier is validated as a pair and against the service", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /validation: qualifier_pair/);
    assert.match(sql, /validation: qualifier_code/);
    assert.match(sql, /validation: qualifier_service_mismatch/);
  });

  test("the recreated RPC keeps its privileges", () => {
    // DROP takes the grants with it; without this the function would fall back
    // to Postgres defaults, where PUBLIC holds EXECUTE.
    const sql = read(MIGRATION);
    assert.match(sql, /revoke all on function public\.submit_lead_intake\(/);
    assert.match(sql, /from public, anon, authenticated;/);
    assert.match(sql, /grant execute on function public\.submit_lead_intake\(/);
    assert.match(sql, /to service_role;/);
    assert.match(sql, /owner to postgres;/);
  });

  test("it is forward-only and edits no applied migration", () => {
    const files = readdirSync(join(root, "supabase/migrations")).filter((n) =>
      n.endsWith(".sql")
    );
    assert.equal(
      [...files].sort().pop(),
      "20260905120000_public_consultation_qualifier.sql"
    );
  });
});
