/**
 * The generated/handwritten type boundary.
 *
 * Two different things are checked here, and they need different tools.
 *
 * The TYPE assertions below compile to nothing and run nothing. They are
 * checked by `npm run typecheck`, which covers this file, and a violated one is
 * a compile error rather than a failed assertion. That is the only honest way
 * to test a type: asserting on the text of `database.ts` would pass on a file
 * that says the right thing and means something else.
 *
 * The RUNTIME assertions cover what is genuinely a file-level fact — which
 * module each Supabase client imports, that the generated file carries no hand
 * edits, that the tooling names the schema this repository decided on.
 *
 * The type imports are erased before Node sees this file, which is why they use
 * the `@/` alias the test runner cannot resolve.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { Database } from "@/types/database";
import type { Database as GeneratedDatabase } from "@/types/database.generated";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

// --------------------------------------------------------------- type tools ---

/** Fails to compile unless the argument is exactly `true`. */
type Expect<Condition extends true> = Condition;

/** Invariant equality — `Equals<string, any>` is false, unlike `extends`. */
type Equals<Left, Right> =
  (<Probe>() => Probe extends Left ? 1 : 2) extends <Probe>() => Probe extends Right ? 1 : 2
    ? true
    : false;

type AcceptsNull<Value> = null extends Value ? true : false;
type MayBeOmitted<Value> = undefined extends Value ? true : false;

type Fn<Name extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][Name];
type Args<Name extends keyof Database["public"]["Functions"]> = Fn<Name> extends {
  Args: infer A;
}
  ? A
  : never;

type RawArgs<Name extends keyof GeneratedDatabase["public"]["Functions"]> =
  GeneratedDatabase["public"]["Functions"][Name] extends { Args: infer A } ? A : never;

// ------------------------------------------------- C. nullable RPC overrides ---

/*
 * Each pair proves the same thing twice: the application type accepts SQL NULL,
 * and the RAW generated type does not. The second half is what makes these
 * tests worth having — without it they would still pass if the overlay were
 * deleted and the generator happened to change its mind.
 */

// A required argument whose routine branches on NULL.
type _CampaignReferenceAcceptsNull = Expect<
  Equals<AcceptsNull<Args<"create_landing_publication">["p_campaign_reference"]>, true>
>;
type _RawCampaignReferenceRejectsNull = Expect<
  Equals<AcceptsNull<RawArgs<"create_landing_publication">["p_campaign_reference"]>, false>
>;
type _CampaignVersionAcceptsNull = Expect<
  Equals<AcceptsNull<Args<"create_landing_publication">["p_campaign_version_number"]>, true>
>;

// A `DEFAULT NULL` argument: still optional, and now also explicitly nullable.
type _OwnerIdAcceptsNull = Expect<Equals<AcceptsNull<Args<"get_crm_my_day">["p_owner_id"]>, true>>;
type _OwnerIdStaysOptional = Expect<
  Equals<MayBeOmitted<Args<"get_crm_my_day">["p_owner_id"]>, true>
>;
type _RawOwnerIdRejectsNull = Expect<
  Equals<AcceptsNull<RawArgs<"get_crm_my_day">["p_owner_id"]>, false>
>;
type _RawOwnerIdWasAlreadyOptional = Expect<
  Equals<MayBeOmitted<RawArgs<"get_crm_my_day">["p_owner_id"]>, true>
>;

// The exposure recorder, whose routine validates its three required arguments
// and deliberately does not check these two.
type _ExposureExperimentAcceptsNull = Expect<
  Equals<AcceptsNull<Args<"record_landing_exposure">["p_experiment_id"]>, true>
>;
type _ExposureVariantAcceptsNull = Expect<
  Equals<AcceptsNull<Args<"record_landing_exposure">["p_variant_key"]>, true>
>;

// Everything else about an overridden function is untouched.
type _ExposurePublicationStaysRequired = Expect<
  Equals<AcceptsNull<Args<"record_landing_exposure">["p_publication_id"]>, false>
>;
type _ExposureVisitorHashStaysRequired = Expect<
  Equals<AcceptsNull<Args<"record_landing_exposure">["p_visitor_key_hash"]>, false>
>;
type _ExposureReturnsUnchanged = Expect<
  Equals<Fn<"record_landing_exposure">["Returns"], GeneratedDatabase["public"]["Functions"]["record_landing_exposure"]["Returns"]>
>;

// ------------------------------------------ F. managed PostgREST runtime version ---

