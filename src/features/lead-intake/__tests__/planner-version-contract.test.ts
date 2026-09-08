/**
 * The application and the database must agree about what a planner version
 * MEANS.
 *
 * WHY THIS FILE EXISTS
 *
 * The single-step homepage form stopped sending a qualifier while the SQL for
 * `public-consult-v1` still raised `qualifier_required`. Every application test
 * passed, because they validated the relaxed TypeScript contract. Every database
 * test passed, because they validated the strict SQL one. Both suites were
 * green, and every real lead would have failed at the RPC.
 *
 * Neither suite could have caught it, because each was right about its own half.
 * So this file asserts the JOIN: that every version TypeScript accepts has a
 * branch in the SQL, that the branches say the same thing about the same
 * fields, and that the adapter emits the version whose rules it actually obeys.
 *
 * It reads the migration as text. That is unusual and deliberate — the point is
 * to compare two independent definitions, and importing one of them would
 * defeat it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEAD_INTAKE_PLANNER_VERSION,
  LEAD_INTAKE_PLANNER_VERSIONS,
  PUBLIC_CONSULT_V1_PLANNER_VERSION,
  PUBLIC_CONSULT_V2_PLANNER_VERSION,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  PUBLIC_CONSULT_PLANNER_VERSION,
} from "../contracts.ts";
import { consultationToLeadRequest } from "../public/consultation-to-lead-request.ts";
import type { LeadFormAttribution } from "../public/lead-form-attribution.ts";

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

const V4_MIGRATION =
  "supabase/migrations/20260908140000_public_unified_form_v4.sql";
const V3_MIGRATION =
  "supabase/migrations/20260907150000_public_requirement_form_v3.sql";
const V2_MIGRATION =
  "supabase/migrations/20260907130000_public_consultation_single_step_v2.sql";
const V1_MIGRATION =
  "supabase/migrations/20260905120000_public_consultation_qualifier.sql";
const SERVER = "src/features/lead-intake/server/lead-intake-validation.ts";

const attribution: LeadFormAttribution = { landingPath: "/" };
const BASE = {
  name: "Asha Menon",
  mobile: "9876543210",
  consent: { serviceEnquiry: true, servicePhone: true } as const,
  attribution,
  antiBot: { website: "", formStartedAt: FORM_STARTED_AT },
  idempotencyKey: "contract-1",
};

/* ========================================================================== */
/* 1. The two layers accept the same set of versions                           */
/* ========================================================================== */

describe("every version TypeScript accepts has an SQL branch", () => {
  /*
   * The NEWEST migration is the one under test: `create or replace` means the
   * last definition wins, so that file is what the database actually runs, and
   * therefore what the TypeScript has to agree with.
   */
  const sql = read(V4_MIGRATION);

  test("there are exactly five, and they are the five", () => {
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
    assert.equal(LEAD_INTAKE_PLANNER_VERSION, "home-r4-v1");
    assert.equal(PUBLIC_CONSULT_V1_PLANNER_VERSION, "public-consult-v1");
    assert.equal(PUBLIC_CONSULT_V2_PLANNER_VERSION, "public-consult-v2");
    assert.equal(PUBLIC_CONSULT_V3_PLANNER_VERSION, "public-consult-v3");
    assert.equal(PUBLIC_CONSULT_V4_PLANNER_VERSION, "public-consult-v4");
  });

  test("the SQL allowlist is the same list", () => {
    const allowlist = /p_planner_version not in \(\s*([^)]*)\)/.exec(sql);
    assert.ok(allowlist, "the SQL must carry a planner-version allowlist");
    const listed = [...allowlist![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), [...LEAD_INTAKE_PLANNER_VERSIONS].sort());
  });

  test("each version has its own discriminator branch in the SQL", () => {
    assert.match(sql, /if p_planner_version = 'home-r4-v1' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v1' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v2' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v3' then/);
    assert.match(sql, /elsif p_planner_version = 'public-consult-v4' then/);
  });

  test("and its own branch in the TypeScript validator", () => {
    const server = read(SERVER);
    assert.match(server, /PUBLIC_CONSULT_V1_PLANNER_VERSION/);
    assert.match(server, /PUBLIC_CONSULT_V2_PLANNER_VERSION/);
    assert.match(server, /PUBLIC_CONSULT_V3_PLANNER_VERSION/);
    assert.match(server, /const isPublicConsultV1 =/);
    assert.match(server, /const isPublicConsultV2 =/);
    assert.match(server, /const isPublicConsultV3 =/);
    assert.match(server, /const isPublicConsultV4 =/);
  });
});

