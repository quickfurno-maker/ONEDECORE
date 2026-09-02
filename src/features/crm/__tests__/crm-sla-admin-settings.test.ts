/**
 * CRM SLA admin settings — Super Admin settings screen certification.
 *
 * Proves the permission probe, the page guard, permission-gated navigation,
 * the narrow first_contact read, the RPC-only write path, the unsaved
 * Mon–Sat 09:00–19:00 draft when the DB config is null, server-side validation
 * before any RPC call, and the containment boundaries this slice must not
 * cross (no direct table write, no service role, no app-supplied activation
 * timestamps, no new migration).
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  DEFAULT_BUSINESS_HOURS_DRAFT,
  FIRST_CONTACT_SLA_POLICY_CODE,
  SLA_NON_RETROACTIVE_NOTE,
  SLA_TARGET_MINUTES_MAX,
  SLA_TARGET_MINUTES_MIN,
  SLA_WEEKDAY_KEYS,
  buildSlaPolicyFormModel,
  formatSlaTimestamp,
  hhmmToMinutes,
  isValidHhMm,
  mapCrmSlaPolicyRow,
  parseBusinessHoursConfig,
  readSlaPolicyForm,
  serializeBusinessHoursConfig,
  validateUpdateCrmSlaPolicyInput,
  type CrmSlaPolicyDto,
  type SlaWeekdayFormRow,
  type UpdateCrmSlaPolicyInput,
} from "../contracts/sla-policy-contracts.ts";

const root = process.cwd();
const readSrc = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Strips comments so an assertion tests CODE, never explanatory prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CONTRACTS = "src/features/crm/contracts/sla-policy-contracts.ts";
const SERVICE = "src/features/crm/server/crm-sla-policy-service.ts";
const ACTIONS = "src/features/crm/server/crm-sla-policy-actions.ts";
const PANEL = "src/features/crm/components/settings/SlaSettingsPanel.tsx";
const PAGE = "src/app/admin/crm/settings/sla/page.tsx";
const CRM_AUTH = "src/features/crm/server/crm-auth.ts";
const CRM_PERMISSIONS = "src/features/crm/server/crm-permissions.ts";
const SIDEBAR = "src/features/admin-ops/components/AdminSidebar.tsx";
const NAV_FLAGS = "src/features/admin-ops/server/resolve-ops-nav-flags.ts";
const OPS_TYPES = "src/features/admin-ops/types.ts";
const SLA_MIGRATION =
  "supabase/migrations/20260827140000_crm_business_sla_foundation.sql";

const serviceSrc = stripComments(readSrc(SERVICE));
const actionsSrc = stripComments(readSrc(ACTIONS));
const panelSrc = stripComments(readSrc(PANEL));
const pageSrc = stripComments(readSrc(PAGE));
const contractsSrc = stripComments(readSrc(CONTRACTS));

const SLICE_SOURCES: ReadonlyArray<readonly [string, string]> = [
  [CONTRACTS, contractsSrc],
  [SERVICE, serviceSrc],
  [ACTIONS, actionsSrc],
  [PANEL, panelSrc],
  [PAGE, pageSrc],
];

function policy(overrides: Partial<CrmSlaPolicyDto> = {}): CrmSlaPolicyDto {
  return {
    policyCode: FIRST_CONTACT_SLA_POLICY_CODE,
    targetBusinessMinutes: 60,
    timezone: "Asia/Kolkata",
    businessHoursEnabled: false,
    businessHoursConfig: null,
    isActive: false,
    effectiveFrom: null,
    activatedAt: null,
    updatedAt: "2026-08-27T14:00:00.000Z",
    ...overrides,
  };
}

function rows(
  overrides: Partial<Record<(typeof SLA_WEEKDAY_KEYS)[number], Partial<SlaWeekdayFormRow>>> = {}
): readonly SlaWeekdayFormRow[] {
  return SLA_WEEKDAY_KEYS.map((day) => ({
    day,
    open: day !== "sunday",
    start: "09:00",
    end: "19:00",
    ...(overrides[day] ?? {}),
  }));
}

function input(
  overrides: Partial<UpdateCrmSlaPolicyInput> = {}
): UpdateCrmSlaPolicyInput {
  return {
    targetBusinessMinutes: 60,
    timezone: "Asia/Kolkata",
    businessHoursEnabled: true,
    isActive: false,
    weekdays: rows(),
    ...overrides,
  };
}

/* ========================================================================== */
/* 1. crm.sla.manage is probed                                                 */
/* ========================================================================== */

