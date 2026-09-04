import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Canonical mobile CRM read contract.
 *
 * The Owner mobile app needs the lead score, the effective sales bucket and the
 * sales-priority ranking. All three are derived in server TypeScript, not SQL,
 * so Android cannot read them from PostgREST and must not recompute them.
 *
 * These endpoints close that gap by running the EXISTING read models for a
 * bearer-authenticated caller. What this file guards is that they stayed thin:
 * no second intelligence engine, no privilege escalation, and no change to how
 * the browser workspace already resolves access.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

const BEARER = read("src", "lib", "supabase", "bearer.ts");
const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);
const LEADS_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "route.ts"
);
const PIPELINE_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "pipeline", "route.ts"
);
const CRM_DB = read(
  "src", "features", "crm", "server", "crm-db.ts"
);
const CRM_AUTH = read(
  "src", "features", "crm", "server", "crm-auth.ts"
);

const ROUTES = [
  ["leads", LEADS_ROUTE],
  ["pipeline", PIPELINE_ROUTE],
] as const;

/* Comments explain what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

describe("no service-role bypass", () => {
  test("the bearer client uses the publishable key only", () => {
    assert.match(BEARER, /getPublicSupabaseEnv/);
    assert.match(BEARER, /publishableKey/);
  });

  test("no mobile read path can reach service-role credentials", () => {
    /*
     * The whole security argument rests on this: the endpoint is the caller,
     * so RLS and authorize() decide what it sees. A service-role client here
     * would silently turn every policy off.
     */
    for (const [name, source] of [
      ["bearer", BEARER],
      ["mobile-auth", MOBILE_AUTH],
      ["crm-db", CRM_DB],
      ...ROUTES,
    ] as const) {
      for (const forbidden of [
        "service-role",
        "serviceRole",
        "SERVICE_ROLE",
        "createAdminClient",
        "sb_secret_",
      ]) {
        assert.ok(
          !code(source).includes(forbidden),
          `${name} must not reference ${forbidden}`
        );
      }
    }
  });

  test("the token is verified with the auth server, not trusted locally", () => {
    /* getClaims would decode without verifying; getUser round-trips. */
    assert.match(MOBILE_AUTH, /auth\.getUser\(\)/);
  });
});

describe("caller identity is preserved", () => {
  test("mobile auth reuses the same resolveCrmAccess as the web workspace", () => {
    assert.match(MOBILE_AUTH, /resolveCrmAccess/);

    /* It supplies the caller; it does not assemble its own permission set. */
    assert.ok(
      !code(MOBILE_AUTH).includes("canReadBroad:"),
      "mobile auth must not build its own CrmAccessContext"
    );
  });

  test("an unauthenticated or unentitled caller never reaches a query", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      const authAt = body.indexOf("resolveCrmMobileAuth");
      const guardAt = body.indexOf('auth.kind !== "granted"');

      assert.ok(authAt >= 0, `${name} must resolve auth`);
      assert.ok(guardAt > authAt, `${name} must guard before querying`);

      /* The CALL, not the import that also names it. */
      const queryAt = Math.max(
        body.indexOf("await queryLeadListPage("),
        body.indexOf("await fetchCrmPipelineBoard(")
      );

      assert.ok(
        queryAt > guardAt,
        `${name} must query only after the guard`
      );
    }
  });

  test("inactive and denied answer the same 403", () => {
    /*
     * Telling an unauthorised caller WHY they were refused tells them what
     * exists. Both map to forbidden.
     */
    assert.match(MOBILE_AUTH, /forbidden:\s*403/);
    assert.match(MOBILE_AUTH, /unauthenticated:\s*401/);
  });
});