/* ========================================================================== */
/* 2. The homepage adapter emits the version whose rules it obeys              */
/* ========================================================================== */

describe("the interiors-planner consultation form still speaks v2", () => {
  /*
   * `consultationToLeadRequest` is no longer what the HOMEPAGE uses — the
   * homepage now mounts the requirement form, which speaks v3 and is covered by
   * `premium-requirement-form.test.ts`. This adapter still serves the planner
   * surfaces, and it must still emit the version whose rules it obeys rather
   * than following whatever the current default happens to be.
   */
  test("the adapter emits public-consult-v2", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "modular-kitchens",
      qualifierCode: null,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.body.plannerVersion, "public-consult-v2");
    assert.equal(PUBLIC_CONSULT_PLANNER_VERSION, "public-consult-v4");
    assert.notEqual(result.body.plannerVersion, PUBLIC_CONSULT_PLANNER_VERSION);
  });

  test("and sends none of the fields v2 forbids", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "complete-home-interiors",
      qualifierCode: null,
      locality: "Kharadi",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const forbidden of [
      "qualifier",
      "property",
      "timeline",
      "rooms",
      "budgetComfort",
      "estimate",
    ]) {
      assert.equal(
        forbidden in result.body.requirements,
        false,
        `v2 must not send ${forbidden}`
      );
    }
    // What it DOES send is what the form asked for.
    assert.equal(result.body.requirements.service, "complete-home-interiors");
    assert.equal(result.body.requirements.locality, "Kharadi");
  });
});

/* ========================================================================== */
/* 3. v2 rejects the same things in both layers                                */
/* ========================================================================== */

