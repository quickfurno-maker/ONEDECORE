import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEAD_DELETE_CONFIRMATION,
  LEAD_DELETE_REASON_MAX,
  LEAD_DELETE_REASON_MIN,
  validateLeadDeleteInput,
} from "../contracts/lead-delete-contracts.ts";

/**
 * Deleting an enquiry, from the Owner mobile app.
 *
 * PR #151 built the canonical capability and deliberately gave it no mobile
 * endpoint. This adds two — a capability question and the delete itself — over
 * the same validator, the same service and the same RPC the browser uses.
 *
 * So most of what follows is negative. Deletion is the most destructive thing
 * the CRM can do and the one place a duplicated rule would be worst: a phone
 * that believed an enquiry was deletable when the database did not would offer
 * the owner a button that fails, and a phone that believed the opposite would
 * hide a capability they hold. Neither is allowed to be possible, because the
 * phone decides none of it.
 *
 * The blockers that matter — closed_won, an existing quotation, an acceptance,
 * a project, a stale `updated_at`, the `super_admin` role — are evaluated
 * inside `delete_lead_tombstone`, in the same transaction as the write. These
 * tests prove no copy of any of them reached the edge.
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

const POLICY_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "delete-policy", "route.ts"
);

const DELETE_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "[leadId]", "delete", "route.ts"
);

const SERVICE = read(
  "src", "features", "crm", "server", "crm-lead-delete-service.ts"
);

const ACTIONS = read(
  "src", "features", "crm", "server", "crm-lead-delete-actions.ts"
);

const MOBILE_ADMIN = read(
  "src", "features", "crm", "server", "crm-mobile-admin.ts"
);

const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);

const ERRORS = read(
  "src", "features", "crm", "server", "crm-errors.ts"
);

const MIGRATION = read(
  "supabase", "migrations", "20260906180000_crm_super_admin_lead_tombstone.sql"
);

const DANGER_ZONE = read(
  "src", "features", "crm", "components", "leads", "LeadDeleteDangerZone.tsx"
);

const LEAD_PAGE = read(
  "src", "app", "admin", "crm", "leads", "[leadId]", "page.tsx"
);

const ROUTES = [
  ["policy", POLICY_ROUTE],
  ["delete", DELETE_ROUTE],
] as const;

const LEAD_ID = "3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31";

/* ====================================================================== */
/* Auth                                                                   */
/* ====================================================================== */

describe("both routes are bearer-authenticated and caller-scoped", () => {
  test("each resolves the caller before doing anything else", () => {
    for (const [name, source] of ROUTES) {
      assert.match(source, /resolveCrmMobileAuth\(request\)/, name);
      assert.match(source, /crmMobileAuthError\(auth\.kind\)/, name);

      const body = code(source);

      /* The guard is the first thing after the resolve. */
      assert.ok(
        body.indexOf('auth.kind !== "granted"') >
          body.indexOf("resolveCrmMobileAuth"),
        `${name}: guard after resolve`
      );
    }
  });

  test("neither can fall back to a cookie session", () => {
    for (const [name, source] of ROUTES) {
      for (const browserOnly of [
        "getCrmAccessContext",
        "createClient",
        "cookies",
        "next/headers",
        "deleteLeadForCurrentUser",
      ]) {
        assert.ok(
          !code(source).includes(browserOnly),
          `${name} must not depend on ${browserOnly}`
        );
      }
    }
  });

  test("the delete runs as the caller", () => {
    assert.match(
      flat(code(DELETE_ROUTE)),
      /deleteLeadForContext\( auth\.context, input, auth\.db \)/
    );
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

    /* The service says so out loud, and means it. */
    assert.match(SERVICE, /never a service role/);
  });

  test("no route touches a table itself", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      for (const forbidden of [
        ".from(",
        ".rpc(",
        ".update(",
        ".delete(",
        "delete_lead_tombstone",
        "deleted_at",
        "leads",
      ]) {
        /* `leads` appears in paths and identifiers; check for a query. */
        if (forbidden === "leads") {
          assert.ok(
            !body.includes('.from("leads")') &&
              !body.includes("from('leads')"),
            `${name} must not query leads`
          );
          continue;
        }

        assert.ok(
          !body.includes(forbidden),
          `${name} must not do ${forbidden}`
        );
      }
    }
  });
});

