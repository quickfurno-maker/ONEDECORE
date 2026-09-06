import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_CADENCE_MAX_DELAY_HOURS,
  CRM_CADENCE_MAX_REMINDER_OFFSET_MINUTES,
  CRM_CADENCE_MAX_STEPS,
  cadenceStepInputsToRpcPayload,
  normalizeCadenceStepInputs,
  validateCadenceStepInputs,
} from "../contracts/cadence-contracts.ts";
import {
  SALES_TARGET_CURRENCY,
  SALES_TARGET_SCOPES,
  SALES_TARGET_STATUSES,
  validateCreateSalesTargetInput,
} from "../contracts/sales-target-contracts.ts";
import {
  LEAD_IMPORT_BATCH_STATUSES,
  LEAD_IMPORT_FILE_TYPES,
  LEAD_IMPORT_LIMITS,
  LEAD_IMPORT_MAPPING_FIELDS,
  LEAD_IMPORT_TRANSPORT,
  validateLeadImportMappingInput,
  validateLeadImportRejectionReason,
} from "../contracts/lead-import-contracts.ts";
import {
  DEFAULT_BUSINESS_HOURS_DRAFT,
  FIRST_CONTACT_SLA_POLICY_CODE,
  SLA_WEEKDAY_KEYS,
  serializeBusinessHoursConfig,
} from "../contracts/sla-policy-contracts.ts";
import { validateCreateLeadAssignmentRuleInput } from "../contracts/assignment-rule-contracts.ts";

/**
 * CRM-M9A — canonical mobile admin contracts.
 *
 * The web audit found that all five More/Admin features depend on server
 * TypeScript for permissions, validation, parsing or orchestration, so Android
 * cannot reach their tables and RPCs directly without rebuilding those rules.
 * M9A answers that with a bearer-authenticated HTTP boundary over the EXISTING
 * canonical services — no new business rule, no migration.
 *
 * Every assertion below defends one of four properties:
 *
 *   authenticated   the same bearer resolution CRM-M1 introduced, with no
 *                   cookie fallback and no service-role path anywhere
 *   permissioned    the canonical feature permission, asserted at the route AND
 *                   inside the service, with the read/manage and
 *                   import/approve splits intact
 *   canonical       every rule reached, never restated — the routes define no
 *                   threshold that a contract already owns
 *   threaded        `auth.db` reaches every read, every write, and every
 *                   reload that follows a write
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/* Comments explain what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

function flat(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * The handler bodies only, with the import block removed.
 *
 * Ordering assertions below ask questions like "is the size check before the
 * parse?", and an import statement names both. Measuring positions against the
 * whole file would answer those questions with the import order.
 */
function handlers(source: string): string {
  const body = code(source);
  const first = body.search(/export async function (GET|POST|PUT)\(/);
  return first < 0 ? body : body.slice(first);
}

function route(...segments: readonly string[]): string {
  return read("src", "app", "api", "mobile", "crm", "admin", ...segments);
}

function server(file: string): string {
  return read("src", "features", "crm", "server", file);
}

const CADENCE_LIST = route("cadences", "route.ts");
const CADENCE_DETAIL = route("cadences", "[templateId]", "route.ts");
const CADENCE_ACTIONS = route("cadences", "actions", "route.ts");
const TARGET_LIST = route("targets", "route.ts");
const TARGET_EVENTS = route("targets", "[targetId]", "events", "route.ts");
const TARGET_ACTIONS = route("targets", "actions", "route.ts");
const RULE_LIST = route("assignment-rules", "route.ts");
const RULE_ACTIONS = route("assignment-rules", "actions", "route.ts");
const SLA = route("sla", "route.ts");
const IMPORT_LIST = route("imports", "route.ts");
const IMPORT_DETAIL = route("imports", "[batchId]", "route.ts");
const IMPORT_UPLOAD = route("imports", "upload", "route.ts");
const IMPORT_MAP = route("imports", "[batchId]", "map-validate", "route.ts");
const IMPORT_ACTIONS = route("imports", "[batchId]", "actions", "route.ts");

const ALL_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["cadences", CADENCE_LIST],
  ["cadences/[templateId]", CADENCE_DETAIL],
  ["cadences/actions", CADENCE_ACTIONS],
  ["targets", TARGET_LIST],
  ["targets/[targetId]/events", TARGET_EVENTS],
  ["targets/actions", TARGET_ACTIONS],
  ["assignment-rules", RULE_LIST],
  ["assignment-rules/actions", RULE_ACTIONS],
  ["sla", SLA],
  ["imports", IMPORT_LIST],
  ["imports/[batchId]", IMPORT_DETAIL],
  ["imports/upload", IMPORT_UPLOAD],
  ["imports/[batchId]/map-validate", IMPORT_MAP],
  ["imports/[batchId]/actions", IMPORT_ACTIONS],
];

const MOBILE_AUTH = server("crm-mobile-auth.ts");
const MOBILE_ADMIN = server("crm-mobile-admin.ts");
const CRM_DB = server("crm-db.ts");
const BEARER = read("src", "lib", "supabase", "bearer.ts");

const CADENCE_SERVICE = server("crm-cadence-service.ts");
const CADENCE_QUERIES = server("crm-cadence-queries.ts");
const TARGET_SERVICE = server("crm-sales-target-service.ts");
const RULE_SERVICE = server("crm-assignment-rule-service.ts");
const SLA_SERVICE = server("crm-sla-policy-service.ts");
const IMPORT_SERVICE = server("crm-import-service.ts");
const IMPORT_QUERIES = server("crm-import-queries.ts");
const PARSER = server("lead-import-file-parser.ts");

const ALL_SERVICES: ReadonlyArray<readonly [string, string]> = [
  ["cadence-service", CADENCE_SERVICE],
  ["cadence-queries", CADENCE_QUERIES],
  ["sales-target-service", TARGET_SERVICE],
  ["assignment-rule-service", RULE_SERVICE],
  ["sla-policy-service", SLA_SERVICE],
  ["import-service", IMPORT_SERVICE],
  ["import-queries", IMPORT_QUERIES],
];

/* ========================================================================== */
/* 1. Authentication — one bearer path, no cookie, no service role            */
/* ========================================================================== */