/*
 * supabase-js selects type-level feature flags from
 * `Database["__InternalSupabase"]["PostgrestVersion"]`. In the installed
 * version its default is `{ PostgrestVersion: "12" }` when the key is absent,
 * so a Database type without it does not merely omit information — it asserts
 * PostgREST 12, and `MaxAffectedEnabled` / `SpreadOnManyEnabled` come out false
 * against a managed runtime that is 14.5.
 *
 * The value cannot come from local generation: `--local` would report the
 * PostgREST inside the developer's Docker stack, and the checked-in schema file
 * is deliberately independent of any deployed environment. It is therefore
 * pinned in the overlay, which is the same reason the nullable arguments are.
 */
type _ApplicationPostgrestVersion = Expect<
  Equals<Database["__InternalSupabase"]["PostgrestVersion"], "14.5">
>;

/*
 * Not widened to `string`. A widened version silently disables the version
 * feature flags again — `IsPostgrest14<string>` is false — so the literal is
 * the whole point.
 */
type _PostgrestVersionIsNotString = Expect<
  Equals<Equals<Database["__InternalSupabase"]["PostgrestVersion"], string>, false>
>;
type _PostgrestVersionSatisfiesFourteen = Expect<
  Database["__InternalSupabase"]["PostgrestVersion"] extends `14${string}` ? true : false
>;

/*
 * The block holds the version and nothing else, so a future generated field
 * cannot arrive unreviewed by way of the overlay.
 *
 * This assertion is also what makes the replacement robust. The overlay OMITS
 * `__InternalSupabase` from the generated type before adding its own, so if
 * local typegen ever starts emitting a version of its own, the application type
 * is still exactly "14.5" — where an intersection would have produced
 * `"14.5" & "<other>"`, which is `never`, and the client would silently fall
 * back to its default.
 */
type _InternalBlockHoldsOnlyTheVersion = Expect<
  Equals<keyof Database["__InternalSupabase"], "PostgrestVersion">
>;

/*
 * The gate supabase-js itself applies, restated rather than copied: its client
 * takes `Database["__InternalSupabase"]` when the Database matches this shape
 * and `{ PostgrestVersion: "12" }` when it does not. The pair proves the
 * overlay is what satisfies it — the raw generated type does not, which is the
 * whole reason this correction exists.
 */
type SupabaseJsInternalGate = { __InternalSupabase: { PostgrestVersion: string } };
type _ApplicationTypeSatisfiesTheGate = Expect<
  Database extends SupabaseJsInternalGate ? true : false
>;
type _GeneratedTypeAloneDoesNot = Expect<
  Equals<GeneratedDatabase extends SupabaseJsInternalGate ? true : false, false>
>;

// ------------------------------------------------------- E. no broad weakening ---

/*
 * The overlay is an allowlist. A function that is not on it must come through
 * byte-identical, and no argument anywhere may quietly become nullable.
 */
type _UnrelatedRpcUnchanged = Expect<
  Equals<Fn<"reconcile_staff_invite">, GeneratedDatabase["public"]["Functions"]["reconcile_staff_invite"]>
>;
type _UnrelatedArgumentStaysNonNull = Expect<
  Equals<AcceptsNull<Args<"reconcile_staff_invite">["p_client_request_id"]>, false>
>;
type _NonOverriddenArgOfOverriddenFnStaysNonNull = Expect<
  Equals<AcceptsNull<Args<"create_landing_publication">["p_idempotency_key"]>, false>
>;
type _ProviderStatusNotWidened = Expect<
  Equals<AcceptsNull<Args<"bind_campaign_run_operation">["p_provider_status"]>, false>
>;
type _TargetMonthNotWidened = Expect<
  Equals<AcceptsNull<Args<"get_crm_management_analytics">["p_target_month"]>, false>
>;

// Tables, views, enums and composite types pass through exactly as generated.
type _TablesUntouched = Expect<
  Equals<Database["public"]["Tables"], GeneratedDatabase["public"]["Tables"]>
>;
type _ViewsUntouched = Expect<
  Equals<Database["public"]["Views"], GeneratedDatabase["public"]["Views"]>
>;
type _EnumsUntouched = Expect<
  Equals<Database["public"]["Enums"], GeneratedDatabase["public"]["Enums"]>
>;
type _CompositesUntouched = Expect<
  Equals<Database["public"]["CompositeTypes"], GeneratedDatabase["public"]["CompositeTypes"]>