/* ====================================================================== */
/* The policy endpoint                                                    */
/* ====================================================================== */

describe("the policy endpoint answers a capability, not a role", () => {
  test("canDelete is the canonical permission flag", () => {
    assert.match(
      code(POLICY_ROUTE),
      /canDelete: auth\.context\.canDeleteLeads/
    );

    /*
     * Which is `leads.delete`, and only that.
     *
     * The permission is now resolved in a batch rather than a per-code RPC, so
     * the assertion is on the code the deletion probe reads — the mapper is
     * pure and its behaviour is covered directly in
     * `src/server/auth/__tests__/authorize-many.test.ts`.
     */
    const permissions = read(
      "src", "features", "crm", "server", "crm-permissions.ts"
    );

    assert.match(permissions, /LEAD_DELETION_CODES = \["leads\.delete"\]/);
    assert.match(permissions, /granted\(answers, "leads\.delete"\)/);
  });

  test("no role name appears anywhere in the slice", () => {
    for (const [name, source] of [
      ...ROUTES,
      ["service", SERVICE],
    ] as const) {
      for (const role of [
        "super_admin",
        "superAdmin",
        "sales_manager",
        "management",
      ]) {
        assert.ok(
          !code(source).includes(role),
          `${name} must not name the ${role} role`
        );
      }
    }
  });

  test("the confirmation word and bounds are canonical, not retyped", () => {
    const body = code(POLICY_ROUTE);

    assert.match(body, /confirmationText: LEAD_DELETE_CONFIRMATION/);
    assert.match(body, /reasonMin: LEAD_DELETE_REASON_MIN/);
    assert.match(body, /reasonMax: LEAD_DELETE_REASON_MAX/);

    /* Not one of the three values is spelled in the route. */
    for (const literal of ['"DELETE"', "10", "500"]) {
      assert.ok(
        !body.includes(literal),
        `policy must not restate ${literal}`
      );
    }

    /* And they are what the browser form uses. */
    assert.equal(LEAD_DELETE_CONFIRMATION, "DELETE");
    assert.equal(LEAD_DELETE_REASON_MIN, 10);
    assert.equal(LEAD_DELETE_REASON_MAX, 500);

    assert.match(DANGER_ZONE, /LEAD_DELETE_CONFIRMATION/);
    assert.match(DANGER_ZONE, /LEAD_DELETE_REASON_MIN/);
    assert.match(DANGER_ZONE, /LEAD_DELETE_REASON_MAX/);
  });

  test("a caller who may not delete gets an answer, not a refusal", () => {
    /*
     * 200 with canDelete:false. "No" is a complete answer to a capability
     * question; a 403 would make an ordinary screen load look like a failure.
     */
    const body = code(POLICY_ROUTE);

    assert.ok(
      !body.includes("canDeleteLeads) {") &&
        !body.includes('crmMobileError(\n      "forbidden"'),
      "policy must not refuse an authenticated caller"
    );

    assert.ok(!body.includes('"forbidden"'));
  });

  test("no permission map or internal identity is serialised", () => {
    const body = code(POLICY_ROUTE);

    for (const leak of [
      "...auth.context",
      "JSON.stringify(auth.context",
      "auth.context.userId",
      "canReadBroad",
      "canAssignLeads",
    ]) {
      assert.ok(!body.includes(leak), `policy must not expose ${leak}`);
    }
  });
});

/* ====================================================================== */
/* Input                                                                  */
/* ====================================================================== */