describe("v2 forbids the unasked fields on both sides of the boundary", () => {
  test("TypeScript refuses a qualifier under v2", () => {
    const result = consultationToLeadRequest({
      ...BASE,
      service: "modular-kitchens",
      qualifierCode: "new-kitchen",
    });
    assert.equal(result.ok, false, "a valid code is still not asked for");
    if (result.ok) return;
    assert.ok(result.fields.includes("requirements.qualifier"));
  });

  test("the SQL v2 branch refuses each of them by name", () => {
    const sql = read(V3_MIGRATION);
    const branch = sql.slice(
      sql.indexOf("elsif p_planner_version = 'public-consult-v2' then"),
      sql.indexOf("\n  end if;", sql.indexOf("elsif p_planner_version = 'public-consult-v2' then"))
    );
    for (const rejection of [
      "qualifier_not_asked",
      "property_not_asked",
      "timeline_not_asked",
      "rooms_not_asked",
      "budget_not_asked",
      "estimate_not_asked",
    ]) {
      assert.match(
        branch,
        new RegExp(`raise exception 'validation: ${rejection}'`),
        `the v2 branch must refuse ${rejection}`
      );
    }
  });

  test("the TypeScript server branch refuses the same set", () => {
    const server = read(SERVER);
    /*
     * v2 and v3 share every prohibition, so the server states them once against
     * a flag that both versions set. That flag IS the branch.
     */
    assert.match(server, /const forbidsQualifier =/);
    const at = server.indexOf("if (forbidsQualifier) {");
    assert.ok(at > 0, "the shared prohibition branch must exist");
    const branch = server.slice(at, at + 900);
    assert.match(branch, /fields\.push\("requirements\.qualifier"\)/);
    assert.match(branch, /fields\.push\("requirements\.property"\)/);
    // timeline, rooms, budget and estimate are refused by the shared
    // unasked-field loop that both public versions run.
    /*
     * The timeline is the one field that MOVES between versions: v1, v2 and v3
     * reject it, v4 requires it. The shared loop therefore drops "timeline"
     * from its list under v4 rather than listing it unconditionally, and v4
     * validates it separately just below.
     */
    assert.match(server, /isPublicConsultV4 \? \[\] : \(\["timeline"\] as const\)/);
    assert.match(server, /if \(isPublicConsultV4\) \{[\s\S]{0,300}LEAD_TIMELINE_CODES/);
  });
});

/* ========================================================================== */
/* 4. v1 still requires its qualifier, in both layers                          */
/* ========================================================================== */

describe("v1 was not redefined underneath the rows that depend on it", () => {
  test("the SQL still raises qualifier_required for v1", () => {
    for (const rel of [V1_MIGRATION, V2_MIGRATION, V3_MIGRATION]) {
      const sql = read(rel);
      const at = sql.indexOf("elsif p_planner_version = 'public-consult-v1' then");
      assert.ok(at > 0, `${rel} must carry the v1 branch`);
      const branch = sql.slice(at, at + 400);
      assert.match(branch, /raise exception 'validation: qualifier_required'/);
    }
  });

  test("the original v1 migration is untouched by this change", () => {
    /*
     * The V2 migration is forward-only. If the v1 file ever loses its
     * `qualifier_required`, somebody edited history rather than adding to it.
     */
    const v1 = read(V1_MIGRATION);
    assert.match(v1, /raise exception 'validation: qualifier_required'/);
    assert.doesNotMatch(v1, /public-consult-v2/);
  });

  test("TypeScript still requires it for v1 and never for v2", () => {
    const server = read(SERVER);
    // v1 falls through to the strict qualifier object check.
    assert.match(server, /\} else if \(!isPlainObject\(input\.requirements\.qualifier\)\) \{/);
    assert.match(server, /LEAD_QUALIFIER_KIND_BY_SERVICE\[service as LeadServiceCode\] !== kind/);
  });

  test("the newest migration replaces the function rather than rewriting history", () => {
    const sql = read(V3_MIGRATION);
    assert.match(sql, /create or replace function public\.submit_lead_intake\(/);
    /*
     * One drop is expected here, and it is not a rollback. Adding two DEFAULTED
     * arguments creates an OVERLOAD rather than a replacement, and leaving both
     * in place would make a 29-argument call ambiguous. The old shape is
     * therefore retired AFTER the new one exists, so no window passes with no
     * function present.
     */
    const drops = sql.match(/drop function/gi) ?? [];
    assert.equal(drops.length, 1, "exactly one overload is retired");
    assert.ok(
      sql.indexOf("create or replace function") < sql.indexOf("drop function"),
      "the replacement must exist before the old overload is dropped"
    );
    // And the definer boundary it enforces survives verbatim.
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /grant execute on function public\.submit_lead_intake\(/);
    assert.match(sql, /from public, anon, authenticated/);
  });

  test("no default is invented anywhere in the v2 branch", () => {
    const sql = read(V3_MIGRATION);
    const at = sql.indexOf("elsif p_planner_version = 'public-consult-v2' then");
    /*
     * Comment-stripped: the branch DESCRIBES the defaults it refuses to invent,
     * and a check that trips on prose is a check that teaches you to write less
     * of it.
     */
    const branch = sql
      .slice(at, sql.indexOf("\n  end if;", at))
      .replace(/--.*/g, "");
    // No assignment at all: the branch only refuses.
    assert.doesNotMatch(branch, /:=/);
    assert.doesNotMatch(branch, /'unsure'/);
    assert.doesNotMatch(branch, /apartment-/);
    assert.doesNotMatch(branch, /coalesce/i);
  });
});