>;
type _FunctionNamesUnchanged = Expect<
  Equals<keyof Database["public"]["Functions"], keyof GeneratedDatabase["public"]["Functions"]>
>;

// --------------------------------------------- D. surfaces that were missing ---

/*
 * These tables and functions existed in the database and were absent from the
 * checked-in types. Naming a few of them in the type system means a regression
 * to a stale file cannot compile.
 */
type _SalaryStatementsExist = Expect<
  Equals<Database["public"]["Tables"]["salary_statements"]["Row"] extends { id: string } ? true : false, true>
>;
type _SalaryPaymentsExist = Expect<
  Equals<Database["public"]["Tables"]["salary_payments"]["Row"] extends { id: string } ? true : false, true>
>;
type _AttendanceSubmissionsExist = Expect<
  Equals<
    // Keyed by staff and date rather than a surrogate id, so this names the
    // columns the table actually has.
    Database["public"]["Tables"]["attendance_submissions"]["Row"] extends {
      staff_id: string;
      attendance_date: string;
      lifecycle_state: string;
    }
      ? true
      : false,
    true
  >
>;
type _SubmitAttendanceDayExists = Expect<
  Equals<"submit_attendance_day" extends keyof Database["public"]["Functions"] ? true : false, true>
>;
type _RecordSalaryPaymentExists = Expect<
  Equals<"record_salary_payment" extends keyof Database["public"]["Functions"] ? true : false, true>
>;

// The v4 lead contract, which is why the file was hand-patched in the first place.
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type _LeadScopeCode = Expect<Equals<LeadRow["project_scope_code"], string | null>>;
type _LeadBudgetRangeCode = Expect<Equals<LeadRow["budget_range_code"], string | null>>;
type _PortfolioCategory = Expect<
  Equals<Database["public"]["Tables"]["portfolio_projects"]["Row"]["portfolio_category_code"], string | null>
>;
type _PortfolioMediaRoomCategory = Expect<
  Equals<Database["public"]["Tables"]["portfolio_media"]["Row"]["room_category_code"], string | null>
>;

// ------------------------------------------------------------------ runtime ---

describe("A. the generated file is machine output", () => {
  const generated = read("src/types/database.generated.ts");
  const typegen = read("scripts/lib/database-typegen.mjs");

  test("the tooling owns exactly one path", () => {
    assert.match(typegen, /"database\.generated\.ts"/);
    assert.match(typegen, /GENERATED_TYPES_FILE/);
  });

  test("the canonical schema choice is pinned to public", () => {
    // `graphql_public` was in the historical output and nothing imports it;
    // keeping it would have meant carrying a schema the application never
    // speaks to. Pinning the choice here makes a silent widening fail.
    assert.match(typegen, /CANONICAL_SCHEMAS = "public"/);
    assert.ok(!generated.includes("graphql_public:"), "public schema only");
  });

  test("the generated file carries no hand edits", () => {
    /*
     * Not a proof — nothing in a file can prove that — but the markers a hand
     * repair leaves behind. The real guarantee is `verify:db-types`, which
     * regenerates and compares.
     */
    for (const marker of ["@ts-ignore", "@ts-expect-error", "eslint-disable", "TODO", "HACK"]) {
      assert.ok(!generated.includes(marker), `generated file contains ${marker}`);
    }
  });

  test("the drift guard regenerates and never writes", () => {
    const verifier = read("scripts/verify-database-types.mjs");
    assert.match(verifier, /generateDatabaseTypes/);
    assert.match(verifier, /readCheckedInTypes/);
    assert.ok(!/writeFileSync/.test(verifier), "a guard that repairs what it measures cannot fail");
  });

  test("the previously missing surfaces are present", () => {
    for (const surface of [
      "attendance_submissions:",
      "attendance_submission_events:",
      "salary_statements:",
      "salary_statement_lines:",
      "salary_statement_events:",
      "salary_profiles:",
      "salary_payments:",
      "submit_attendance_day:",
      "approve_attendance_day:",
      "record_salary_payment:",
      "sync_staff_access_states:",
    ]) {
      assert.ok(generated.includes(surface), `${surface} missing from generated types`);
    }
  });
});