describe("the delete route validates through the canonical contract", () => {
  test("a malformed lead id never reaches the RPC", () => {
    assert.match(code(DELETE_ROUTE), /isCrmLeadIdShape\(leadId\)/);

    const body = code(DELETE_ROUTE);

    assert.ok(
      body.indexOf("isCrmLeadIdShape") <
        body.indexOf("deleteLeadForContext"),
      "the shape guard runs first"
    );
  });

  test("the id comes from the path, never the body", () => {
    assert.match(flat(code(DELETE_ROUTE)), /const input = \{ leadId,/);

    assert.ok(
      !code(DELETE_ROUTE).includes('readStringField(body, "leadId")'),
      "a body id could address a different enquiry than the path"
    );
  });

  test("it runs the shared validator, not a second one", () => {
    assert.match(
      code(DELETE_ROUTE),
      /validateLeadDeleteInput\(input\)/
    );

    /* The bounds and the word live in the contract. */
    for (const literal of ['"DELETE"', "length < 10", "> 500"]) {
      assert.ok(
        !code(DELETE_ROUTE).includes(literal),
        `delete must not restate ${literal}`
      );
    }
  });

  test("the validator refuses each field for the right reason", () => {
    const ok = {
      leadId: LEAD_ID,
      reason: "Duplicate test enquiry created in error.",
      expectedUpdatedAt: "2026-09-06T10:00:00.000Z",
      confirmation: "DELETE",
    };

    assert.deepEqual(validateLeadDeleteInput(ok), []);

    const short = validateLeadDeleteInput({
      ...ok,
      reason: "too short",
    });

    assert.equal(short.length, 1);
    assert.equal(short[0]?.field, "reason");

    const long = validateLeadDeleteInput({
      ...ok,
      reason: "x".repeat(LEAD_DELETE_REASON_MAX + 1),
    });

    assert.equal(long.length, 1);
    assert.equal(long[0]?.field, "reason");

    /* Exact and case-sensitive. */
    for (const wrong of ["delete", "Delete", "DELETE ", ""]) {
      const answer = validateLeadDeleteInput({
        ...ok,
        confirmation: wrong,
      });

      assert.equal(
        answer.filter((e) => e.field === "confirmation").length,
        1,
        `"${wrong}" must not confirm`
      );
    }

    assert.equal(
      validateLeadDeleteInput({ ...ok, leadId: "not-a-uuid" })
        .filter((e) => e.field === "leadId").length,
      1
    );
  });

  test("expectedUpdatedAt is required, which the validator does not check", () => {
    /*
     * The gap is easy to miss: `validateLeadDeleteInput` has no rule for it, so
     * an empty value passes validation and would reach an RPC that then cannot
     * stale-check. The browser action guards it separately; so does this route.
     */
    assert.deepEqual(
      validateLeadDeleteInput({
        leadId: LEAD_ID,
        reason: "Duplicate test enquiry created in error.",
        expectedUpdatedAt: "",
        confirmation: "DELETE",
      }),
      []
    );

    assert.match(
      flat(code(DELETE_ROUTE)),
      /if \(!input\.expectedUpdatedAt\) \{ return crmMobileError\( "invalid_request", "Reload the enquiry and try again\.", "VALIDATION_FAILED" \); \}/
    );

    assert.match(
      flat(code(ACTIONS)),
      /if \(!input\.expectedUpdatedAt\) \{/
    );
  });

  test("field errors name the field, in the contract's own words", () => {
    assert.match(
      code(DELETE_ROUTE),
      /leadDeleteFieldErrorsToRecord\(fieldErrors\)/
    );

    assert.match(flat(code(DELETE_ROUTE)), /code: "VALIDATION_FAILED"/);
  });
});

/* ====================================================================== */
/* Permission                                                             */
/* ====================================================================== */

describe("the permission is asserted server-side, twice over", () => {
  test("the service refuses a caller without leads.delete", () => {
    assert.match(
      flat(code(SERVICE)),
      /if \(!context\.canDeleteLeads\) \{ throw new CrmError\(\{ code: "LEAD_DELETE_PERMISSION_DENIED", message: "You are not allowed to delete enquiries\.", httpStatus: 403, \}\); \}/
    );
  });

  test("the route leaves that decision to the service", () => {
    /* One place asserts it, so the two surfaces cannot diverge. */
    assert.ok(
      !code(DELETE_ROUTE).includes("canDeleteLeads"),
      "the route must not re-decide the permission"
    );
  });

  test("and the database checks the permission AND the role regardless", () => {
    /* The migration raises UPPERCASE tokens; the mapper lowercases to match. */
    assert.match(MIGRATION, /CRM_LEAD_DELETE_PERMISSION_DENIED/);
    assert.match(MIGRATION, /CRM_LEAD_DELETE_SUPER_ADMIN_REQUIRED/);
    assert.match(MIGRATION, /authorize\('leads\.delete'\)/i);
  });
});

/* ====================================================================== */
/* Canonical semantics stay in the database                               */
/* ====================================================================== */

describe("every blocker that matters stays in the RPC", () => {
  test("the commercial blockers are the migration's, not the route's", () => {
    for (const token of [
      "CRM_LEAD_DELETE_CONVERTED_BLOCKED",
      "CRM_LEAD_DELETE_STALE",
      "CRM_LEAD_ALREADY_DELETED",
    ]) {
      assert.ok(
        MIGRATION.includes(token),
        `${token} must be raised by the database`
      );
    }

    /* And none of the conditions is re-derived at the edge. */
    for (const [name, source] of [
      ...ROUTES,
      ["service", SERVICE],
    ] as const) {
      for (const rule of [
        "closed_won",
        "quotation",
        "acceptance",
        "project",
      ]) {
        assert.ok(
          !code(source).includes(rule),
          `${name} must not reason about ${rule}`
        );
      }
    }

    /*
     * `updated_at` is the one that needs care rather than absence: the service
     * MUST pass `p_expected_updated_at` through, because that is what lets the
     * database stale-check. What it must not do is compare it to anything.
     */
    assert.match(
      flat(code(SERVICE)),
      /p_expected_updated_at: input\.expectedUpdatedAt,/
    );

    for (const compare of [
      "expectedUpdatedAt >",
      "expectedUpdatedAt <",
      "expectedUpdatedAt ===",
      "expectedUpdatedAt !==",
      "Date.parse",
      "new Date(",
    ]) {
      assert.ok(
        !code(SERVICE).includes(compare),
        `the service must not evaluate staleness (${compare})`
      );
    }

    /* And no route mentions it beyond forwarding the field it was given. */
    for (const [name, source] of ROUTES) {
      assert.ok(
        !code(source).includes("updated_at"),
        `${name} must not name the column`
      );
    }
  });

  test("the tombstone is audit-preserving, and nothing claims otherwise", () => {
    /* A tombstone, never a physical delete. */
    assert.match(MIGRATION, /operational tombstone/i);

    /*
     * Stripped: the delete route's header says out loud that it offers no
     * restore and no hard delete, and saying so is the point of it. What must
     * not appear is a RESPONSE that tells the owner the data is gone.
     */
    for (const [name, source] of ROUTES) {
      for (const wrong of [
        "permanently",
        "erase",
        "purge",
        "hard delete",
        "irreversible",
      ]) {
        assert.ok(
          !code(source).toLowerCase().includes(wrong),
          `${name} must not describe deletion as ${wrong}`
        );
      }
    }
  });

  test("no restore, recycle bin or bulk delete was added", () => {
    for (const [name, source] of [
      ...ROUTES,
      ["service", SERVICE],
    ] as const) {
      for (const extra of [
        "restore",
        "undelete",
        "recycle",
        "bulk",
        "leadIds",
      ]) {
        assert.ok(
          !code(source).includes(extra),
          `${name} must not offer ${extra}`
        );
      }
    }
  });
});

/* ====================================================================== */
/* The answer                                                             */
/* ====================================================================== */

describe("success and failure both answer safely", () => {
  test("success is the canonical three fields", () => {
    assert.match(
      flat(code(DELETE_ROUTE)),
      /NextResponse\.json\(\{ leadId: result\.leadId, deletionReference: result\.deletionReference, deletedAt: result\.deletedAt, \}\)/
    );

    /* The whole RPC row never crosses the wire. */
    assert.ok(!code(DELETE_ROUTE).includes("...result"));
  });

  test("a refusal keeps its canonical code so the app can tell three 409s apart", () => {
    /*
     * STALE, CONVERTED_BLOCKED and ALREADY_DELETED are all HTTP 409 and each
     * asks the owner to do something different. A client that saw only
     * `conflict` would have to match on prose, and prose changes.
     */
    assert.match(
      flat(code(MOBILE_ADMIN)),
      /export function crmMobileDeleteFailure\( error: unknown, label: string \): Response \{ if \(error instanceof CrmError && error\.httpStatus < 500\) \{ return crmMobileError\( mobileCodeForHttpStatus\(error\.httpStatus\), error\.message, error\.code \); \}/
    );

    assert.match(code(DELETE_ROUTE), /crmMobileDeleteFailure\(error, "leads\/delete"\)/);

    /* The three codes and their statuses are the canonical mapper's. */
    for (const [token, status] of [
      ["crm_lead_delete_stale", "409"],
      ["crm_lead_delete_converted_blocked", "409"],
      ["crm_lead_already_deleted", "409"],
      ["crm_lead_delete_not_found", "404"],
      ["crm_lead_delete_permission_denied", "403"],
    ] as const) {
      const at = ERRORS.indexOf(token);
      assert.ok(at > 0, `${token} must be mapped`);

      assert.match(
        ERRORS.slice(at, at + 400),
        new RegExp(`httpStatus: ${status}`),
        token
      );
    }
  });

  test("nothing internal is ever returned", () => {
    for (const [name, source] of ROUTES) {
      const body = code(source);

      for (const leak of [
        "error.message",
        ".stack",
        "error.details",
        "SQLSTATE",
        "PostgrestError",
      ]) {
        assert.ok(
          !body.includes(leak),
          `${name} must not return ${leak}`
        );
      }
    }

    /* The 500-and-above case is replaced, not forwarded. */
    assert.match(
      flat(code(MOBILE_ADMIN)),
      /console\.error\(`\[mobile\/crm\] \$\{label\}`, error\); return crmMobileError\( "unavailable", "This enquiry could not be deleted right now\. Try again\." \);/
    );
  });

  test("the extended envelope is opt-in, so every other route is unchanged", () => {
    assert.match(
      flat(code(MOBILE_AUTH)),
      /canonicalCode \? \{ error: code, message, code: canonicalCode \} : \{ error: code, message \}/
    );

    /* The parameter is optional; existing callers pass two arguments. */
    assert.match(
      flat(code(MOBILE_AUTH)),
      /message: string, canonicalCode\?: string \): Response/
    );
  });
});

/* ====================================================================== */
/* The browser is unchanged                                               */
/* ====================================================================== */

describe("the browser deletion flow still works the same way", () => {
  test("its entry point survives and still calls the RPC directly", () => {
    assert.match(
      SERVICE,
      /export async function deleteLeadForCurrentUser\(/
    );

    assert.match(
      flat(code(SERVICE)),
      /return callDeleteLeadTombstone\(await resolveCrmDb\(\), input\);/
    );

    /*
     * No context argument was added to it. The browser action asserts the
     * permission before it gets here, exactly as it did before this change.
     */
    assert.match(
      flat(code(ACTIONS)),
      /if \(!context\.canDeleteLeads\) \{/
    );

    assert.match(
      code(ACTIONS),
      /deleteLeadForCurrentUser\(input\)/
    );
  });

  test("the injected client is optional, so the browser passes none", () => {
    assert.ok(SERVICE.includes("db?: CrmDb"));
    assert.ok(!/db:\s*CrmDb[,)]/.test(SERVICE));
    assert.match(SERVICE, /resolveCrmDb\(db\)/);
    assert.ok(!SERVICE.includes("await createClient()"));
  });

  test("one RPC call, shared by both surfaces", () => {
    assert.equal(
      (code(SERVICE).match(/delete_lead_tombstone/g) ?? []).length,
      1
    );

    assert.equal(
      (code(SERVICE).match(/callDeleteLeadTombstone\(/g) ?? []).length,
      3
    );
  });

  test("the danger zone and its page gate are untouched", () => {
    assert.match(DANGER_ZONE, /deleteLeadAction/);
    assert.match(DANGER_ZONE, /name="expectedUpdatedAt"/);
    assert.match(LEAD_PAGE, /context\?\.canDeleteLeads \? \(/);
    assert.match(LEAD_PAGE, /LeadDeleteDangerZone/);
  });

  test("the action still revalidates and redirects", () => {
    assert.match(code(ACTIONS), /revalidatePath/);
    assert.match(code(ACTIONS), /redirect\("\/admin\/crm\/leads"\)/);
  });
});