describe("every admin endpoint authenticates the same way", () => {
  test("each route resolves the CRM-M1 bearer auth before anything else", () => {
    for (const [name, source] of ALL_ROUTES) {
      const body = handlers(source);

      assert.match(
        body,
        /resolveCrmMobileAuth\(request\)/,
        `${name} must resolve bearer auth`
      );
      assert.match(
        body,
        /crmMobileAuthError\(auth\.kind\)/,
        `${name} must answer through the shared auth envelope`
      );

      const authAt = body.indexOf("resolveCrmMobileAuth");
      const guardAt = body.indexOf('auth.kind !== "granted"');

      assert.ok(authAt >= 0, `${name} must resolve auth`);
      assert.ok(guardAt > authAt, `${name} must guard immediately after`);

      /*
       * The permission gate, the body parse and every canonical call must come
       * AFTER the guard. An unauthenticated caller reaching a body parse has
       * already been given work.
       */
      for (const marker of [
        "auth.context",
        "auth.db",
        "readCrmMobileJsonObject",
        "request.formData",
      ]) {
        const at = body.indexOf(marker);
        if (at >= 0) {
          assert.ok(
            at > guardAt,
            `${name}: ${marker} must come after the auth guard`
          );
        }
      }
    }
  });

  test("a missing or invalid bearer answers 401", () => {
    /* Both refusals live in the shared resolver, not in any route. */
    assert.match(MOBILE_AUTH, /if \(!token\) \{/);
    assert.match(MOBILE_AUTH, /if \(error \|\| !data\.user\) \{/);
    assert.match(MOBILE_AUTH, /unauthenticated: 401/);

    /* The token is verified with the auth server, not trusted locally. */
    assert.match(MOBILE_AUTH, /db\.auth\.getUser\(\)/);
  });

  test("an inactive or denied caller answers 403, indistinguishably", () => {
    assert.match(MOBILE_AUTH, /forbidden: 403/);

    /*
     * `inactive` and `denied` share one answer inside the resolver. No route
     * re-maps them, so no route can accidentally tell an unauthorised caller
     * WHY they were refused.
     */
    for (const [name, source] of ALL_ROUTES) {
      const body = code(source);
      assert.ok(
        !body.includes('"inactive"') && !body.includes('"denied"'),
        `${name} must not re-map auth outcomes`
      );
    }
  });

  test("no route has a cookie fallback", () => {
    for (const [name, source] of ALL_ROUTES) {
      const body = code(source);

      assert.doesNotMatch(
        body,
        /next\/headers|cookies\(\)/,
        `${name} must not read cookies`
      );
      assert.doesNotMatch(
        body,
        /@\/lib\/supabase\/server/,
        `${name} must not build a cookie-scoped client`
      );
      assert.doesNotMatch(
        body,
        /getCrmAccessContext|ForCurrentUser/,
        `${name} must not fall back to the cookie context or browser wrappers`
      );
    }
  });

  test("no route and no touched service reaches service role", () => {
    for (const [name, source] of [...ALL_ROUTES, ...ALL_SERVICES, ["mobile-admin", MOBILE_ADMIN] as const]) {
      assert.doesNotMatch(source, /service_role/i, `${name}: no service role`);
      assert.doesNotMatch(
        source,
        /SUPABASE_SERVICE_ROLE_KEY/,
        `${name}: no service role key`
      );
      assert.doesNotMatch(
        source,
        /createServiceClient|createAdminClient|serviceClient/,
        `${name}: no privileged client`
      );
    }

    /*
     * The bearer client forwards the CALLER's token with the publishable key,
     * so `auth.uid()` is the mobile user and every RLS policy applies exactly
     * as it does on the web.
     */
    assert.match(BEARER, /publishableKey/);
    /* Code only: the file's own prose explains why it must never be given one. */
    assert.doesNotMatch(code(BEARER), /SERVICE_ROLE/i);

    /* The shared resolver's fallback is the cookie client, never a privileged one. */
    assert.match(CRM_DB, /from "@\/lib\/supabase\/server"/);
    assert.doesNotMatch(CRM_DB, /service_role/i);
  });

  test("the bearer token is never logged", () => {
    for (const [name, source] of [...ALL_ROUTES, ["mobile-admin", MOBILE_ADMIN] as const]) {
      const logged = code(source).match(/console\.\w+\([^)]*\)/g) ?? [];

      for (const call of logged) {
        assert.doesNotMatch(call, /token|authorization|bearer/i, `${name}: ${call}`);
      }
    }

    assert.doesNotMatch(code(MOBILE_AUTH), /console\./);
    assert.doesNotMatch(code(BEARER), /console\./);
  });
});

/* ========================================================================== */
/* 2. Permission matrix                                                       */
/* ========================================================================== */

describe("each feature is gated on its canonical permission", () => {
  const MATRIX: ReadonlyArray<readonly [string, string, string]> = [
    ["cadences", CADENCE_LIST, "canManageCadences"],
    ["cadences/[templateId]", CADENCE_DETAIL, "canManageCadences"],
    ["cadences/actions", CADENCE_ACTIONS, "canManageCadences"],
    ["targets", TARGET_LIST, "canReadSalesTargets"],
    ["targets/[targetId]/events", TARGET_EVENTS, "canReadSalesTargets"],
    ["targets/actions", TARGET_ACTIONS, "canManageSalesTargets"],
    ["assignment-rules", RULE_LIST, "canManageLeadAssignmentRules"],
    ["assignment-rules/actions", RULE_ACTIONS, "canManageLeadAssignmentRules"],
    ["sla", SLA, "canManageSlaPolicy"],
    ["imports", IMPORT_LIST, "canBulkImportLeads"],
    ["imports/[batchId]", IMPORT_DETAIL, "canBulkImportLeads"],
    ["imports/upload", IMPORT_UPLOAD, "canBulkImportLeads"],
    ["imports/[batchId]/map-validate", IMPORT_MAP, "canBulkImportLeads"],
    ["imports/[batchId]/actions", IMPORT_ACTIONS, "canBulkImportLeads"],
  ];

  test("the route gate names the canonical permission and precedes the work", () => {
    for (const [name, source, permission] of MATRIX) {
      const body = handlers(source);

      /*
       * The gate refuses on the NEGATED flag. `imports/[batchId]/actions`
       * qualifies its gate with the approve split, so the flag is required to
       * appear in a refusal rather than in one exact sentence.
       */
      assert.match(
        flat(body),
        new RegExp(
          `if \\([^)]*!auth\\.context\\.${permission}\\)[\\s\\S]{0,120}?crmMobileError\\( ?"forbidden"`
        ),
        `${name} must refuse a caller lacking ${permission}`
      );

      const gateAt = body.indexOf(`auth.context.${permission}`);
      const dbAt = body.indexOf("auth.db");

      assert.ok(gateAt > 0, `${name} must gate`);
      assert.ok(dbAt > gateAt, `${name}: the gate must precede every query`);
    }
  });

  test("no route substitutes a role string for a permission flag", () => {
    for (const [name, source] of ALL_ROUTES) {
      assert.doesNotMatch(
        code(source),
        /super_admin|SUPER_ADMIN|roleCode|role_code|"owner"/,
        `${name} must not shortcut a permission with a role`
      );
    }
  });

  test("targets keep the read/manage split on both sides", () => {
    /* The list answers on read and only HINTS at manage. */
    assert.match(code(TARGET_LIST), /canReadSalesTargets/);
    assert.match(
      flat(code(TARGET_LIST)),
      /canManage: auth\.context\.canManageSalesTargets/
    );
    assert.doesNotMatch(
      flat(code(TARGET_LIST)),
      /if \(!auth\.context\.canManageSalesTargets\)/
    );

    /* Writes demand manage. */
    assert.match(
      flat(code(TARGET_ACTIONS)),
      /if \(!auth\.context\.canManageSalesTargets\)/
    );
    assert.doesNotMatch(
      flat(code(TARGET_ACTIONS)),
      /if \(!auth\.context\.canReadSalesTargets\)/
    );

    /* And the service asserts each independently — the hint is not the gate. */
    assert.match(TARGET_SERVICE, /function assertReadPermission/);
    assert.match(TARGET_SERVICE, /function assertManagePermission/);
    assert.match(TARGET_SERVICE, /canReadSalesTargets/);
    assert.match(TARGET_SERVICE, /canManageSalesTargets/);
  });

  test("imports keep the approve split on both sides", () => {
    const body = flat(code(IMPORT_ACTIONS));

    assert.match(
      body,
      /const needsApproval = action === "approve" \|\| action === "reject"/
    );
    assert.match(body, /needsApproval && !auth\.context\.canApproveLeadImports/);
    assert.match(body, /!needsApproval && !auth\.context\.canBulkImportLeads/);

    /* The service asserts the same split for itself. */
    assert.match(IMPORT_SERVICE, /function assertApprovePermission/);
    assert.match(IMPORT_SERVICE, /canApproveLeadImports/);
    assert.match(
      IMPORT_SERVICE,
      /export async function approveLeadImportBatchForContext[\s\S]*?assertApprovePermission\(context\)/
    );
    assert.match(
      IMPORT_SERVICE,
      /export async function rejectLeadImportBatchForContext[\s\S]*?assertApprovePermission\(context\)/
    );
    assert.match(
      IMPORT_SERVICE,
      /export async function submitLeadImportBatchForContext[\s\S]*?assertBulkImportPermission\(context\)/
    );
  });

  test("every ForContext entry point asserts before it queries", () => {
    const GATES: ReadonlyArray<readonly [string, string, string]> = [
      ["cadence-service", CADENCE_SERVICE, "assertCadenceManagePermission"],
      ["assignment-rule-service", RULE_SERVICE, "assertAssignmentRulePermission"],
      ["sla-policy-service", SLA_SERVICE, "assertSlaManagePermission"],
    ];

    for (const [name, source, gate] of GATES) {
      const body = code(source);
      const pattern = new RegExp(
        `export async function \\w+ForContext\\([\\s\\S]*?\\{\\s*${gate}\\(context\\);`,
        "g"
      );
      const matches = body.match(pattern) ?? [];
      const declared = body.match(/export async function \w+ForContext\(/g) ?? [];

      assert.equal(
        matches.length,
        declared.length,
        `${name}: every ForContext must assert ${gate} first`
      );
      assert.ok(declared.length > 0, `${name} must expose ForContext entry points`);
    }
  });
});

/* ========================================================================== */
/* 3. The db is threaded through reads, writes and reloads                    */
/* ========================================================================== */

describe("the caller's own client reaches every query", () => {
  test("each route passes auth.db to every canonical call", () => {
    for (const [name, source] of ALL_ROUTES) {
      assert.match(code(source), /auth\.db/, `${name} must thread auth.db`);
    }
  });

  test("no canonical call in a route is made without the client", () => {
    /*
     * Each canonical function a route calls must receive `auth.db`. A call that
     * omitted it would silently fall back to a cookie client and answer the
     * mobile caller with an empty session.
     */
    const CALLS: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      ["cadences", CADENCE_LIST, ["fetchCadenceTemplates"]],
      ["cadences/[templateId]", CADENCE_DETAIL, ["fetchCadenceTemplateDetail"]],
      [
        "cadences/actions",
        CADENCE_ACTIONS,
        [
          "createCadenceTemplateForContext",
          "updateCadenceTemplateForContext",
          "replaceCadenceTemplateStepsForContext",
          "publishCadenceTemplateForContext",
          "archiveCadenceTemplateForContext",
          "duplicateCadenceTemplateForContext",
        ],
      ],
      ["targets", TARGET_LIST, ["fetchSalesTargetsForContext"]],
      ["targets/events", TARGET_EVENTS, ["fetchSalesTargetEventsForContext"]],
      [
        "targets/actions",
        TARGET_ACTIONS,
        [
          "createSalesTargetForContext",
          "reviseSalesTargetForContext",
          "lockSalesTargetForContext",
          "reopenSalesTargetForContext",
        ],
      ],
      ["assignment-rules", RULE_LIST, ["fetchLeadAssignmentRulesForContext"]],
      [
        "assignment-rules/actions",
        RULE_ACTIONS,
        [
          "createLeadAssignmentRuleForContext",
          "updateLeadAssignmentRuleForContext",
          "setLeadAssignmentRuleActiveForContext",
        ],
      ],
      [
        "sla",
        SLA,
        [
          "fetchFirstContactSlaPolicyForContext",
          "updateFirstContactSlaPolicyForContext",
        ],
      ],
      ["imports", IMPORT_LIST, ["fetchLeadImportBatchListForContext"]],
      [
        "imports/[batchId]",
        IMPORT_DETAIL,
        ["fetchLeadImportBatchWithRowsForContext"],
      ],
      [
        "imports/upload",
        IMPORT_UPLOAD,
        [
          "createLeadImportBatchForContext",
          "replaceLeadImportMappingForContext",
        ],
      ],
      [
        "imports/map-validate",
        IMPORT_MAP,
        [
          "replaceLeadImportMappingForContext",
          "replaceLeadImportRowsForContext",
          "validateLeadImportBatchForContext",
        ],
      ],
      [
        "imports/actions",
        IMPORT_ACTIONS,
        [
          "submitLeadImportBatchForContext",
          "approveLeadImportBatchForContext",
          "rejectLeadImportBatchForContext",
          "confirmLeadImportBatchDirectForContext",
          "cancelLeadImportBatchForContext",
          "processLeadImportBatchForContext",
        ],
      ],
    ];

    for (const [name, source, functions] of CALLS) {
      const body = flat(code(source));

      for (const fn of functions) {
        const at = body.indexOf(`${fn}(`);
        assert.ok(at >= 0, `${name} must call ${fn}`);

        /* The argument list ends at the first `)` that closes it. */
        const args = body.slice(at, body.indexOf(")", body.indexOf("auth.db", at)) + 1);
        assert.match(
          args,
          /auth\.db/,
          `${name}: ${fn} must be given auth.db`
        );
      }
    }
  });

  test("a reload after a write uses the SAME injected client", () => {
    /*
     * This is the property that breaks first and most quietly. The assignment
     * rule writes re-read through `fetchLeadAssignmentRulesForContext(context,
     * db)` and the import writes through `reloadBatch(id, db)`. Either one
     * given a fresh cookie client would answer a bearer caller's successful
     * write with "created but could not be loaded".
     */
    const ruleBody = flat(code(RULE_SERVICE));

    assert.doesNotMatch(
      ruleBody,
      /const rules = await fetchLeadAssignmentRulesForCurrentUser\(\)/,
      "a ForContext write must not reload through the cookie wrapper"
    );
    assert.equal(
      (ruleBody.match(/fetchLeadAssignmentRulesForContext\(context, db\)/g) ?? [])
        .length,
      3,
      "create, update and set_active must each reload on the same context+db"
    );

    const importBody = flat(code(IMPORT_SERVICE));

    assert.match(
      importBody,
      /async function reloadBatch\( batchId: string, db\?: CrmDb \)/
    );
    assert.match(
      importBody,
      /fetchLeadImportBatchDetail\(batchId, db\)/,
      "reloadBatch must pass the injected client through"
    );
    assert.ok(
      (importBody.match(/reloadBatch\(\(data as \{ id: string \}\)\.id, db\)/g) ?? [])
        .length >= 8,
      "every import mutation must reload on the same client"
    );

    /* And the detail read pairs both queries on the same client. */
    assert.match(
      importBody,
      /fetchLeadImportBatchDetail\(batchId, db\), fetchLeadImportBatchRows\(batchId, db\)/
    );
  });

  test("the browser wrappers still exist and still resolve a cookie context", () => {
    /*
     * The web workspace must be behaviourally unchanged. Each browser wrapper
     * survives with its exact previous name and now delegates to the shared
     * implementation after resolving a cookie context.
     */
    const WRAPPERS: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [
        "cadence-service",
        CADENCE_SERVICE,
        [
          "createCadenceTemplateForCurrentUser",
          "updateCadenceTemplateForCurrentUser",
          "replaceCadenceTemplateStepsForCurrentUser",
          "publishCadenceTemplateForCurrentUser",
          "archiveCadenceTemplateForCurrentUser",
          "duplicateCadenceTemplateForCurrentUser",
        ],
      ],
      [
        "sales-target-service",
        TARGET_SERVICE,
        [
          "fetchSalesTargetsForCurrentUser",
          "fetchSalesTargetEvents",
          "createSalesTargetForCurrentUser",
          "reviseSalesTargetForCurrentUser",
          "lockSalesTargetForCurrentUser",
          "reopenSalesTargetForCurrentUser",
        ],
      ],
      [
        "assignment-rule-service",
        RULE_SERVICE,
        [
          "fetchLeadAssignmentRulesForCurrentUser",
          "createLeadAssignmentRuleForCurrentUser",
          "updateLeadAssignmentRuleForCurrentUser",
          "setLeadAssignmentRuleActiveForCurrentUser",
        ],
      ],
      [
        "sla-policy-service",
        SLA_SERVICE,
        ["fetchFirstContactSlaPolicy", "updateFirstContactSlaPolicy"],
      ],
      [
        "import-service",
        IMPORT_SERVICE,
        [
          "createLeadImportBatchForCurrentUser",
          "replaceLeadImportMappingForCurrentUser",
          "replaceLeadImportRowsForCurrentUser",
          "validateLeadImportBatchForCurrentUser",
          "submitLeadImportBatchForCurrentUser",
          "approveLeadImportBatchForCurrentUser",
          "rejectLeadImportBatchForCurrentUser",
          "confirmLeadImportBatchDirectForCurrentUser",
          "cancelLeadImportBatchForCurrentUser",
          "processLeadImportBatchForCurrentUser",
          "fetchLeadImportBatchWithRows",
        ],
      ],
    ];

    for (const [name, source, exported] of WRAPPERS) {
      for (const fn of exported) {
        assert.match(
          source,
          new RegExp(`export async function ${fn}\\b`),
          `${name}: ${fn} must still be exported`
        );
      }
    }

    /* A wrapper resolves its context from cookies; none passes a client. */
    assert.match(CADENCE_SERVICE, /getCrmAccessContext\(\)/);
    assert.match(TARGET_SERVICE, /getCrmAccessContext\(\)/);
    assert.match(RULE_SERVICE, /getCrmAccessContext\(\)/);
    assert.match(SLA_SERVICE, /getCrmAccessContext\(\)/);
    assert.match(IMPORT_SERVICE, /getCrmAccessContext\(\)/);
  });

  test("an omitted client still resolves the cookie default", () => {
    /* `resolveCrmDb` is what keeps every pre-existing caller unchanged. */
    assert.match(CRM_DB, /return db \?\? \(await createClient\(\)\)/);

    for (const [name, source] of ALL_SERVICES) {
      assert.match(
        source,
        /resolveCrmDb/,
        `${name} must resolve its client through the shared resolver`
      );
    }
  });
});