describe("B. runtime code uses the application type", () => {
  const clients = [
    "src/lib/supabase/client.ts",
    "src/lib/supabase/server.ts",
    "src/lib/supabase/service-role.ts",
    "src/lib/supabase/admin.ts",
    "src/lib/supabase/bearer.ts",
    "src/lib/supabase/proxy.ts",
  ];

  test("every client factory is parameterised by the overlay", () => {
    for (const file of clients) {
      const source = read(file);
      assert.match(source, /from "(@\/types\/database|(?:\.\.\/)+types\/database\.ts)"/, file);
      assert.ok(!source.includes("database.generated"), `${file} still uses the raw types`);
    }
  });

  test("nothing else in runtime code imports the generated file directly", () => {
    /*
     * Half the clients on corrected types and half on raw types would be worse
     * than either, because the difference would surface as an arbitrary compile
     * error in whichever call site happened to pass null.
     */
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const full = path.join(directory, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "__tests__" || entry === "node_modules") continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        const relative = path.relative(root, full).replace(/\\/g, "/");
        if (relative === "src/types/database.ts" || relative === "src/types/database.generated.ts") {
          continue;
        }
        if (readFileSync(full, "utf8").includes("database.generated")) offenders.push(relative);
      }
    };
    walk(path.join(root, "src"));
    assert.deepEqual(offenders, []);
  });
});

describe("the managed PostgREST version is owned by the overlay", () => {
  const overlay = read("src/types/database.ts");
  const generated = read("src/types/database.generated.ts");

  test("the overlay pins the observed managed version as a literal", () => {
    // The type assertions above prove the Database type carries "14.5". This
    // proves the exported constant they derive from says so too, which is what
    // a release audit reads when re-confirming against the managed project.
    assert.match(overlay, /MANAGED_POSTGREST_VERSION = "14\.5" as const/);
  });

  test("the version is static, not read from the environment at runtime", () => {
    /*
     * A version resolved at runtime would be useless: supabase-js consumes it
     * at COMPILE time to pick feature flags, so it has to be a literal in
     * reviewed source. It also keeps CI credential-free — nothing has to reach
     * the managed project to typecheck.
     */
    const version = overlay.slice(overlay.indexOf("MANAGED_POSTGREST_VERSION"));
    assert.ok(!/process\.env/.test(version), "the version must not come from the environment");
    assert.ok(!/await |fetch\(/.test(version), "the version must not be fetched");
  });

  test("the generated file does not carry a hosted runtime version", () => {
    /*
     * Local generation reports the PostgREST inside a developer's Docker stack,
     * which is not what production runs, and the checked-in schema file is
     * deliberately independent of any deployed environment. If this ever fails,
     * local typegen has started emitting a version: check whether it is the
     * hosted one before changing anything. The overlay omits the key before
     * adding its own, so the application type is unaffected either way.
     */
    assert.ok(
      !generated.includes("PostgrestVersion"),
      "local typegen has started emitting a PostgREST version; see src/types/database.ts"
    );
  });
});

describe("the overlay stays a narrow correction", () => {
  const overlay = read("src/types/database.ts");
  const generated = read("src/types/database.generated.ts");

  test("it is a fraction of the generated surface", () => {
    // Not a style rule: an overlay that grows toward the size of the generated
    // file has stopped being a correction and become a second, divergent copy
    // of the schema.
    const overlayLines = overlay.split("\n").length;
    const generatedLines = generated.split("\n").length;
    assert.ok(
      overlayLines < generatedLines / 10,
      `overlay is ${overlayLines} lines against ${generatedLines} generated`
    );
  });

  test("it names its overrides and nothing broader", () => {
    const allowlist = overlay.slice(overlay.indexOf("NULLABLE_RPC_ARGUMENT_OVERRIDES"));
    for (const fn of [
      "authorize_commerce_product_media_upload",
      "bind_campaign_run_operation",
      "create_landing_publication",
      "get_crm_management_analytics",
      "get_crm_my_day",
      "get_crm_pipeline_value_summary",
      "record_landing_exposure",
      "save_landing_experiment_draft",
      "set_portfolio_media_room_category",
      "verify_live_landing_publication_context",
    ]) {
      assert.ok(allowlist.includes(fn), `${fn} missing from the documented allowlist`);
    }
  });

  test("no escape hatches", () => {
    for (const file of ["src/types/database.ts", "scripts/lib/database-typegen.mjs"]) {
      const source = read(file);
      assert.ok(!/\bas any\b/.test(source), `${file} uses as any`);
      assert.ok(!/unknown as/.test(source), `${file} uses an unknown cast`);
      assert.ok(!/@ts-ignore|@ts-expect-error/.test(source), `${file} suppresses the compiler`);
    }
  });
});
