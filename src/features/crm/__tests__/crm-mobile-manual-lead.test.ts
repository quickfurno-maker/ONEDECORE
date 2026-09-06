import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  MANUAL_LEAD_CATALOG_LABELS,
  validateManualLeadFormInput,
  type ManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
} from "../../lead-intake/planner-allowlist.ts";

/**
 * Manual single-lead creation, for the Owner mobile app.
 *
 * The canonical duplicate-safe flow already exists and is not re-implemented
 * here: these three routes authenticate a bearer caller and hand the form to
 * the same service the browser uses. So most of what follows is negative —
 * proof that no rule moved to the edge.
 *
 * It also pins a real defect this phase found and fixed. The browser action
 * overwrote an executive's `assigneeId` with their own id, which the validator
 * then rejected with "Sales executives cannot choose another assignee" — so a
 * sales executive could not create a manual lead at all. Three layers already
 * agreed without that line, and the database was always the assignment
 * authority.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/* Comments explain what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

function flat(source: string): string {
  return source.replace(/\s+/g, " ");
}

const SETUP_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "manual", "setup", "route.ts"
);

const PREVIEW_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "manual", "duplicate-preview", "route.ts"
);

const CREATE_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "manual", "route.ts"
);

const SERVICE = read(
  "src", "features", "crm", "server", "crm-manual-lead-service.ts"
);

const ACTIONS = read(
  "src", "features", "crm", "server", "crm-manual-lead-actions.ts"
);

const CONTRACTS = read(
  "src", "features", "crm", "contracts", "manual-lead-contracts.ts"
);

const MIGRATION = read(
  "supabase", "migrations", "20260801140000_crm_manual_lead_duplicate_safe_flow.sql"
);

const TAXONOMY = read(
  "supabase", "migrations", "20260825163000_lead_timeline_taxonomy_v2.sql"
);

const ROUTES = [
  ["setup", SETUP_ROUTE],
  ["preview", PREVIEW_ROUTE],
  ["create", CREATE_ROUTE],
] as const;

function formInput(
  overrides: Partial<ManualLeadFormInput> = {}
): ManualLeadFormInput {
  return {
    submittedName: "A Client",
    phone: "9876543210",
    email: null,
    serviceCode: "modular-kitchens",
    propertyCode: "apartment-3bhk",
    timelineCode: "immediate",
    primarySourceId: "3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31",
    locality: null,
    budgetComfortCode: null,
    roomCodes: [],
    message: null,
    sourceDetail: null,
    assigneeId: null,
    duplicateOverride: false,
    duplicateOverrideReason: null,
    ...overrides,
  };
}

/* ====================================================================== */
/* Auth                                                                   */
/* ====================================================================== */