describe("SLA settings authorization probe", () => {
  test("a dedicated probe asks the DB authorize() for crm.sla.manage", () => {
    const src = stripComments(readSrc(CRM_PERMISSIONS));
    assert.match(src, /export async function probeSlaPolicyPermissions/);
    assert.match(
      src,
      /probeSlaPolicyPermissions[\s\S]*?requested_permission:\s*"crm\.sla\.manage"/
    );
    assert.match(
      src,
      /probeSlaPolicyPermissions[\s\S]*?canManageSlaPolicy:\s*!error && data === true/
    );
  });

  test("the probe result is carried on the CRM access context", () => {
    const access = stripComments(
      readSrc("src/features/crm/contracts/crm-access.ts")
    );
    const auth = stripComments(readSrc(CRM_AUTH));
    assert.match(access, /readonly canManageSlaPolicy: boolean;/);
    assert.match(auth, /probeSlaPolicyPermissions\(\),/);
    assert.match(
      auth,
      /canManageSlaPolicy:\s*slaPolicyPermissions\.canManageSlaPolicy,/
    );
  });

  test("the permission is super_admin only in the shipped migration", () => {
    const sql = stripComments(readSrc(SLA_MIGRATION));
    assert.match(sql, /'crm\.sla\.manage'/);
    assert.match(
      sql,
      /where p\.code = 'crm\.sla\.manage'\s*\n\s*and r\.code = 'super_admin'/
    );
  });
});

/* ========================================================================== */
/* 2. Unauthorized access is blocked server-side                               */
/* ========================================================================== */