describe("the endpoints stay thin", () => {
  test("neither route contains CRM derivation", () => {
    /*
     * The point of the endpoints is that the intelligence lives in one place.
     * A score weight or bucket rule appearing here is the drift they exist to
     * prevent.
     */
    for (const [name, source] of ROUTES) {
      for (const forbidden of [
        "deriveLeadScore",
        "resolveEffectiveSalesBucket",
        "sortSegmentedLeads",
        "resolveScoreBand",
        "NURTURE",
      ]) {
        assert.ok(
          !code(source).includes(forbidden),
          `${name} must not perform ${forbidden}`
        );
      }
    }
  });

  test("leads reuses the canonical query parser", () => {
    /* One place decides what a valid lead query is. */
    assert.match(LEADS_ROUTE, /parseLeadListQuery/);
    assert.match(LEADS_ROUTE, /queryLeadListPage/);
  });

  test("pipeline reuses the canonical board read", () => {
    assert.match(PIPELINE_ROUTE, /fetchCrmPipelineBoard/);
  });

  test("both expose GET only", () => {
    for (const [name, source] of ROUTES) {
      assert.match(source, /export async function GET/);

      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        assert.ok(
          !new RegExp(
            `export async function ${method}\\b`
          ).test(source),
          `${name} must not expose ${method}`
        );
      }
    }
  });
});

describe("error envelope leaks nothing", () => {
  test("failures answer a category, not a server message", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      assert.ok(
        body.includes("crmMobileError"),
        `${name} must use the shared envelope`
      );

      /* The caught error is logged server-side, never returned. */
      assert.ok(
        !/return[^;]*error\.message/.test(body),
        `${name} must not return a raw error message`
      );

      assert.ok(
        !body.includes("error.stack"),
        `${name} must not return a stack trace`
      );
    }
  });

  test("the categories the mobile client branches on are stable", () => {
    for (const category of [
      "unauthenticated",
      "forbidden",
      "invalid_request",
      "conflict",
      "unavailable",
    ]) {
      assert.ok(
        MOBILE_AUTH.includes(category),
        `missing error category ${category}`
      );
    }
  });
});

describe("the refactor is additive", () => {
  /*
   * The read chain now accepts an optional client so one request can run as a
   * bearer caller. Every existing web caller passes nothing, so if any of these
   * parameters were ever made required the browser workspace would break.
   */
  const THREADED = [
    ["crm-permissions.ts", 8],
    ["crm-lead-queries.ts", 7],
    ["crm-lead-score-batch.ts", 7],
    ["crm-lead-commercial-queries.ts", 2],
    ["crm-pipeline-queries.ts", 1],
  ] as const;

  test("every injected client parameter is optional", () => {
    for (const [file] of THREADED) {
      const source = read(
        "src", "features", "crm", "server", file
      );

      assert.ok(
        source.includes("db?: CrmDb"),
        `${file} must take an OPTIONAL client`
      );

      assert.ok(
        !/db:\s*CrmDb[,)]/.test(source),
        `${file} must not require a client`
      );
    }
  });

  test("each threaded module resolves through the shared helper", () => {
    for (const [file, sites] of THREADED) {
      const source = read(
        "src", "features", "crm", "server", file
      );

      const count =
        source.split("resolveCrmDb(db)").length - 1;

      assert.equal(
        count,
        sites,
        `${file} should resolve ${sites} client(s), found ${count}`
      );

      /* No module in the chain may still create its own client. */
      assert.ok(
        !source.includes("await createClient()"),
        `${file} must not bypass the resolver`
      );
    }
  });

  test("the resolver defaults to the cookie client", () => {
    /* This is what keeps every existing web caller working unchanged. */
    assert.match(CRM_DB, /db \?\? \(await createClient\(\)\)/);
  });

  test("resolveCrmAccess still works with no arguments", () => {
    /*
     * The web workspace calls it bare in a dozen places; the options bag must
     * stay optional or those callers stop compiling.
     */
    assert.match(
      CRM_AUTH,
      /export async function resolveCrmAccess\([\s\S]{0,240}?=\s*\{\}\s*\)/
    );
  });
});