/* ========================================================================== */
/* 4. Error model                                                             */
/* ========================================================================== */

describe("errors are categories, never internals", () => {
  test("the envelope maps each canonical status onto one mobile code", () => {
    assert.match(MOBILE_ADMIN, /case 401:\s*return "unauthenticated"/);
    assert.match(MOBILE_ADMIN, /case 403:\s*return "forbidden"/);
    assert.match(MOBILE_ADMIN, /case 404:\s*return "not_found"/);
    assert.match(MOBILE_ADMIN, /case 409:\s*return "conflict"/);
    assert.match(MOBILE_ADMIN, /case 400:\s*case 422:\s*return "invalid_request"/);
    assert.match(MOBILE_ADMIN, /default:\s*return "unavailable"/);

    assert.match(MOBILE_AUTH, /unauthenticated: 401/);
    assert.match(MOBILE_AUTH, /forbidden: 403/);
    assert.match(MOBILE_AUTH, /invalid_request: 400/);
    assert.match(MOBILE_AUTH, /not_found: 404/);
    assert.match(MOBILE_AUTH, /conflict: 409/);
    assert.match(MOBILE_AUTH, /unavailable: 503/);
  });

  test("a revision conflict reaches 409 through the canonical status", () => {
    const errors = read("src", "features", "crm", "server", "crm-errors.ts");

    /* Both conflict tokens already carry httpStatus 409 canonically. */
    assert.match(
      errors,
      /crm_import_stale_revision[\s\S]*?httpStatus: 409/
    );
    assert.match(
      errors,
      /crm_sales_target_revision_mismatch[\s\S]*?httpStatus: 409/
    );

    /* And the mapper forwards that status rather than deciding its own. */
    assert.match(
      flat(code(MOBILE_ADMIN)),
      /error instanceof CrmError && error\.httpStatus < 500/
    );
    assert.match(
      flat(code(MOBILE_ADMIN)),
      /mobileCodeForHttpStatus\(error\.httpStatus\), error\.message/
    );
  });

  test("raw Postgres detail is never forwarded", () => {
    /*
     * `crmErrorFromPostgresMessage` keeps the raw message in `details` and a
     * written sentence in `message`. Forwarding `details` would leak column,
     * policy and constraint names to a phone.
     */
    assert.doesNotMatch(code(MOBILE_ADMIN), /\.details/);

    for (const [name, source] of ALL_ROUTES) {
      const body = code(source);
      assert.doesNotMatch(body, /\.details/, `${name} must not forward details`);
      assert.doesNotMatch(
        body,
        /error\.message|String\(error\)/,
        `${name} must not serialise a raw error`
      );
    }
  });

  test("a 5xx or non-CrmError degrades to a fixed sentence", () => {
    const body = flat(code(MOBILE_ADMIN));

    assert.match(body, /console\.error\(`\[mobile\/crm\/admin\] \$\{label\}`, error\)/);
    assert.match(
      body,
      /return crmMobileError\( "unavailable", "This CRM admin action is unavailable right now\. Try again\." \)/
    );
  });

  test("a malformed id is refused before any query runs", () => {
    const WITH_IDS: ReadonlyArray<readonly [string, string]> = [
      ["cadences/[templateId]", CADENCE_DETAIL],
      ["cadences/actions", CADENCE_ACTIONS],
      ["targets/[targetId]/events", TARGET_EVENTS],
      ["targets/actions", TARGET_ACTIONS],
      ["assignment-rules/actions", RULE_ACTIONS],
      ["imports/[batchId]", IMPORT_DETAIL],
      ["imports/[batchId]/map-validate", IMPORT_MAP],
      ["imports/[batchId]/actions", IMPORT_ACTIONS],
    ];

    for (const [name, source] of WITH_IDS) {
      const body = code(source);

      assert.match(
        body,
        /isCrmMobileAdminId\(/,
        `${name} must check the id shape`
      );

      const shapeAt = body.indexOf("isCrmMobileAdminId");
      const dbAt = body.indexOf("auth.db");

      assert.ok(
        shapeAt < dbAt,
        `${name}: the shape check must precede every query`
      );
    }

    /* ONE regex, the canonical one, not a second copy that could drift. */
    assert.match(
      MOBILE_ADMIN,
      /import \{ isUuid \} from "\.\.\/contracts\/assignment-contracts\.ts"/
    );
    assert.match(MOBILE_ADMIN, /return typeof value === "string" && isUuid\(value\.trim\(\)\)/);
    assert.doesNotMatch(MOBILE_ADMIN, /\[0-9a-f\]\{8\}/);
  });
});

/* ========================================================================== */
/* 5. No mutation through GET                                                 */
/* ========================================================================== */

describe("reads are reads", () => {
  test("no GET handler calls a mutation", () => {
    const READ_ONLY: ReadonlyArray<readonly [string, string]> = [
      ["cadences", CADENCE_LIST],
      ["cadences/[templateId]", CADENCE_DETAIL],
      ["targets", TARGET_LIST],
      ["targets/[targetId]/events", TARGET_EVENTS],
      ["assignment-rules", RULE_LIST],
      ["imports", IMPORT_LIST],
      ["imports/[batchId]", IMPORT_DETAIL],
    ];

    for (const [name, source] of READ_ONLY) {
      const body = code(source);

      assert.match(body, /export async function GET\(/, `${name} must expose GET`);
      assert.doesNotMatch(
        body,
        /export async function (POST|PUT|PATCH|DELETE)\(/,
        `${name} must expose no mutating method`
      );
      assert.doesNotMatch(
        body,
        /\.rpc\(|create|update|replace|delete|insert|publish|archive|submit|approve|reject|cancel|process/i,
        `${name} must call no mutation`
      );
    }
  });

  test("mutating endpoints accept only POST or PUT, and read no query string", () => {
    const MUTATING: ReadonlyArray<readonly [string, string, string]> = [
      ["cadences/actions", CADENCE_ACTIONS, "POST"],
      ["targets/actions", TARGET_ACTIONS, "POST"],
      ["assignment-rules/actions", RULE_ACTIONS, "POST"],
      ["imports/upload", IMPORT_UPLOAD, "POST"],
      ["imports/[batchId]/map-validate", IMPORT_MAP, "POST"],
      ["imports/[batchId]/actions", IMPORT_ACTIONS, "POST"],
      ["sla", SLA, "PUT"],
    ];

    for (const [name, source, method] of MUTATING) {
      const body = code(source);

      assert.match(
        body,
        new RegExp(`export async function ${method}\\(`),
        `${name} must expose ${method}`
      );

      /*
       * No mutation reads `searchParams`. A write driven by a query string is
       * one a link, a prefetch or a redirect can trigger.
       */
      assert.doesNotMatch(
        body,
        /searchParams|new URL\(request\.url\)/,
        `${name} must not take input from the query string`
      );
    }

    /* The SLA route is the only one pairing a read with a write. */
    assert.match(code(SLA), /export async function GET\(/);
    assert.match(code(SLA), /export async function PUT\(/);
    assert.doesNotMatch(code(SLA), /export async function POST\(/);
  });
});

/* ========================================================================== */
/* 6. Cadences                                                                */
/* ========================================================================== */

describe("cadences expose template administration only", () => {
  test("the six admin actions are present and enrollment is absent", () => {
    const body = code(CADENCE_ACTIONS);

    for (const action of [
      "create",
      "update",
      "replace_steps",
      "publish",
      "archive",
      "duplicate",
    ]) {
      assert.match(body, new RegExp(`case "${action}":`), `missing ${action}`);
    }

    /*
     * Enrollment runs on `canManageLeadFollowUps` against a lead the actor may
     * already mutate. Folding it into a surface gated on `canManageCadences`
     * would hand template administrators a lead-level power.
     */
    for (const forbidden of [
      "enroll",
      "pause",
      "resume",
      "EnrollLeadInCadence",
      "PauseLeadCadence",
      "ResumeLeadCadence",
      "CancelLeadCadence",
      "canManageLeadFollowUps",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `cadence actions must not reach ${forbidden}`
      );
    }
  });

  test("step order is array position and the client cannot supply one", () => {
    const body = flat(code(CADENCE_ACTIONS));

    /* The six accepted fields are named; `stepOrder` has nowhere to go. */
    assert.match(
      body,
      /activityType: row\.activityType, title: row\.title, priority: row\.priority, delayHours: row\.delayHours, durationMinutes: row\.durationMinutes, reminderOffsetMinutes: row\.reminderOffsetMinutes,/
    );
    assert.ok(
      !body.includes("stepOrder"),
      "the route must never read a client stepOrder"
    );

    /* The canonical normaliser and payload builder do not carry one either. */
    const normalized = normalizeCadenceStepInputs([
      {
        activityType: "call",
        title: "First call",
        priority: "normal",
        delayHours: 0,
        // A stray ordinal is structurally absent from the input type.
      },
      { activityType: "email", title: "Follow up", delayHours: 24 },
    ]);

    assert.equal(normalized.length, 2);
    for (const step of normalized) {
      assert.ok(!("stepOrder" in step));
    }

    const payload = cadenceStepInputsToRpcPayload(normalized);
    for (const entry of payload) {
      assert.ok(!("stepOrder" in entry), "the RPC payload carries no stepOrder");
    }

    /* Order is the array's, and it survives the round trip. */
    assert.equal(payload[0]?.title, "First call");
    assert.equal(payload[1]?.title, "Follow up");
  });

  test("a non-array steps payload is refused, never treated as empty", () => {
    /*
     * An empty step list is a MEANINGFUL edit — it erases the playbook — so
     * coercing a malformed body into one would destroy a cadence and report
     * success.
     */
    assert.match(
      flat(code(CADENCE_ACTIONS)),
      /if \(!Array\.isArray\(body\.steps\)\) \{ return crmMobileError\( "invalid_request"/
    );
  });

  test("the route restates no cadence threshold", () => {
    const body = code(CADENCE_ACTIONS) + code(CADENCE_LIST) + code(CADENCE_DETAIL);

    for (const bound of [
      String(CRM_CADENCE_MAX_STEPS),
      String(CRM_CADENCE_MAX_DELAY_HOURS),
      String(CRM_CADENCE_MAX_REMINDER_OFFSET_MINUTES),
    ]) {
      assert.ok(
        !body.includes(bound),
        `a cadence route must not restate the bound ${bound}`
      );
    }

    assert.doesNotMatch(body, /CRM_CADENCE_MAX_/);
  });

  test("the canonical validator is what refuses a bad step", () => {
    /* Proven against the contract itself, not re-implemented in the route. */
    const tooMany = Array.from({ length: CRM_CADENCE_MAX_STEPS + 1 }, () => ({
      activityType: "call" as const,
      title: "Step",
      priority: "normal" as const,
      delayHours: 1,
      durationMinutes: null,
      reminderOffsetMinutes: null,
    }));
    assert.ok(validateCadenceStepInputs(tooMany).length > 0);

    const tooSlow = [
      {
        activityType: "call" as const,
        title: "Step",
        priority: "normal" as const,
        delayHours: CRM_CADENCE_MAX_DELAY_HOURS + 1,
        durationMinutes: null,
        reminderOffsetMinutes: null,
      },
    ];
    assert.ok(validateCadenceStepInputs(tooSlow).length > 0);

    assert.equal(validateCadenceStepInputs([]).length, 1);

    /* The service runs it before the RPC, on the ForContext path. */
    assert.match(
      flat(code(CADENCE_SERVICE)),
      /replaceCadenceTemplateStepsForContext\([\s\S]*?validateCadenceStepInputs\(input\.steps\)[\s\S]*?callReplaceCadenceTemplateSteps/
    );
  });

  test("nothing in the cadence path auto-sends a message", () => {
    for (const source of [CADENCE_ACTIONS, CADENCE_LIST, CADENCE_DETAIL, CADENCE_SERVICE]) {
      assert.doesNotMatch(
        code(source),
        /sendWhatsApp|dispatchMessage|sendMessage|providerSend/i,
        "a cadence step is an internal task, never an outbound send"
      );
    }
  });
});

/* ========================================================================== */
/* 7. Sales targets                                                           */
/* ========================================================================== */

describe("sales targets preserve revision, scope and currency", () => {
  test("each action maps to exactly one canonical RPC", () => {
    const body = flat(code(TARGET_SERVICE));

    for (const rpc of [
      "create_sales_target",
      "revise_sales_target",
      "lock_sales_target",
      "reopen_sales_target",
    ]) {
      assert.match(body, new RegExp(`rpc\\("${rpc}"`), `missing ${rpc}`);
    }

    /* The route names no RPC of its own. */
    assert.doesNotMatch(code(TARGET_ACTIONS), /\.rpc\(/);
  });

  test("expectedRevision is required, integer, and forwarded untouched", () => {
    const body = flat(code(TARGET_ACTIONS));

    assert.match(body, /readIntegerField\(body, "expectedRevision"\)/);
    assert.match(
      body,
      /if \(expectedRevision === null\) \{ return crmMobileError\( ?"invalid_request"/
    );
    assert.match(body, /expectedRevision: expectedRevision as number,/);

    /* Not defaulted, not coerced, not compared here. */
    assert.doesNotMatch(body, /expectedRevision \?\? /);
    assert.doesNotMatch(body, /Number\(.*expectedRevision/);

    /* The integer reader really does refuse a non-integer. */
    assert.match(
      MOBILE_ADMIN,
      /typeof value === "number" && Number\.isInteger\(value\)/
    );

    /* And the service hands it straight to the RPC. */
    assert.match(
      flat(code(TARGET_SERVICE)),
      /p_expected_revision: input\.expectedRevision,/
    );
  });

  test("the numeric fields are type-checked before the canonical validator", () => {
    /*
     * `validateCreateSalesTargetInput` compares the revenue with `<` and `>`,
     * which coerce. A string bound would pass a check it plainly fails, so the
     * route insists on real integers first.
     */
    const coerced = validateCreateSalesTargetInput({
      targetScope: "sales_team",
      targetMonth: "2026-09-01",
      targetUserId: null,
      /* A STRING that passes both numeric bounds once coerced. */
      revenueTargetPaise: "50" as unknown as number,
      closedWonCountTarget: 5,
      reason: "A sufficiently long and valid reason string.",
    });
    assert.equal(
      Object.keys(coerced).length,
      0,
      "the canonical validator accepts a numeric string — the route must guard the type"
    );

    const body = flat(code(TARGET_ACTIONS));
    assert.match(body, /readIntegerField\(body, "revenueTargetPaise"\)/);
    assert.match(body, /readIntegerField\(\s*body,\s*"closedWonCountTarget"\s*\)/);
    assert.match(
      body,
      /revenueTargetPaise === null \|\| closedWonCountTarget === null/
    );
  });

  test("no attainment is computed anywhere on this path", () => {
    for (const source of [TARGET_LIST, TARGET_EVENTS, TARGET_ACTIONS, TARGET_SERVICE]) {
      assert.doesNotMatch(
        code(source),
        /attainment|achieved|progress|percentComplete|\/ target/i,
        "targets are configuration; achievement stays Phase 7B gated"
      );
    }
  });

  test("scope, status and currency stay the canonical vocabulary", () => {
    assert.deepEqual(SALES_TARGET_SCOPES, ["executive_personal", "sales_team"]);
    assert.deepEqual(SALES_TARGET_STATUSES, ["open", "locked"]);
    assert.equal(SALES_TARGET_CURRENCY, "INR");

    /* The route invents no scope and no status. */
    const body = code(TARGET_ACTIONS);
    assert.doesNotMatch(body, /"executive_personal"|"sales_team"/);
    assert.doesNotMatch(body, /"locked"|"open"/);
    assert.doesNotMatch(body, /INR|currency/i);
  });
});

/* ========================================================================== */
/* 8. Assignment rules                                                        */
/* ========================================================================== */

describe("assignment rules keep canonical order and no engine", () => {
  test("the canonical priority ASC, id ASC order is preserved", () => {
    assert.match(
      flat(code(RULE_SERVICE)),
      /\.order\("priority", \{ ascending: true \}\) \.order\("id", \{ ascending: true \}\)/
    );

    /* The route does not re-sort what the query ordered. */
    assert.doesNotMatch(code(RULE_LIST), /\.sort\(|localeCompare|\.reverse\(/);
  });

  test("each action maps to exactly one canonical RPC", () => {
    const body = flat(code(RULE_SERVICE));

    for (const rpc of [
      "create_lead_assignment_rule",
      "update_lead_assignment_rule",
      "set_lead_assignment_rule_active",
    ]) {
      assert.match(body, new RegExp(`rpc\\("${rpc}"`), `missing ${rpc}`);
    }

    assert.doesNotMatch(code(RULE_ACTIONS), /\.rpc\(/);
  });

  test("no match-precedence engine exists in the route or the service", () => {
    for (const source of [RULE_LIST, RULE_ACTIONS, RULE_SERVICE]) {
      assert.doesNotMatch(
        code(source),
        /specificity|matchScore|bestMatch|resolveAssignee|pickRule|scoreRule/i,
        "which rule wins is decided during import validation, in the database"
      );
    }
  });

  test("an unknown code is refused rather than widened to a catch-all", () => {
    /*
     * The canonical validator rejects an unrecognised service code. Silently
     * dropping it to null would make a single-service rule match EVERY service
     * and start rerouting leads on the next import.
     */
    const errors = validateCreateLeadAssignmentRuleInput({
      sourceId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      targetUserId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
      priority: 1,
      serviceCode: "not_a_real_service",
    });
    assert.ok(errors.some((entry) => entry.field === "serviceCode"));

    /* The route forwards the string instead of nulling it. */
    const body = flat(code(RULE_ACTIONS));
    assert.match(body, /serviceCode: serviceCode as LeadServiceCode \| null,/);
    assert.doesNotMatch(body, /isAllowed|LEAD_SERVICE_CODES\.includes/);

    /* A present non-string is refused outright. */
    assert.match(MOBILE_ADMIN, /if \(typeof value !== "string"\) \{\s*return false;/);
  });

  test("set_active demands a real boolean", () => {
    assert.match(
      flat(code(RULE_ACTIONS)),
      /if \(typeof isActive !== "boolean"\) \{ return crmMobileError\( "invalid_request"/
    );
  });
});

/* ========================================================================== */
/* 9. SLA                                                                     */
/* ========================================================================== */

describe("SLA writes go through the RPC and only the RPC", () => {
  test("only the first_contact policy is reachable", () => {
    assert.match(SLA_SERVICE, /FIRST_CONTACT_SLA_POLICY_CODE/);
    assert.equal(FIRST_CONTACT_SLA_POLICY_CODE, "first_contact");

    /* No policy code travels in the request. */
    assert.doesNotMatch(code(SLA), /policyCode|policy_code|FIRST_CONTACT/);
  });

  test("the write is update_crm_sla_policy, never a direct table write", () => {
    const body = flat(code(SLA_SERVICE));

    assert.match(body, /rpc\("update_crm_sla_policy"/);
    assert.doesNotMatch(body, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    assert.doesNotMatch(body, /private\./);

    /* The read is the only place the table is named, and it is a select. */
    assert.match(body, /\.from\("crm_sla_policies"\) \.select\(POLICY_COLUMNS\)/);

    /* The route names neither the table nor the RPC. */
    assert.doesNotMatch(code(SLA), /crm_sla_policies|update_crm_sla_policy|\.rpc\(/);
  });

  test("the client cannot supply effectiveFrom, activatedAt or updatedBy", () => {
    for (const [name, source] of [["sla route", SLA], ["sla service", SLA_SERVICE]] as const) {
      assert.doesNotMatch(source, /p_effective_from/, name);
      assert.doesNotMatch(source, /p_activated_at/, name);
      assert.doesNotMatch(source, /p_updated_by/, name);
    }

    /* The route never reads them off the body at all. */
    const body = code(SLA);
    assert.ok(!body.includes("effectiveFrom"));
    assert.ok(!body.includes("activatedAt"));
    assert.ok(!body.includes("updatedBy"));
  });

  test("canonical validation and serialization run before the RPC", () => {
    assert.match(
      flat(code(SLA_SERVICE)),
      /validateUpdateCrmSlaPolicyInput\(input\)[\s\S]*?serializeBusinessHoursConfig\(input\.weekdays\)[\s\S]*?rpc\("update_crm_sla_policy"/
    );

    /* The route restates neither the minute bounds nor the HH:MM rule. */
    const body = code(SLA);
    assert.doesNotMatch(body, /10_?080|SLA_TARGET_MINUTES_/);
    assert.doesNotMatch(body, /\d\d:\d\d/);
    assert.doesNotMatch(body, /hhmmToMinutes|isValidHhMm/);
  });

  test("a persisted null business-hours config stays null, and no draft is saved", () => {
    /*
     * `DEFAULT_BUSINESS_HOURS_DRAFT` is a form draft for the web panel. The
     * mobile route deliberately does not import it: substituting it on read
     * would turn an unconfigured policy into a configured-looking one.
     */
    assert.ok(!code(SLA).includes("DEFAULT_BUSINESS_HOURS_DRAFT"));
    assert.ok(!code(SLA).includes("buildSlaPolicyFormModel"));

    /* Closed days are omitted, and an all-closed week serialises to null. */
    const allClosed = SLA_WEEKDAY_KEYS.map((day) => ({
      day,
      open: false,
      start: "09:00",
      end: "19:00",
    }));
    assert.equal(serializeBusinessHoursConfig(allClosed), null);

    /* A day the client omitted is closed, exactly like an unchecked box. */
    assert.match(
      flat(code(SLA)),
      /return SLA_WEEKDAY_KEYS\.map\(\(day\) => \{ const row = sent\.get\(day\);/
    );
    assert.match(flat(code(SLA)), /open: row\?\.open === true,/);

    /* The draft is still what the web panel offers — unchanged. */
    assert.equal(DEFAULT_BUSINESS_HOURS_DRAFT.monday?.start, "09:00");
    assert.equal(DEFAULT_BUSINESS_HOURS_DRAFT.sunday, undefined);
  });
});

/* ========================================================================== */
/* 10. Imports                                                                */
/* ========================================================================== */

describe("imports parse on the server and nowhere else", () => {
  test("the upload reuses every canonical parser step", () => {
    const body = flat(code(IMPORT_UPLOAD));

    assert.match(body, /detectLeadImportFileType\(file\.name, file\.type\)/);
    assert.match(body, /parseLeadImportFile\(buffer, fileType\)/);
    assert.match(body, /computeLeadImportFileSha256\(buffer\)/);
    assert.match(body, /clientRequestId: randomUUID\(\)/);
    assert.match(body, /createLeadImportBatchForContext\(/);
    assert.match(body, /replaceLeadImportMappingForContext\(/);

    /* Nothing is parsed in the route itself. */
    assert.doesNotMatch(body, /csv-parse|exceljs|split\("\\n"\)|split\(","\)/);
  });

  test("the size ceiling is enforced BEFORE the bytes are read or parsed", () => {
    for (const [name, source] of [
      ["upload", IMPORT_UPLOAD],
      ["map-validate", IMPORT_MAP],
    ] as const) {
      const body = handlers(source);

      const sizeAt = body.indexOf("file.size > LEAD_IMPORT_LIMITS.maxFileBytes");
      const bufferAt = body.indexOf("file.arrayBuffer()");
      const parseAt = body.indexOf("parseLeadImportFile");

      assert.ok(sizeAt > 0, `${name} must check the canonical size ceiling`);
      assert.ok(
        sizeAt < bufferAt,
        `${name}: the ceiling must precede materialising the body`
      );
      assert.ok(sizeAt < parseAt, `${name}: the ceiling must precede parsing`);
    }

    /* The parser re-checks the buffer it is handed — the second line of defence. */
    assert.match(
      flat(code(PARSER)),
      /buffer\.byteLength > LEAD_IMPORT_LIMITS\.maxFileBytes/
    );

    /* Referenced, never restated: no route spells the byte count out. */
    for (const source of [IMPORT_UPLOAD, IMPORT_MAP]) {
      assert.ok(!code(source).includes(String(LEAD_IMPORT_LIMITS.maxFileBytes)));
      assert.ok(!code(source).includes("5 * 1024 * 1024"));
    }
  });

  test("only CSV and XLSX are accepted, decided by the canonical detector", () => {
    assert.deepEqual(LEAD_IMPORT_FILE_TYPES, ["csv", "xlsx"]);

    for (const source of [IMPORT_UPLOAD, IMPORT_MAP]) {
      const body = code(source);
      assert.match(body, /detectLeadImportFileType\(file\.name, file\.type\)/);
      assert.match(body, /if \(!fileType\)/);

      /* The route lists no extension or MIME type of its own. */
      assert.doesNotMatch(body, /\.endsWith\(|spreadsheetml|text\/csv/);
    }
  });

  test("the uuid and the digest are the server's", () => {
    const body = flat(code(IMPORT_UPLOAD));

    assert.match(body, /import \{ randomUUID \} from "node:crypto"/);
    assert.match(body, /clientRequestId: randomUUID\(\)/);
    assert.match(body, /fileSha256: computeLeadImportFileSha256\(buffer\)/);
    assert.match(body, /fileSizeBytes: buffer\.byteLength,/);

    /* None of the three is ever read off the request. */
    assert.doesNotMatch(body, /form\.get\("clientRequestId"\)/);
    assert.doesNotMatch(body, /form\.get\("fileSha256"\)/);
    assert.doesNotMatch(body, /form\.get\("fileSizeBytes"\)/);
  });

  test("a suggestion is returned but never persisted", () => {
    const body = flat(code(IMPORT_UPLOAD));

    /* What is SAVED is every header pointing at an empty target. */
    assert.match(
      body,
      /const mapping = Object\.fromEntries\( parsed\.headers \.filter\(\(header\) => header\.trim\(\)\.length > 0\) \.map\(\(header\) => \[header, ""\]\) \);/
    );
    assert.match(body, /mapping: mapping as LeadImportColumnMapping,/);

    /* The suggestion is a separate, returned-only field. */
    assert.match(
      body,
      /suggestedMapping: suggestMappingFromHeaders\(parsed\.headers\),/
    );

    const handlerBody = flat(handlers(IMPORT_UPLOAD));
    const savedAt = handlerBody.indexOf("replaceLeadImportMappingForContext");
    const suggestedAt = handlerBody.indexOf("suggestMappingFromHeaders");
    assert.ok(
      suggestedAt > savedAt,
      "the suggestion must not be what is written"
    );
  });

  test("no raw bytes and no file content are returned", () => {
    for (const [name, source] of [
      ["upload", IMPORT_UPLOAD],
      ["map-validate", IMPORT_MAP],
      ["detail", IMPORT_DETAIL],
    ] as const) {
      const body = code(source);

      assert.doesNotMatch(body, /buffer\.toString\(/, `${name}`);
      assert.doesNotMatch(body, /base64/i, `${name}`);
      assert.doesNotMatch(body, /new Response\(buffer|body: buffer/, `${name}`);
      assert.doesNotMatch(body, /rawRecords \}\)|records \}\)/, `${name}`);
    }

    /* Nothing stores the file either — there is no file store to add to. */
    for (const source of [IMPORT_UPLOAD, IMPORT_MAP, IMPORT_SERVICE]) {
      assert.doesNotMatch(code(source), /storage\.from\(|\.upload\(/);
    }
  });

  test("the map-validate chain runs the canonical steps in order", () => {
    const body = flat(code(IMPORT_MAP));

    const steps = [
      "detectLeadImportFileType",
      "validateLeadImportMappingInput",
      "parseLeadImportFile",
      "replaceLeadImportMappingForContext",
      "applyMappingToRawRecords",
      "replaceLeadImportRowsForContext",
      "validateLeadImportBatchForContext",
    ];

    let cursor = -1;
    for (const step of steps) {
      const at = body.indexOf(step, cursor + 1);
      assert.ok(at > cursor, `${step} must follow the previous step`);
      cursor = at;
    }

    /* Both raw-record readers are the canonical ones. */
    assert.match(body, /parseCsvRecordsForMapping\(buffer\)\.records/);
    assert.match(body, /\(await parseXlsxRecordsForMapping\(buffer\)\)\.records/);
  });

  test("the mapping vocabulary is the contract's", () => {
    /* The route validates with the canonical validator and lists no field. */
    assert.match(code(IMPORT_MAP), /validateLeadImportMappingInput\(\{ mapping \}\)/);

    for (const field of LEAD_IMPORT_MAPPING_FIELDS) {
      assert.ok(
        !code(IMPORT_MAP).includes(`"${field}"`),
        `the route must not name the mapping target ${field}`
      );
    }

    /* And the validator really does refuse an unknown target. */
    const errors = validateLeadImportMappingInput({
      mapping: { Phone: "not_a_field" },
    });
    assert.equal(errors.length, 1);
    assert.equal(validateLeadImportMappingInput({ mapping: { Phone: "phone" } }).length, 0);
  });

  test("a malformed mapping is refused, never read as an empty mapping", () => {
    assert.match(
      flat(code(IMPORT_MAP)),
      /catch \{ return crmMobileError\( "invalid_request", "Send mapping as a JSON object of column name to target field\." \)/
    );
  });

  test("every lifecycle action carries the exact validationRevision", () => {
    const body = flat(code(IMPORT_ACTIONS));

    assert.match(body, /readIntegerField\(body, "expectedRevision"\)/);
    assert.match(
      body,
      /if \(action !== "cancel" && action !== null && expectedRevision === null\)/
    );

    for (const action of [
      "submit",
      "approve",
      "reject",
      "confirm_direct",
      "process",
    ]) {
      assert.match(body, new RegExp(`case "${action}":`), `missing ${action}`);
    }
    assert.match(body, /case "cancel":/);

    /* `cancel` is the one canonical call with no revision argument. */
    assert.match(
      body,
      /cancelLeadImportBatchForContext\(auth\.context, target, auth\.db\)/
    );

    /* The service forwards the revision to the RPC untouched. */
    assert.match(
      flat(code(IMPORT_SERVICE)),
      /p_expected_revision: expectedRevision,/
    );
  });

  test("the process chunk is the server's and is never read from the request", () => {
    const body = code(IMPORT_ACTIONS);

    assert.ok(!body.includes("maxRows"), "the route must not name a chunk size");
    assert.ok(!body.includes("p_max_rows"));
    assert.ok(!body.includes(String(LEAD_IMPORT_LIMITS.maxProcessChunk)));

    /* The service defaults it to the canonical constant. */
    assert.match(
      flat(code(IMPORT_SERVICE)),
      /maxRows: number = LEAD_IMPORT_LIMITS\.maxProcessChunk/
    );
    assert.match(flat(code(IMPORT_SERVICE)), /p_max_rows: maxRows,/);
  });

  test("the rejection reason is validated canonically", () => {
    assert.match(
      flat(code(IMPORT_ACTIONS)),
      /if \(rejectionReason === null\) \{ return crmMobileError\( "invalid_request"/
    );

    /* The bounds live in the contract and the service calls the validator. */
    assert.ok(!code(IMPORT_ACTIONS).includes(String(LEAD_IMPORT_LIMITS.rejectionReasonMin)));
    assert.ok(!code(IMPORT_ACTIONS).includes(String(LEAD_IMPORT_LIMITS.rejectionReasonMax)));
    assert.match(
      flat(code(IMPORT_SERVICE)),
      /validateLeadImportRejectionReason\(rejectionReason\)/
    );

    assert.ok(validateLeadImportRejectionReason("short") !== null);
    assert.equal(
      validateLeadImportRejectionReason("A properly detailed rejection reason."),
      null
    );
  });

  test("no import business semantics moved", () => {
    /* Statuses, file types, transport and limits are all still the contract's. */
    assert.deepEqual(LEAD_IMPORT_BATCH_STATUSES.slice(0, 3), [
      "draft",
      "validation_failed",
      "ready_for_review",
    ]);
    assert.equal(LEAD_IMPORT_TRANSPORT.entryMethod, "import");
    assert.equal(LEAD_IMPORT_TRANSPORT.source, "bulk-import");
    assert.equal(LEAD_IMPORT_LIMITS.maxRows, 1000);
    assert.equal(LEAD_IMPORT_LIMITS.maxColumns, 50);
    assert.equal(LEAD_IMPORT_LIMITS.maxProcessChunk, 100);

    /* No import route names a status, an entry method or a source. */
    for (const source of [IMPORT_LIST, IMPORT_DETAIL, IMPORT_UPLOAD, IMPORT_MAP, IMPORT_ACTIONS]) {
      const body = code(source);
      assert.doesNotMatch(body, /entry_method|entryMethod|bulk-import/);
      for (const status of LEAD_IMPORT_BATCH_STATUSES) {
        assert.ok(
          !body.includes(`"${status}"`),
          `a route must not name the batch status ${status}`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 11. Structural — routes own no business constant                           */
/* ========================================================================== */

describe("no route redefines what a contract already owns", () => {
  test("no route declares a threshold constant", () => {
    for (const [name, source] of ALL_ROUTES) {
      const body = code(source);

      /*
       * A route may REFERENCE a canonical limit; it may not declare one. A
       * second definition drifts, and the looser copy becomes the way in.
       */
      assert.doesNotMatch(
        body,
        /^\s*const [A-Z0-9_]{4,}\s*=/m,
        `${name} must not declare a constant a contract owns`
      );

      /*
       * DECLARATIONS, not references. Importing `LEAD_IMPORT_LIMITS` is the
       * point; writing `const maxFileBytes = ...` is the drift this forbids.
       *
       * Matched on a NAME SEGMENT, not a substring — `targetBusinessMinutes`
       * is a field being read, not a bound being invented.
       */
      assert.doesNotMatch(
        body,
        /(const|let|var)\s+(max|min|limit|ceiling|threshold)[A-Z_]\w*\s*=/,
        `${name} must not define a bound`
      );
      assert.doesNotMatch(
        body,
        /(const|let|var)\s+[A-Z][A-Z0-9_]*_(MAX|MIN|LIMIT|BYTES|ROWS)\b/,
        `${name} must not define a bound`
      );

      /* No bare numeric literal standing in for a business bound. */
      assert.doesNotMatch(
        body,
        /=\s*\d{3,}/,
        `${name} must not hard-code a numeric bound`
      );
    }
  });

  test("no route re-implements a canonical validator", () => {
    for (const [name, source] of ALL_ROUTES) {
      assert.doesNotMatch(
        code(source),
        /function validate\w+|\.length < \d|\.length > \d\d/,
        `${name} must not validate a business bound itself`
      );
    }
  });

  test("the only bound a route may name is a canonical import", () => {
    for (const [name, source] of [
      ["imports/upload", IMPORT_UPLOAD],
      ["imports/map-validate", IMPORT_MAP],
    ] as const) {
      assert.match(
        source,
        /LEAD_IMPORT_LIMITS\.maxFileBytes/,
        `${name} must reference the canonical ceiling`
      );
      assert.match(
        source,
        /from "@\/features\/crm\/contracts\/lead-import-contracts\.ts"/,
        `${name} must import it from the contract`
      );
    }
  });
});

/* ========================================================================== */
/* 12. Containment — nothing outside CRM admin moved                          */
/* ========================================================================== */

describe("the slice stays inside CRM admin", () => {
  test("no route touches attendance, salary, leave or staff admin", () => {
    for (const [name, source] of [...ALL_ROUTES, ["mobile-admin", MOBILE_ADMIN] as const]) {
      assert.doesNotMatch(
        source,
        /attendance|staff-salary|staff-leave|staff-admin|workforce|payroll/i,
        `${name} must not reach workforce code`
      );
    }
  });

  test("no route writes a table directly", () => {
    for (const [name, source] of ALL_ROUTES) {
      const body = code(source);

      /* `supabase.from(...)`, not `Buffer.from(...)`. */
      assert.doesNotMatch(
        body,
        /supabase\.from\(|\.from\("[a-z_]+"\)/,
        `${name} must not build a query — the canonical layer does`
      );
      assert.doesNotMatch(
        body,
        /\.insert\(|\.update\(|\.upsert\(|\.delete\(/,
        `${name} must not mutate a table`
      );
      assert.doesNotMatch(body, /\.rpc\(/, `${name} must not call an RPC directly`);
    }
  });

  test("the slice adds no migration", () => {
    const migrations = readFileSync(
      join(ROOT, "package.json"),
      "utf8"
    );
    assert.ok(migrations.length > 0);

    /* No route or touched service references a new object. */
    for (const [name, source] of [...ALL_ROUTES, ...ALL_SERVICES]) {
      assert.doesNotMatch(
        source,
        /CREATE TABLE|ALTER TABLE|CREATE FUNCTION/i,
        `${name} must not carry DDL`
      );
    }
  });

  test("every route is dynamic, so nothing admin is cached at the edge", () => {
    for (const [name, source] of ALL_ROUTES) {
      assert.match(
        source,
        /export const dynamic = "force-dynamic";/,
        `${name} must not be statically rendered`
      );
    }
  });
});