describe("every manual-lead route is bearer-authenticated and caller-scoped", () => {
  test("all three reuse the CRM-M1 resolver and guard before working", () => {
    for (const [name, source] of ROUTES) {
      assert.match(source, /resolveCrmMobileAuth\(request\)/, name);
      assert.match(source, /crmMobileAuthError\(auth\.kind\)/, name);

      const body = code(source);
      const authAt = body.indexOf("resolveCrmMobileAuth");
      const guardAt = body.indexOf('auth.kind !== "granted"');
      const permAt = body.indexOf("auth.context.canCreateLeads");

      assert.ok(guardAt > authAt, `${name}: guard after auth`);
      assert.ok(permAt > guardAt, `${name}: permission after guard`);
    }
  });

  test("a caller without leads.create is refused before any work", () => {
    for (const [name, source] of ROUTES) {
      assert.match(
        flat(code(source)),
        /if \(!auth\.context\.canCreateLeads\) \{ return crmMobileError\( "forbidden"/,
        name
      );
    }
  });

  test("every route runs as the caller, with no cookie fallback", () => {
    for (const [name, source] of ROUTES) {
      assert.match(source, /auth\.db/, name);

      for (const browserOnly of [
        "getCrmAccessContext",
        "requireCrmCreateAccess",
        "createClient",
        "cookies",
        "next/headers",
      ]) {
        assert.ok(
          !code(source).includes(browserOnly),
          `${name} must not depend on ${browserOnly}`
        );
      }
    }
  });

  test("no service-role or admin credential exists on this path", () => {
    for (const [name, source] of [
      ...ROUTES,
      ["service", SERVICE],
    ] as const) {
      for (const forbidden of [
        "service_role",
        "SERVICE_ROLE",
        "SUPABASE_SERVICE",
        "serviceRole",
        "ADMIN_SECRET",
      ]) {
        assert.ok(
          !source.includes(forbidden),
          `${name} must not reference ${forbidden}`
        );
      }
    }
  });

  test("no route writes a table or calls an RPC itself", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      for (const forbidden of [
        ".from(",
        ".rpc(",
        ".insert(",
        ".update(",
        ".upsert(",
        ".delete(",
        "create_manual_lead",
        "check_manual_lead_duplicate",
      ]) {
        assert.ok(
          !body.includes(forbidden),
          `${name} must not do ${forbidden}`
        );
      }
    }
  });

  test("no bearer and a bad bearer both answer 401; unentitled answers 403", () => {
    const auth = read(
      "src", "features", "crm", "server", "crm-mobile-auth.ts"
    );

    /* Missing header and a token the server rejects are the same answer. */
    assert.equal(
      (code(auth).match(/return \{ kind: "unauthenticated" \};/g) ?? []).length,
      2
    );

    assert.match(flat(code(auth)), /unauthenticated: 401,/);
    assert.match(flat(code(auth)), /forbidden: 403,/);

    /*
     * `inactive` and `denied` both answer 403. Telling them apart would tell
     * an unauthorised caller which of the two they are.
     */
    assert.match(
      flat(code(auth)),
      /if \(kind === "unauthenticated"\) \{ return crmMobileError\( "unauthenticated", "Sign in again to continue\." \); \} return crmMobileError\( "forbidden",/
    );

    /* And the active-staff check is the browser's, not a second one. */
    assert.match(code(auth), /resolveCrmAccess\(/);
    assert.ok(!code(auth).includes("service_role"));
  });

  test("failures answer a category, never an internal", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      assert.match(body, /crmMobileAdminFailure\(error,/, name);
      assert.ok(!body.includes("error.message"), name);
      assert.ok(!body.includes(".stack"), name);
    }
  });
});

/* ====================================================================== */
/* The executive_self defect                                              */
/* ====================================================================== */

describe("a sales executive can create a lead again", () => {
  test("the validator requires a null assignee for executive_self", () => {
    /* Unchanged, and deliberately so: an executive may not name anyone. */
    assert.deepEqual(
      validateManualLeadFormInput(formInput({ assigneeId: null }), {
        mode: "executive_self",
      }),
      []
    );

    const refused = validateManualLeadFormInput(
      formInput({ assigneeId: "3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31" }),
      { mode: "executive_self" }
    );

    assert.equal(refused.length, 1);
    assert.equal(refused[0]?.field, "assigneeId");
    assert.match(refused[0]?.message ?? "", /cannot choose another assignee/);
  });

  test("the action no longer overwrites that null with the actor's id", () => {
    /*
     * THE BUG. `parseAssigneeId` already returns null for executive_self, and
     * the next line replaced it with `actorUserId` — which the validator above
     * then rejected, so the create always failed with 422.
     */
    assert.ok(
      !flat(code(ACTIONS)).includes(
        'if (assigneeMode === "executive_self") { assigneeId = actorUserId; }'
      ),
      "the executive_self overwrite must be gone"
    );

    /* A manager or admin choosing "self" is a real choice and still resolves. */
    assert.match(
      flat(code(ACTIONS)),
      /if \(assigneeMode !== "executive_self" && assigneeId === "self"\) \{ assigneeId = actorUserId; \}/
    );

    /* And the parser still answers null for that mode. */
    assert.match(
      flat(code(ACTIONS)),
      /if \(mode === "executive_self"\) \{ return null; \}/
    );
  });

  test("the database is the assignment authority, not the client", () => {
    /* Self-assignment comes from auth.uid(), whatever the payload said. */
    assert.match(
      flat(MIGRATION),
      /if v_is_exec then v_final_assignee := v_actor; else v_final_assignee := p_assignee_id; end if;/
    );

    /* And naming somebody else is refused outright. */
    assert.match(
      flat(MIGRATION),
      /if v_is_exec and p_assignee_id is not null and p_assignee_id is distinct from v_actor then raise exception 'CRM_MANUAL_LEAD_ASSIGNEE_FORBIDDEN'/
    );

    assert.match(flat(MIGRATION), /v_actor := auth\.uid\(\);/);
  });

  test("manager and admin policies are untouched", () => {
    assert.match(
      flat(code(SERVICE)),
      /if \(!context\.canAssignLeads\) \{ return \{ mode: "executive_self" \}; \}/
    );

    assert.match(
      flat(code(SERVICE)),
      /if \(context\.canManageLeadSources\) \{ return \{ mode: "admin", allowSelf: false \}; \}/
    );

    assert.match(
      flat(code(SERVICE)),
      /return \{ mode: "manager", allowSelf: true \};/
    );

    /* A manager or admin may still name a real assignee. */
    assert.deepEqual(
      validateManualLeadFormInput(
        formInput({ assigneeId: "3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31" }),
        { mode: "manager", allowSelf: true }
      ),
      []
    );

    assert.equal(
      validateManualLeadFormInput(
        formInput({ assigneeId: "not-a-uuid" }),
        { mode: "admin", allowSelf: false }
      ).length,
      1
    );
  });

  test("the client never states its own identity", () => {
    for (const [name, source] of ROUTES) {
      assert.ok(
        !code(source).includes("auth.context.userId"),
        `${name} must not fill in an actor id`
      );
    }
  });
});

/* ====================================================================== */
/* Timeline taxonomy                                                      */
/* ====================================================================== */

describe("one timeline vocabulary, agreed everywhere", () => {
  test("the allowlist and the effective SQL match", () => {
    assert.deepEqual(
      [...LEAD_TIMELINE_CODES],
      ["immediate", "within-1-month", "within-2-months", "after-2-months"]
    );

    /* The v2 migration redefines the function with the current codes. */
    assert.match(TAXONOMY, /create or replace function private\.create_manual_lead_impl\(/);

    assert.match(
      TAXONOMY,
      /'immediate', 'within-1-month', 'within-2-months', 'after-2-months'/
    );

    for (const code of LEAD_TIMELINE_CODES) {
      assert.ok(
        MANUAL_LEAD_CATALOG_LABELS.timeline[code],
        `${code} needs a label`
      );
    }
  });
});

/* ====================================================================== */
/* Setup                                                                  */
/* ====================================================================== */

describe("setup answers everything the form needs", () => {
  test("the catalogs come from the canonical allowlist and labels", () => {
    const body = code(SETUP_ROUTE);

    for (const symbol of [
      "LEAD_SERVICE_CODES",
      "LEAD_PROPERTY_CODES",
      "LEAD_TIMELINE_CODES",
      "LEAD_BUDGET_COMFORT_CODES",
      "LEAD_ROOM_CODES",
      "MANUAL_LEAD_CATALOG_LABELS",
    ]) {
      assert.ok(body.includes(symbol), `setup must use ${symbol}`);
    }

    /* No second allowlist: not one code is spelled in the route. */
    for (const literal of [
      "modular-kitchens",
      "apartment-3bhk",
      "within-1-month",
      "30l-plus",
      "wardrobes",
    ]) {
      assert.ok(
        !body.includes(literal),
        `setup must not restate ${literal}`
      );
    }
  });

  test("every canonical code carries a label", () => {
    const pairs = [
      [LEAD_SERVICE_CODES, MANUAL_LEAD_CATALOG_LABELS.service],
      [LEAD_PROPERTY_CODES, MANUAL_LEAD_CATALOG_LABELS.property],
      [LEAD_TIMELINE_CODES, MANUAL_LEAD_CATALOG_LABELS.timeline],
      [LEAD_BUDGET_COMFORT_CODES, MANUAL_LEAD_CATALOG_LABELS.budget],
      [LEAD_ROOM_CODES, MANUAL_LEAD_CATALOG_LABELS.room],
    ] as const;

    for (const [codes, labels] of pairs) {
      for (const entry of codes) {
        assert.ok(
          (labels as Readonly<Record<string, string>>)[entry],
          `${entry} needs a label`
        );
      }
    }
  });

  test("sources are the active catalogue and the default mirrors the browser", () => {
    assert.match(code(SETUP_ROUTE), /fetchActiveLeadSources\(auth\.db\)/);

    /* Exactly the preference `ManualLeadForm` applies. */
    assert.match(
      flat(code(SETUP_ROUTE)),
      /sources\.find\(\(source\) => source\.code === "manual_entry"\)/
    );

    assert.match(
      flat(code(SETUP_ROUTE)),
      /manualEntry\?\.id \?\? sources\[0\]\?\.id \?\? null/
    );

    const form = read(
      "src", "features", "crm", "components", "leads", "ManualLeadForm.tsx"
    );

    assert.match(
      flat(form),
      /manualEntry\?\.id \?\? sources\[0\]\?\.id \?\? ""/
    );
  });

  test("the policy and the override hint are canonical, not role-inferred", () => {
    const body = code(SETUP_ROUTE);

    assert.match(body, /resolveManualCreateAssigneePolicy\(auth\.context\)/);
    assert.match(body, /canOverrideDuplicate: auth\.context\.canOverrideLeadDuplicate/);
    assert.match(body, /fetchManualCreateAssigneeDirectoryForContext\(auth\.context, auth\.db\)/);

    /* No role name anywhere in the slice. */
    for (const [name, source] of ROUTES) {
      for (const role of [
        "super_admin",
        "sales_manager",
        "sales_executive",
        "management",
      ]) {
        assert.ok(
          !source.includes(role),
          `${name} must not name the ${role} role`
        );
      }
    }
  });

  test("no permission map or internal role mapping is serialised", () => {
    const body = code(SETUP_ROUTE);

    for (const leak of [
      "auth.context.canReadBroad",
      "auth.context.canDeleteLeads",
      "JSON.stringify(auth.context",
      "...auth.context",
    ]) {
      assert.ok(!body.includes(leak), `setup must not expose ${leak}`);
    }
  });
});

/* ====================================================================== */
/* Duplicate preview                                                      */
/* ====================================================================== */

describe("duplicate preview is advisory and says nothing private", () => {
  test("it delegates to the canonical service with the caller's client", () => {
    assert.match(
      flat(code(PREVIEW_ROUTE)),
      /previewManualLeadDuplicateForContext\( auth\.context, \{ phone, email, serviceCode: serviceCode as never, propertyCode: propertyCode as never, locality, \}, auth\.db \)/
    );
  });

  test("the response carries only the four safe fields", () => {
    const body = flat(code(PREVIEW_ROUTE));

    assert.match(
      body,
      /NextResponse\.json\(\{ outcomeCode: preview\.outcomeCode, canCreate: preview\.canCreate, canOverride: preview\.canOverride, existingLeadId: preview\.existingLeadId, \}\)/
    );

    /* Nothing about the other person. */
    for (const leak of [
      "existingPhone",
      "existingEmail",
      "existingName",
      "submittedName:",
      "contactId",
    ]) {
      assert.ok(!body.includes(leak), `preview must not return ${leak}`);
    }
  });

  test("a non-string optional field is refused, never dropped", () => {
    /*
     * A silently discarded phone would WIDEN the duplicate search and the
     * owner would be told a real duplicate is CLEAR.
     */
    assert.match(
      flat(code(PREVIEW_ROUTE)),
      /if \(phone === false \|\| email === false \|\| locality === false\)/
    );
  });

  test("the five canonical outcomes are the service's, not the route's", () => {
    for (const outcome of [
      "CLEAR",
      "REUSABLE_CONTACT",
      "ACTIVE_DUPLICATE",
      "RECENT_SIMILAR",
      "CONTACT_IDENTITY_CONFLICT",
    ]) {
      assert.ok(
        CONTRACTS.includes(outcome),
        `${outcome} must be canonical`
      );

      /* Stripped, because the prose above deliberately names one. */
      assert.ok(
        !code(PREVIEW_ROUTE).includes(outcome),
        `the route must not restate ${outcome}`
      );
    }
  });

  test("phone normalisation stays canonical", () => {
    assert.match(code(SERVICE), /withCanonicalPhone/);
    assert.ok(!code(PREVIEW_ROUTE).includes("canonicalizeOptionalPhone"));
    assert.ok(!code(CREATE_ROUTE).includes("canonicalizeOptionalPhone"));
  });
});

/* ====================================================================== */
/* Create                                                                 */
/* ====================================================================== */

describe("create delegates every rule and returns only an id", () => {
  test("it calls the canonical service with the caller's context and client", () => {
    const body = flat(code(CREATE_ROUTE));

    assert.match(body, /createManualLeadForContext\( auth\.context, \{/);
    assert.match(body, /\}, auth\.db \)/);
    assert.match(body, /NextResponse\.json\(\{ leadId: lead\.id \}\)/);
  });

  test("the raw lead row never crosses the wire", () => {
    const body = code(CREATE_ROUTE);

    assert.ok(!body.includes("NextResponse.json(lead)"));
    assert.ok(!body.includes("...lead"));
  });

  test("consent is neither accepted nor inferred", () => {
    const body = code(CREATE_ROUTE);

    /* Refused loudly, so a client cannot believe consent was stored. */
    for (const field of [
      "marketingConsent",
      "whatsappConsent",
      "emailMarketingConsent",
    ]) {
      assert.ok(
        body.includes(field),
        `${field} must appear in the refusal list`
      );
    }

    assert.match(
      flat(body),
      /for \(const field of FORBIDDEN_FIELDS\) \{ if \(field in body\) \{ return crmMobileError\( "invalid_request"/
    );

    /* And nothing on this path writes a consent record. */
    for (const [name, source] of [
      ...ROUTES,
      ["service", SERVICE],
    ] as const) {
      for (const write of [
        "consent_events",
        "record_marketing_consent_event",
        "contact_marketing_consent",
        "whatsapp_opt_in",
      ]) {
        assert.ok(
          !source.includes(write),
          `${name} must not touch ${write}`
        );
      }
    }
  });

  test("no client-authoritative score, bucket or stage is accepted", () => {
    const body = code(CREATE_ROUTE);

    for (const field of [
      "score",
      "salesBucket",
      "stage",
      "assignmentRuleId",
      "probability",
    ]) {
      assert.ok(
        body.includes(`"${field}"`),
        `${field} must appear in the refusal list`
      );
    }
  });

  test("the duplicate-override permission is the service's to assert", () => {
    assert.match(
      flat(code(SERVICE)),
      /if \( input\.duplicateOverride && !context\.canOverrideLeadDuplicate \) \{ throw new CrmError\(\{ code: "DUPLICATE_OVERRIDE_DENIED"/
    );

    /* The route only forwards the flag; it does not decide. */
    assert.match(
      code(CREATE_ROUTE),
      /duplicateOverride: body\.duplicateOverride === true/
    );

    assert.ok(
      !code(CREATE_ROUTE).includes("canOverrideLeadDuplicate"),
      "the route must not decide the override"
    );
  });

  test("PR #150 stands: the override is a permission, never a role", () => {
    const permissions = read(
      "src", "features", "crm", "server", "crm-permissions.ts"
    );

    /* The flag is probed, and the service reads only the flag. */
    assert.match(permissions, /leads\.duplicate_override/);
    assert.match(code(SERVICE), /context\.canOverrideLeadDuplicate/);
  });
});

/* ====================================================================== */
/* The browser is unchanged                                               */
/* ====================================================================== */

describe("the browser manual-lead flow still works the same way", () => {
  test("both wrappers survive and delegate to the shared core", () => {
    for (const wrapper of [
      "previewManualLeadDuplicateForCurrentUser",
      "createManualLeadForCurrentUser",
      "fetchManualCreateAssigneeDirectory",
    ]) {
      assert.match(
        SERVICE,
        new RegExp(`export async function ${wrapper}\\(`),
        wrapper
      );
    }

    assert.match(
      flat(code(SERVICE)),
      /return previewManualLeadDuplicateForContext\( await requireManualLeadContext\(\), input \);/
    );

    assert.match(
      flat(code(SERVICE)),
      /return createManualLeadForContext\( await requireManualLeadContext\(\), input \);/
    );
  });

  test("the injected client is optional, so the browser passes none", () => {
    assert.ok(SERVICE.includes("db?: CrmDb"));
    assert.ok(!/db:\s*CrmDb[,)]/.test(SERVICE));
    assert.match(SERVICE, /resolveCrmDb\(db\)/);
    assert.ok(!SERVICE.includes("await createClient()"));
  });

  test("the browser page and form are untouched", () => {
    const page = read(
      "src", "app", "admin", "crm", "leads", "new", "page.tsx"
    );

    assert.match(page, /fetchActiveLeadSources\(\)/);
    assert.match(page, /ManualLeadForm/);
  });

  test("the AUTH_REQUIRED behaviour the browser relied on is preserved", () => {
    assert.match(
      flat(code(SERVICE)),
      /async function requireManualLeadContext\(\): Promise<CrmAccessContext> \{ const context = await getCrmAccessContext\(\); if \(!context\) \{ throw new CrmError\(\{ code: "AUTH_REQUIRED"/
    );
  });
});