describe("SLA settings page guard", () => {
  test("a server guard redirects anyone without crm.sla.manage", () => {
    const auth = stripComments(readSrc(CRM_AUTH));
    assert.match(auth, /export async function requireCrmSlaPolicyAccess/);
    assert.match(
      auth,
      /requireCrmSlaPolicyAccess[\s\S]*?currentPath: string = "\/admin\/crm\/settings\/sla"/
    );
    assert.match(
      auth,
      /requireCrmSlaPolicyAccess[\s\S]*?resolution\.kind === "unauthenticated"[\s\S]*?redirect\(loginUrl\)/
    );
    assert.match(
      auth,
      /requireCrmSlaPolicyAccess[\s\S]*?resolution\.kind === "inactive"[\s\S]*?redirect\("\/auth\/forbidden"\)/
    );
    assert.match(
      auth,
      /requireCrmSlaPolicyAccess[\s\S]*?resolution\.kind === "denied" \|\| !resolution\.context\.canManageSlaPolicy[\s\S]*?redirect\("\/auth\/forbidden"\)/
    );
  });

  test("the page awaits the guard before reading the policy", () => {
    assert.match(pageSrc, /await requireCrmSlaPolicyAccess\(\)/);
    const guardIndex = pageSrc.indexOf("requireCrmSlaPolicyAccess()");
    const readIndex = pageSrc.indexOf("fetchFirstContactSlaPolicy()");
    assert.ok(guardIndex > -1 && readIndex > guardIndex);
  });

  test("the server action re-runs the guard, never trusting the client", () => {
    assert.match(actionsSrc, /await requireCrmSlaPolicyAccess\(\)/);
    const guardIndex = actionsSrc.indexOf("await requireCrmSlaPolicyAccess()");
    const mutateIndex = actionsSrc.indexOf("updateFirstContactSlaPolicy(");
    assert.ok(guardIndex > -1 && mutateIndex > guardIndex);
  });

  test("the service independently denies callers without the permission", () => {
    assert.match(serviceSrc, /if \(!context\.canManageSlaPolicy\)/);
    assert.match(serviceSrc, /CRM_SLA_PERMISSION_DENIED/);
    assert.match(serviceSrc, /CRM_SLA_AUTH_REQUIRED/);
    assert.match(serviceSrc, /await requireSlaManageContext\(\);[\s\S]*?from\("crm_sla_policies"\)/);
    assert.match(
      serviceSrc,
      /await requireSlaManageContext\(\);[\s\S]*?rpc\("update_crm_sla_policy"/
    );
  });
});

/* ========================================================================== */
/* 3. Sidebar visibility follows the same permission                           */
/* ========================================================================== */

describe("SLA settings navigation", () => {
  test("the CRM sidebar child is gated on the SLA nav flag", () => {
    const sidebar = stripComments(readSrc(SIDEBAR));
    assert.match(
      sidebar,
      /if \(flags\.crmSlaSettings\) \{[\s\S]*?href: "\/admin\/crm\/settings\/sla",[\s\S]*?label: "SLA Settings",[\s\S]*?\}\);\s*\}/
    );
    // The item is pushed into the CRM parent's children, not a new top group.
    const childrenStart = sidebar.indexOf("const children: NavItem[] = [");
    const slaIndex = sidebar.indexOf("flags.crmSlaSettings");
    const salesPush = sidebar.indexOf('sales.push({ href: "/admin/crm"');
    assert.ok(childrenStart > -1 && slaIndex > childrenStart && slaIndex < salesPush);
  });

  test("the nav flag is derived from crm.sla.manage only", () => {
    const flags = stripComments(readSrc(NAV_FLAGS));
    const types = stripComments(readSrc(OPS_TYPES));
    assert.match(types, /readonly crmSlaSettings: boolean;/);
    assert.match(
      flags,
      /crmSlaSettings:\s*crmContext\?\.canManageSlaPolicy \?\? false,/
    );
    assert.doesNotMatch(flags, /crmSlaSettings:\s*(true|showCrmLink)/);
  });

  test("hidden without the permission, visible with it", () => {
    const sidebar = stripComments(readSrc(SIDEBAR));
    const block =
      /if \(flags\.crmSlaSettings\) \{\s*children\.push\(\{\s*href: "\/admin\/crm\/settings\/sla",/;
    assert.match(sidebar, block);
    // No unconditional SLA href anywhere else in the sidebar.
    const occurrences = sidebar.split('"/admin/crm/settings/sla"').length - 1;
    assert.equal(occurrences, 1);
  });
});

/* ========================================================================== */
/* 4. Read path targets exactly first_contact                                  */
/* ========================================================================== */

describe("SLA policy read path", () => {
  test("reads only the first_contact row with a narrow column list", () => {
    assert.equal(FIRST_CONTACT_SLA_POLICY_CODE, "first_contact");
    assert.match(serviceSrc, /\.from\("crm_sla_policies"\)/);
    assert.match(
      serviceSrc,
      /\.eq\("policy_code", FIRST_CONTACT_SLA_POLICY_CODE\)/
    );
    assert.match(serviceSrc, /\.maybeSingle\(\)/);
    assert.doesNotMatch(serviceSrc, /select\("\*"\)/);
    for (const column of [
      "policy_code",
      "target_business_minutes",
      "timezone",
      "business_hours_enabled",
      "business_hours_config",
      "is_active",
      "effective_from",
      "activated_at",
      "updated_at",
    ]) {
      assert.ok(
        serviceSrc.includes(column),
        `POLICY_COLUMNS must select ${column}`
      );
    }
  });

  test("a missing policy row fails clearly instead of rendering empty", () => {
    assert.match(serviceSrc, /if \(!data\) \{[\s\S]*?CRM_SLA_POLICY_NOT_FOUND/);
    assert.match(serviceSrc, /httpStatus: 404/);
  });

  test("the DTO is the narrow documented shape", () => {
    const dto = mapCrmSlaPolicyRow({
      policy_code: "first_contact",
      target_business_minutes: 60,
      timezone: "Asia/Kolkata",
      business_hours_enabled: true,
      business_hours_config: {
        monday: { start: "09:00", end: "19:00" },
      },
      is_active: true,
      effective_from: "2026-09-02T03:30:00.000Z",
      activated_at: "2026-09-02T03:30:00.000Z",
      updated_at: "2026-09-02T03:30:00.000Z",
    });

    assert.deepEqual(Object.keys(dto).sort(), [
      "activatedAt",
      "businessHoursConfig",
      "businessHoursEnabled",
      "effectiveFrom",
      "isActive",
      "policyCode",
      "targetBusinessMinutes",
      "timezone",
      "updatedAt",
    ]);
    assert.deepEqual(dto.businessHoursConfig, {
      monday: { start: "09:00", end: "19:00" },
    });
  });

  test("malformed jsonb config is discarded, never half-trusted", () => {
    assert.equal(parseBusinessHoursConfig(null), null);
    assert.equal(parseBusinessHoursConfig("nope"), null);
    assert.equal(parseBusinessHoursConfig([]), null);
    assert.equal(parseBusinessHoursConfig({ funday: { start: "09:00", end: "19:00" } }), null);
    assert.equal(parseBusinessHoursConfig({ monday: { start: "9:00", end: "19:00" } }), null);
    assert.deepEqual(
      parseBusinessHoursConfig({
        monday: { start: "09:00", end: "19:00" },
        funday: { start: "09:00", end: "19:00" },
      }),
      { monday: { start: "09:00", end: "19:00" } }
    );
  });
});

/* ========================================================================== */
/* 5-6. Write path is the RPC only; no direct table write, no service role     */
/* ========================================================================== */

describe("SLA policy write containment", () => {
  test("the only mutation is the canonical authenticated RPC", () => {
    assert.match(serviceSrc, /supabase\.rpc\("update_crm_sla_policy", \{/);
    const rpcCalls = serviceSrc.match(/\.rpc\(/g) ?? [];
    assert.equal(rpcCalls.length, 1);
    assert.match(serviceSrc, /p_policy_code: FIRST_CONTACT_SLA_POLICY_CODE/);
  });

  test("this slice never writes crm_sla_policies directly", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(src, /\.insert\(/, `${name} must not insert`);
      assert.doesNotMatch(src, /\.update\(/, `${name} must not update`);
      assert.doesNotMatch(src, /\.upsert\(/, `${name} must not upsert`);
      assert.doesNotMatch(src, /\.delete\(/, `${name} must not delete`);
      assert.doesNotMatch(
        src,
        /from\("crm_sla_policies"\)[\s\S]{0,200}?\.(insert|update|upsert|delete)\(/,
        `${name} must not mutate crm_sla_policies directly`
      );
    }
  });

  test("the private impl is never called from application code", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(
        src,
        /update_crm_sla_policy_impl/,
        `${name} must not call the private impl`
      );
      assert.doesNotMatch(src, /\bprivate\./, `${name} must not reach private schema`);
    }
  });

  test("no service role anywhere in the slice", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(src, /service_role/i, `${name} must not use service role`);
      assert.doesNotMatch(
        src,
        /SUPABASE_SERVICE_ROLE_KEY/,
        `${name} must not use the service role key`
      );
      assert.doesNotMatch(
        src,
        /createServiceClient|createAdminClient|serviceClient/,
        `${name} must not build a privileged client`
      );
    }
    assert.match(serviceSrc, /from "@\/lib\/supabase\/server"/);
  });

  test("the app never supplies effective_from, activated_at or updated_by", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(src, /p_effective_from/, `${name}`);
      assert.doesNotMatch(src, /p_activated_at/, `${name}`);
      assert.doesNotMatch(src, /p_updated_by/, `${name}`);
      assert.doesNotMatch(src, /updated_by/, `${name}`);
    }

    // The RPC payload block itself carries no activation columns.
    const payloadStart = serviceSrc.indexOf('rpc("update_crm_sla_policy", {');
    const payloadEnd = serviceSrc.indexOf("});", payloadStart);
    assert.ok(payloadStart > -1 && payloadEnd > payloadStart);
    const payload = serviceSrc.slice(payloadStart, payloadEnd);
    assert.doesNotMatch(payload, /effective/i);
    assert.doesNotMatch(payload, /activated/i);
    assert.doesNotMatch(payload, /updated_by|updatedBy/i);

    // The RPC argument surface is exactly the seven documented parameters.
    const args = payload.match(/p_[a-z_]+:/g) ?? [];
    assert.deepEqual(args.sort(), [
      "p_business_hours_config:",
      "p_business_hours_enabled:",
      "p_clear_business_hours_config:",
      "p_is_active:",
      "p_policy_code:",
      "p_target_business_minutes:",
      "p_timezone:",
    ]);

    // effective_from / activated_at are only ever READ off a returned DB row.
    const assignments = (source: string, field: string): readonly string[] =>
      (source.match(new RegExp(`${field}: [^,\\r\\n]+`, "g")) ?? []).filter(
        (entry) => !entry.endsWith("string | null;")
      );

    assert.deepEqual(assignments(contractsSrc, "effectiveFrom"), [
      "effectiveFrom: row.effective_from",
    ]);
    assert.deepEqual(assignments(contractsSrc, "activatedAt"), [
      "activatedAt: row.activated_at",
    ]);
    assert.deepEqual(assignments(serviceSrc, "effectiveFrom"), []);
    assert.deepEqual(assignments(serviceSrc, "activatedAt"), []);
  });

  test("the RPC signature in the migration is unchanged by this slice", () => {
    const sql = stripComments(readSrc(SLA_MIGRATION));
    assert.match(
      sql,
      /create or replace function public\.update_crm_sla_policy\(\s*p_policy_code text,\s*p_target_business_minutes integer default null,\s*p_timezone text default null,\s*p_business_hours_enabled boolean default null,\s*p_business_hours_config jsonb default null,\s*p_clear_business_hours_config boolean default false,\s*p_is_active boolean default null\s*\)/
    );
  });
});

/* ========================================================================== */
/* 7-8. Null config draft, and closed days omitted from the payload            */
/* ========================================================================== */

describe("null config draft behaviour", () => {
  test("the owner-approved draft is Mon-Sat 09:00-19:00 with Sunday closed", () => {
    assert.deepEqual(DEFAULT_BUSINESS_HOURS_DRAFT, {
      monday: { start: "09:00", end: "19:00" },
      tuesday: { start: "09:00", end: "19:00" },
      wednesday: { start: "09:00", end: "19:00" },
      thursday: { start: "09:00", end: "19:00" },
      friday: { start: "09:00", end: "19:00" },
      saturday: { start: "09:00", end: "19:00" },
    });
    assert.equal("sunday" in DEFAULT_BUSINESS_HOURS_DRAFT, false);
  });

  test("a null DB config yields an UNSAVED draft form model", () => {
    const model = buildSlaPolicyFormModel(policy({ businessHoursConfig: null }));

    assert.equal(model.isBusinessHoursDraft, true);
    assert.equal(model.weekdays.length, 7);
    assert.deepEqual(
      model.weekdays.filter((row) => row.open).map((row) => row.day),
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    );
    assert.equal(model.weekdays.find((row) => row.day === "sunday")?.open, false);
    for (const row of model.weekdays.filter((entry) => entry.open)) {
      assert.equal(row.start, "09:00");
      assert.equal(row.end, "19:00");
    }
  });

  test("a persisted config is never labelled a draft", () => {
    const model = buildSlaPolicyFormModel(
      policy({
        businessHoursConfig: { monday: { start: "10:00", end: "18:00" } },
      })
    );
    assert.equal(model.isBusinessHoursDraft, false);
    assert.equal(model.weekdays.filter((row) => row.open).length, 1);
    assert.equal(model.weekdays[0]?.start, "10:00");
  });

  test("the draft is a form-only default — nothing is written before Save", () => {
    assert.doesNotMatch(
      serviceSrc,
      /DEFAULT_BUSINESS_HOURS_DRAFT/,
      "the read/write service must not persist the draft"
    );
    assert.doesNotMatch(pageSrc, /DEFAULT_BUSINESS_HOURS_DRAFT/);
    assert.doesNotMatch(actionsSrc, /DEFAULT_BUSINESS_HOURS_DRAFT/);
    // The panel labels it explicitly.
    assert.match(panelSrc, /model\.isBusinessHoursDraft/);
    assert.match(panelSrc, /Draft — not yet saved\./);
  });

  test("closed days are omitted from the serialized JSON", () => {
    const config = serializeBusinessHoursConfig(rows());
    assert.ok(config);
    assert.equal("sunday" in (config ?? {}), false);
    assert.deepEqual(Object.keys(config ?? {}), [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]);
    assert.equal(JSON.stringify(config).includes("sunday"), false);
    assert.equal(JSON.stringify(config).includes("null"), false);
    assert.equal(JSON.stringify(config).includes("false"), false);
  });

  test("a closed day's leftover times never leak into the payload", () => {
    const config = serializeBusinessHoursConfig(
      rows({ sunday: { open: false, start: "11:00", end: "16:00" } })
    );
    assert.equal(JSON.stringify(config).includes("11:00"), false);
  });

  test("zero open days clears the config rather than sending an empty object", () => {
    const config = serializeBusinessHoursConfig(
      SLA_WEEKDAY_KEYS.map((day) => ({ day, open: false, start: "09:00", end: "19:00" }))
    );
    assert.equal(config, null);
    assert.match(
      serviceSrc,
      /p_clear_business_hours_config: businessHoursConfig === null/
    );
    assert.match(serviceSrc, /p_business_hours_config: businessHoursConfig/);
  });
});

/* ========================================================================== */
/* 9. Server validation fails before the RPC                                   */
/* ========================================================================== */

describe("server-side validation before any RPC call", () => {
  test("validation runs before the RPC in the service", () => {
    const validateIndex = serviceSrc.indexOf("validateUpdateCrmSlaPolicyInput(");
    const rpcIndex = serviceSrc.indexOf('rpc("update_crm_sla_policy"');
    assert.ok(validateIndex > -1);
    assert.ok(rpcIndex > validateIndex);
    assert.match(
      serviceSrc,
      /if \(validationErrors\.length > 0\) \{[\s\S]*?throw new CrmError/
    );
  });

  test("target minutes must be a whole number in 1..10080", () => {
    assert.equal(SLA_TARGET_MINUTES_MIN, 1);
    assert.equal(SLA_TARGET_MINUTES_MAX, 10_080);
    for (const value of [0, -1, 10_081, 1.5, Number.NaN]) {
      const errors = validateUpdateCrmSlaPolicyInput(
        input({ targetBusinessMinutes: value })
      );
      assert.ok(
        errors.some((error) => error.field === "targetBusinessMinutes"),
        `${value} must be rejected`
      );
    }
    assert.equal(
      validateUpdateCrmSlaPolicyInput(input({ targetBusinessMinutes: 1 })).length,
      0
    );
    assert.equal(
      validateUpdateCrmSlaPolicyInput(input({ targetBusinessMinutes: 10_080 })).length,
      0
    );
  });

  test("timezone must be non-empty", () => {
    const errors = validateUpdateCrmSlaPolicyInput(input({ timezone: "   " }));
    assert.ok(errors.some((error) => error.field === "timezone"));
  });

  test("open days require valid HH:MM start and end", () => {
    assert.equal(isValidHhMm("09:00"), true);
    assert.equal(isValidHhMm("23:59"), true);
    assert.equal(isValidHhMm("24:00"), false);
    assert.equal(isValidHhMm("9:00"), false);
    assert.equal(isValidHhMm("09:60"), false);
    assert.equal(isValidHhMm(""), false);
    assert.equal(hhmmToMinutes("09:30"), 570);
    assert.equal(hhmmToMinutes("bad"), null);

    const errors = validateUpdateCrmSlaPolicyInput(
      input({ weekdays: rows({ monday: { start: "", end: "19:00" } }) })
    );
    assert.ok(errors.some((error) => error.field === "weekday.monday"));
  });

  test("start must be strictly before end", () => {
    for (const window of [
      { start: "19:00", end: "09:00" },
      { start: "09:00", end: "09:00" },
    ]) {
      const errors = validateUpdateCrmSlaPolicyInput(
        input({ weekdays: rows({ tuesday: window }) })
      );
      assert.ok(
        errors.some((error) => error.field === "weekday.tuesday"),
        `${window.start}-${window.end} must be rejected`
      );
    }
  });

  test("a closed day with invalid times is not an error", () => {
    const errors = validateUpdateCrmSlaPolicyInput(
      input({ weekdays: rows({ sunday: { open: false, start: "", end: "" } }) })
    );
    assert.equal(errors.length, 0);
  });

  test("Active with no open day fails before the RPC", () => {
    const errors = validateUpdateCrmSlaPolicyInput(
      input({
        isActive: true,
        businessHoursEnabled: true,
        weekdays: SLA_WEEKDAY_KEYS.map((day) => ({
          day,
          open: false,
          start: "09:00",
          end: "19:00",
        })),
      })
    );
    assert.ok(errors.some((error) => error.field === "isActive"));
  });

  test("Active without business hours enabled fails", () => {
    const errors = validateUpdateCrmSlaPolicyInput(
      input({ isActive: true, businessHoursEnabled: false })
    );
    assert.ok(errors.some((error) => error.field === "isActive"));
  });

  test("business_hours_enabled must stay consistent with the form", () => {
    const errors = validateUpdateCrmSlaPolicyInput(
      input({
        businessHoursEnabled: true,
        weekdays: SLA_WEEKDAY_KEYS.map((day) => ({
          day,
          open: false,
          start: "09:00",
          end: "19:00",
        })),
      })
    );
    assert.ok(errors.some((error) => error.field === "businessHoursEnabled"));
  });

  test("the owner-approved policy draft validates cleanly", () => {
    assert.deepEqual(
      validateUpdateCrmSlaPolicyInput(
        input({ businessHoursEnabled: true, isActive: true })
      ),
      []
    );
  });

  test("form parsing matches the rendered field names", () => {
    const values: Record<string, string> = {
      targetBusinessMinutes: " 90 ",
      timezone: " Asia/Kolkata ",
      businessHoursEnabled: "on",
      isActive: "on",
      "weekday.monday.open": "on",
      "weekday.monday.start": "09:00",
      "weekday.monday.end": "19:00",
    };
    const parsed = readSlaPolicyForm((name) => values[name] ?? null);

    assert.equal(parsed.targetBusinessMinutes, 90);
    assert.equal(parsed.timezone, "Asia/Kolkata");
    assert.equal(parsed.businessHoursEnabled, true);
    assert.equal(parsed.isActive, true);
    assert.equal(parsed.weekdays.length, 7);
    assert.equal(parsed.weekdays.find((row) => row.day === "monday")?.open, true);
    assert.equal(parsed.weekdays.find((row) => row.day === "sunday")?.open, false);

    // Non-numeric input becomes NaN and is rejected, never coerced to 0.
    const bad = readSlaPolicyForm((name) =>
      name === "targetBusinessMinutes" ? "sixty" : null
    );
    assert.equal(Number.isNaN(bad.targetBusinessMinutes), true);
    assert.ok(
      validateUpdateCrmSlaPolicyInput(bad).some(
        (error) => error.field === "targetBusinessMinutes"
      )
    );

    // The panel renders one row per weekday key from the same source list.
    assert.match(panelSrc, /model\.weekdays\.map\(\(row\) =>/);
    assert.match(panelSrc, /name=\{`weekday\.\$\{row\.day\}\.open`\}/);
    assert.match(panelSrc, /name=\{`weekday\.\$\{row\.day\}\.start`\}/);
    assert.match(panelSrc, /name=\{`weekday\.\$\{row\.day\}\.end`\}/);
    assert.equal(buildSlaPolicyFormModel(policy()).weekdays.length, SLA_WEEKDAY_KEYS.length);
    assert.match(panelSrc, /name="targetBusinessMinutes"/);
    assert.match(panelSrc, /name="timezone"/);
    assert.match(panelSrc, /name="businessHoursEnabled"/);
    assert.match(panelSrc, /name="isActive"/);
  });
});

/* ========================================================================== */
/* 10. Success revalidates the route and surfaces success                      */
/* ========================================================================== */

describe("save feedback", () => {
  test("a successful save revalidates the SLA route", () => {
    assert.match(actionsSrc, /revalidatePath\(CRM_SLA_SETTINGS_PATH\)/);
    assert.match(contractsSrc, /CRM_SLA_SETTINGS_PATH = "\/admin\/crm\/settings\/sla"/);
    const revalidateIndex = actionsSrc.indexOf("revalidatePath(");
    const successIndex = actionsSrc.indexOf("success: true");
    assert.ok(revalidateIndex > -1 && successIndex > revalidateIndex);
  });

  test("success text is derived from the persisted RPC result, not the form", () => {
    assert.match(actionsSrc, /const policy = await updateFirstContactSlaPolicy\(input\)/);
    assert.match(actionsSrc, /policy\.isActive\s*\?/);
    assert.doesNotMatch(actionsSrc, /input\.isActive\s*\?/);
  });

  test("failures return a message instead of a partial success", () => {
    assert.match(actionsSrc, /catch \(error: unknown\) \{\s*return toSlaPolicyActionState\(error\)/);
    assert.match(actionsSrc, /success: false/);
  });

  test("the panel shows a pending label and renders server state", () => {
    assert.match(panelSrc, /\{pending \? "Saving\.\.\." : "Save SLA settings"\}/);
    assert.match(panelSrc, /useActionState\(\s*updateCrmSlaPolicyAction/);
    assert.match(panelSrc, /role="status"/);
    // Inputs are seeded from the server-rendered policy, remounted per version.
    assert.match(panelSrc, /key=\{policy\.updatedAt\}/);
    assert.doesNotMatch(panelSrc, /useState\(/);
  });
});

/* ========================================================================== */
/* 11. Active / effective / activated state renders                            */
/* ========================================================================== */

describe("status block", () => {
  test("the badge, effective-from and activated-at are rendered from the DTO", () => {
    assert.match(panelSrc, /isActive \? "Active" : "Inactive"/);
    assert.match(panelSrc, /label="Effective from" value=\{formatSlaTimestamp\(policy\.effectiveFrom\)\}/);
    assert.match(panelSrc, /label="Activated at" value=\{formatSlaTimestamp\(policy\.activatedAt\)\}/);
  });

  test("the non-retroactive note is shown verbatim", () => {
    assert.equal(
      SLA_NON_RETROACTIVE_NOTE,
      "First activation is non-retroactive. Existing SLA clocks are not silently rescoped."
    );
    assert.match(panelSrc, /\{SLA_NON_RETROACTIVE_NOTE\}/);
  });

  test("unset activation timestamps render as an explicit dash", () => {
    assert.equal(formatSlaTimestamp(null), "—");
    assert.equal(formatSlaTimestamp("not-a-date"), "—");
    assert.equal(
      formatSlaTimestamp("2026-09-02T03:30:00.000Z"),
      "2026-09-02 03:30 UTC"
    );
  });

  test("activation is never inferred locally", () => {
    const activePolicy = policy({
      isActive: true,
      businessHoursEnabled: true,
      businessHoursConfig: { monday: { start: "09:00", end: "19:00" } },
      effectiveFrom: "2026-09-02T03:30:00.000Z",
      activatedAt: "2026-09-02T03:30:00.000Z",
    });
    const model = buildSlaPolicyFormModel(activePolicy);
    assert.equal(model.isActive, true);
    assert.equal(activePolicy.effectiveFrom, "2026-09-02T03:30:00.000Z");
    assert.doesNotMatch(panelSrc, /new Date\(\)/);
    assert.doesNotMatch(panelSrc, /Date\.now\(\)/);
  });

  test("the page header and route are the specified ones", () => {
    assert.match(pageSrc, /title="SLA Settings"/);
    assert.match(pageSrc, /first-contact response target/);
    assert.match(pageSrc, /export const dynamic = "force-dynamic"/);
    assert.match(panelSrc, /Policy: First Contact/);
  });
});

/* ========================================================================== */
/* 12. No migration, no DB semantic change                                     */
/* ========================================================================== */

describe("containment", () => {
  test("migration ledger is 50 after the Workforce V1 lifecycle migration", () => {
    const migrations = readdirSync(join(root, "supabase/migrations")).filter(
      (name) => name.endsWith(".sql")
    );
    assert.equal(migrations.length, 50);
    // CRM SLA admin settings itself added no migration; the 50th is
    // Workforce V1 attendance lifecycle.
    assert.ok(
      migrations.includes("20260902160000_workforce_attendance_v1_lifecycle.sql")
    );
  });

  test("this slice adds no SQL of its own", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(src, /create or replace function/i, name);
      assert.doesNotMatch(src, /alter table/i, name);
      assert.doesNotMatch(src, /grant execute/i, name);
    }
  });

  test("the SLA foundation migration is untouched by this slice", () => {
    const sql = readSrc(SLA_MIGRATION);
    assert.match(sql, /create table public\.crm_sla_policies/);
    assert.match(sql, /grant select on table public\.crm_sla_policies to authenticated/);
    assert.match(
      sql,
      /grant execute on function public\.update_crm_sla_policy\(text, integer, text, boolean, jsonb, boolean, boolean\)\s*\n\s*to authenticated;/
    );
    assert.doesNotMatch(sql, /grant .*crm_sla_policies to (anon|public)\b/);
  });

  test("no policy history, holidays, or multi-policy scope crept in", () => {
    for (const [name, src] of SLICE_SOURCES) {
      assert.doesNotMatch(src, /holiday/i, name);
      assert.doesNotMatch(src, /policy_history|policyHistory/i, name);
    }
    assert.doesNotMatch(serviceSrc, /policy_code", "(?!first_contact)/);
  });
});
