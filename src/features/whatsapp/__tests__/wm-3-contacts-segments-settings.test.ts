/**
 * WM-3 — Contacts, Segments and Settings & Compliance runtime/UI.
 *
 * The database half (permissions, RLS, RPC refusals, append-only guards) is
 * owned by supabase/migrations/20260914100000_whatsapp_contacts_consent_segments_policy.sql.
 * This suite proves the application half builds directly against it: the
 * contracts mirror its allowlists, the pages and actions gate on its exact
 * permissions through the caller's session, and P5 records MARKETING grants
 * only as explicit customer evidence. The deterministic inbound STOP
 * integration is untouched.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildWhatsappContactsHref,
  deriveWhatsappContactPreferenceStates,
  optedOutCategories,
  parseWhatsappContactsPayload,
  parseWhatsappContactsQuery,
  preferenceStateFor,
  presentWhatsappMarketingConsent,
  toWhatsappMarketingConsentState,
  WHATSAPP_MARKETING_PREFERENCE_CATEGORIES,
} from "../contracts/contacts-compliance.ts";
import {
  describeWhatsappControlPlaneRpcError,
  visibleWhatsappControlPlaneSections,
  WHATSAPP_CONTROL_PLANE_PERMISSION_CODES,
  type WhatsappControlPlanePermissionCode,
  type WhatsappControlPlanePermissions,
} from "../contracts/control-plane.ts";
import {
  buildWhatsappSegmentRuleGroup,
  buildWhatsappSegmentSubmission,
  parseWhatsappSegmentPreviewPayload,
  parseWhatsappSegmentRuleGroup,
  readWhatsappSegmentRuleDrafts,
  ruleGroupToDrafts,
  ruleGroupToJson,
  segmentRuleFieldName,
  WHATSAPP_SEGMENT_RULE_FIELDS,
  WHATSAPP_SEGMENT_RULE_OPS,
} from "../contracts/segment-rules.ts";
import {
  buildWhatsappSendPolicySubmission,
  describeWhatsappFrequencyRule,
  parseWhatsappSendPolicyPayload,
  validateWhatsappSendPolicyValues,
  WHATSAPP_MARKETING_DEFAULT_TIMEZONE,
} from "../contracts/send-policy.ts";
import {
  validateWhatsappMarketingSendPolicy,
  WHATSAPP_MARKETING_DEFAULT_TIMEZONE as WM0_DEFAULT_TIMEZONE,
  WHATSAPP_MARKETING_PREFERENCE_CATEGORIES as WM0_PREFERENCE_CATEGORIES,
  WHATSAPP_OPT_OUT_PHRASES,
} from "../../whatsapp-marketing/contracts/preferences.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const MIGRATION = "supabase/migrations/20260914100000_whatsapp_contacts_consent_segments_policy.sql";
const migration = read(MIGRATION);

const SERVER_MODULES = [
  "src/features/whatsapp/server/whatsapp-control-plane-auth.ts",
  "src/features/whatsapp/server/whatsapp-contacts-queries.ts",
  "src/features/whatsapp/server/whatsapp-contacts-actions.ts",
  "src/features/whatsapp/server/whatsapp-segments-queries.ts",
  "src/features/whatsapp/server/whatsapp-segments-actions.ts",
  "src/features/whatsapp/server/whatsapp-settings-queries.ts",
  "src/features/whatsapp/server/whatsapp-settings-actions.ts",
];
const PAGES = {
  contacts: "src/app/admin/whatsapp/contacts/page.tsx",
  segments: "src/app/admin/whatsapp/segments/page.tsx",
  settings: "src/app/admin/whatsapp/settings/page.tsx",
};
const COMPONENTS = [
  "src/features/whatsapp/components/control-plane/ControlPlaneShell.tsx",
  "src/features/whatsapp/components/control-plane/ContactComplianceForms.tsx",
  "src/features/whatsapp/components/control-plane/SegmentEditorForm.tsx",
  "src/features/whatsapp/components/control-plane/SendPolicyForm.tsx",
];

/** role -> WM-3 permission codes, read from the migration's grant block. */
function migrationGrants(): Map<string, Set<string>> {
  const block = migration.slice(migration.indexOf("insert into public.role_permissions"), migration.indexOf(") v(role_code"));
  const grants = new Map<string, Set<string>>();
  for (const match of block.matchAll(/\('([a-z_]+)','([a-z_.]+)'\)/g)) {
    const set = grants.get(match[1]!) ?? new Set<string>();
    set.add(match[2]!);
    grants.set(match[1]!, set);
  }
  return grants;
}

function permissionsFor(codes: readonly WhatsappControlPlanePermissionCode[]): WhatsappControlPlanePermissions {
  return Object.fromEntries(WHATSAPP_CONTROL_PLANE_PERMISSION_CODES.map((c) => [c, codes.includes(c)])) as WhatsappControlPlanePermissions;
}

describe("WM-3 permission model (from the authoritative migration)", () => {
  const grants = migrationGrants();
  const WM3 = [
    "whatsapp.contacts.read",
    "whatsapp.opt_out.record",
    "whatsapp.segments.read",
    "whatsapp.segments.manage",
    "whatsapp.settings.read",
    "whatsapp.settings.manage",
  ];

  test("Super Admin holds all six; Sales Manager all but settings.manage", () => {
    assert.deepEqual([...(grants.get("super_admin") ?? [])].sort(), [...WM3].sort());
    assert.deepEqual(
      [...(grants.get("sales_manager") ?? [])].sort(),
      WM3.filter((c) => c !== "whatsapp.settings.manage").sort()
    );
  });

  test("Sales Executive gets only whatsapp.opt_out.record", () => {
    assert.deepEqual([...(grants.get("sales_executive") ?? [])], ["whatsapp.opt_out.record"]);
  });

  test("legacy management and sales get no new WM permission", () => {
    assert.equal(grants.has("management"), false);
    assert.equal(grants.has("sales"), false);
    assert.deepEqual([...grants.keys()].sort(), ["sales_executive", "sales_manager", "super_admin"]);
  });

  test("the app probes every WM-3 code the migration defines", () => {
    for (const permission of WM3) {
      assert.ok((WHATSAPP_CONTROL_PLANE_PERMISSION_CODES as readonly string[]).includes(permission), permission);
    }
  });

  test("section nav reflects the grants: an executive sees no control-plane section", () => {
    const executive = permissionsFor(["whatsapp.inbox.read", "whatsapp.opt_out.record"]);
    assert.deepEqual(
      visibleWhatsappControlPlaneSections(executive).map((s) => s.key),
      ["inbox"]
    );
    const manager = permissionsFor([
      "whatsapp.inbox.read",
      "whatsapp.templates.read",
      "whatsapp.contacts.read",
      "whatsapp.segments.read",
      "whatsapp.settings.read",
    ]);
    assert.deepEqual(
      visibleWhatsappControlPlaneSections(manager).map((s) => s.key),
      ["inbox", "contacts", "templates", "segments", "settings"]
    );
  });

  test("RPC refusals map to actionable, non-leaking messages", () => {
    assert.equal(describeWhatsappControlPlaneRpcError({ code: "42501" }, "policy").code, "ACCESS_DENIED");
    assert.match(describeWhatsappControlPlaneRpcError({ code: "42501" }, "policy").message, /Super Admin/);
    assert.equal(describeWhatsappControlPlaneRpcError({ code: "23505" }, "segment").code, "CONFLICT");
    assert.equal(describeWhatsappControlPlaneRpcError({ code: "P0002" }, "segment").code, "NOT_FOUND");
    const unknown = describeWhatsappControlPlaneRpcError({ code: "XX000", message: "relation secret_table" }, "opt_out");
    assert.doesNotMatch(unknown.message, /secret_table/);
  });
});

describe("Contacts contracts", () => {
  test("query parsing is bounded", () => {
    assert.deepEqual(parseWhatsappContactsQuery({}), { q: null, page: 1, pageSize: 25 });
    const parsed = parseWhatsappContactsQuery({ q: `  ${"x".repeat(200)} `, page: "99999999" });
    assert.equal(parsed.q?.length, 64);
    assert.equal(parsed.page, 10000);
    assert.equal(parseWhatsappContactsQuery({ page: "-3" }).page, 1);
    assert.equal(parseWhatsappContactsQuery({ page: "abc" }).page, 1);
    assert.equal(
      buildWhatsappContactsHref("/admin/whatsapp/contacts", { q: "Asha", page: 1, pageSize: 25 }, 3),
      "/admin/whatsapp/contacts?q=Asha&page=3"
    );
  });

  test("MARKETING consent is shown verbatim and never inferred", () => {
    assert.equal(toWhatsappMarketingConsentState(null), "none");
    assert.equal(toWhatsappMarketingConsentState("granted"), "granted");
    assert.equal(toWhatsappMarketingConsentState("withdrawn"), "withdrawn");
    // A service-consent word is not marketing consent.
    assert.equal(toWhatsappMarketingConsentState("WHATSAPP_SERVICE"), "unknown");
    assert.notEqual(presentWhatsappMarketingConsent("unknown").tone, "positive");
    assert.notEqual(presentWhatsappMarketingConsent("none").tone, "positive");
  });

  test("list payload parsing drops malformed rows and keeps raw consent", () => {
    const page = parseWhatsappContactsPayload({
      total_count: 3,
      items: [
        {
          contact_id: "11111111-1111-4111-8111-111111111111",
          display_name: "Asha",
          contact_status: "active",
          whatsapp_e164: "+919800000001",
          whatsapp_channel_status: "active",
          marketing_consent: "granted",
          lead_id: null,
          lead_stage: null,
          locality: null,
        },
        { display_name: "no id" },
        { contact_id: "22222222-2222-4222-8222-222222222222", marketing_consent: "revoked_by_import" },
      ],
    });
    assert.equal(page.totalCount, 3);
    assert.equal(page.items.length, 2);
    assert.equal(page.items[1]!.marketingConsent, "unknown");
    assert.equal(page.items[1]!.rawMarketingConsent, "revoked_by_import");
    assert.deepEqual(parseWhatsappContactsPayload(null), { totalCount: 0, items: [] });
  });

  test("preference state is latest-event-wins per category, default not opted out", () => {
    const contact = "11111111-1111-4111-8111-111111111111";
    const states = deriveWhatsappContactPreferenceStates([
      { id: "a", contact_id: contact, category: "offers", event_type: "opted_out", occurred_at: "2026-09-01T00:00:00Z" },
      { id: "b", contact_id: contact, category: "offers", event_type: "allowed", occurred_at: "2026-09-02T00:00:00Z" },
      { id: "c", contact_id: contact, category: "referral", event_type: "allowed", occurred_at: "2026-09-03T00:00:00Z" },
      { id: "d", contact_id: contact, category: "referral", event_type: "opted_out", occurred_at: "2026-09-03T00:00:00Z" },
      { id: "e", contact_id: contact, category: "not_a_category", event_type: "opted_out", occurred_at: "2026-09-04T00:00:00Z" },
    ]);
    assert.deepEqual(optedOutCategories(preferenceStateFor(states, contact)), ["referral"]);
    assert.deepEqual(optedOutCategories(preferenceStateFor(states, "other")), []);
  });

  test("preference categories match the migration's check constraint and the WM-0 contract", () => {
    const check = /chk_whatsapp_pref_category check \(category in \(([^)]*)\)\)/.exec(migration)?.[1] ?? "";
    assert.deepEqual(
      [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
      [...WHATSAPP_MARKETING_PREFERENCE_CATEGORIES]
    );
    assert.deepEqual([...WHATSAPP_MARKETING_PREFERENCE_CATEGORIES], [...WM0_PREFERENCE_CATEGORIES]);
  });
});

describe("Segment rule contracts", () => {
  test("field and operator allowlists match private.whatsapp_segment_rule_group_valid", () => {
    const fields = /if f not in \(([^)]*)\)/.exec(migration)?.[1] ?? "";
    const ops = /if op not in \(([^)]*)\)/.exec(migration)?.[1] ?? "";
    assert.deepEqual([...fields.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), [...WHATSAPP_SEGMENT_RULE_FIELDS]);
    assert.deepEqual([...ops.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), [...WHATSAPP_SEGMENT_RULE_OPS]);
  });

  test("builds a valid rule group and round-trips it", () => {
    const result = buildWhatsappSegmentRuleGroup([
      { field: "lead_stage", op: "in", value: "qualified, proposal_sent, qualified" },
      { field: "locality", op: "equals", value: " Whitefield " },
      { field: "assigned_to", op: "equals", value: "11111111-1111-4111-8111-111111111111" },
      { field: "received_date", op: "not_equals", value: "2026-09-01" },
    ]);
    assert.ok(result.ok);
    assert.deepEqual(result.ruleGroup.rules[0], { field: "lead_stage", op: "in", value: ["qualified", "proposal_sent"] });
    assert.equal(result.ruleGroup.rules[1]!.value, "Whitefield");
    const reparsed = parseWhatsappSegmentRuleGroup(ruleGroupToJson(result.ruleGroup));
    assert.deepEqual(reparsed, result.ruleGroup);
    const rebuilt = buildWhatsappSegmentRuleGroup(ruleGroupToDrafts(reparsed));
    assert.ok(rebuilt.ok);
    assert.deepEqual(rebuilt.ruleGroup, result.ruleGroup);
  });

  test("rejects anything the database would reject", () => {
    assert.equal(buildWhatsappSegmentRuleGroup([]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "email", op: "equals", value: "x" }]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "source", op: "like", value: "x" }]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "source", op: "equals", value: "   " }]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "source", op: "in", value: " , ," }]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "assigned_to", op: "equals", value: "me" }]).ok, false);
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "received_date", op: "equals", value: "01/09/2026" }]).ok, false);
    const tooMany = Array.from({ length: 21 }, () => ({ field: "source", op: "equals", value: "web" }));
    assert.equal(buildWhatsappSegmentRuleGroup(tooMany).ok, false);
    const tooManyValues = Array.from({ length: 51 }, (_, i) => `v${i}`).join(",");
    assert.equal(buildWhatsappSegmentRuleGroup([{ field: "source", op: "in", value: tooManyValues }]).ok, false);
    assert.equal(parseWhatsappSegmentRuleGroup({ rules: [{ field: "email", op: "equals", value: "x" }] }), null);
    assert.equal(parseWhatsappSegmentRuleGroup({ rules: [] }), null);
  });

  test("submission validates name and description bounds", () => {
    const rules = [{ field: "source", op: "equals", value: "web" }];
    assert.equal(buildWhatsappSegmentSubmission({ name: "x", description: "", active: true, rules }).ok, false);
    assert.equal(buildWhatsappSegmentSubmission({ name: "Hot leads", description: "d".repeat(501), active: true, rules }).ok, false);
    const ok = buildWhatsappSegmentSubmission({ name: "  Hot   leads ", description: "", active: false, rules });
    assert.ok(ok.ok);
    assert.equal(ok.submission.name, "Hot leads");
    assert.equal(ok.submission.active, false);
  });

  test("rule drafts are read only from indexed allowlisted form fields", () => {
    const form = new FormData();
    form.set(segmentRuleFieldName(0, "field"), "source");
    form.set(segmentRuleFieldName(0, "op"), "equals");
    form.set(segmentRuleFieldName(0, "value"), "web");
    form.set("rule_group", JSON.stringify({ rules: [{ field: "email", op: "equals", value: "x" }] }));
    assert.deepEqual(readWhatsappSegmentRuleDrafts(form), [{ field: "source", op: "equals", value: "web" }]);
  });

  test("preview payload requires every count", () => {
    assert.deepEqual(
      parseWhatsappSegmentPreviewPayload({ total_matched: 10, eligible: 4, do_not_contact: 1, no_marketing_consent: 5, missing_whatsapp: 2 }),
      { totalMatched: 10, eligible: 4, doNotContact: 1, noMarketingConsent: 5, missingWhatsapp: 2 }
    );
    assert.equal(parseWhatsappSegmentPreviewPayload({ total_matched: 10 }), null);
  });
});

describe("Send policy contracts", () => {
  const base = {
    windowHours: ["24", "168"],
    maxMessages: ["1", "3"],
    startLocal: "21:00",
    endLocal: "09:00",
    timezone: "Asia/Kolkata",
    executionEnabled: false,
    confirmExecution: false,
  };

  test("builds the exact JSON shape set_whatsapp_marketing_send_policy validates", () => {
    const result = buildWhatsappSendPolicySubmission(base);
    assert.ok(result.ok);
    assert.deepEqual(result.submission.frequencyRules, [
      { windowHours: 24, maxMessages: 1 },
      { windowHours: 168, maxMessages: 3 },
    ]);
    assert.deepEqual(result.submission.quietHours, { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" });
    assert.equal(result.submission.executionEnabled, false);
    assert.match(migration, /r->>'windowHours'/);
    assert.match(migration, /r->>'maxMessages'/);
    assert.match(migration, /p_quiet_hours->>'startLocal'/);
  });

  test("fails closed on invalid values and requires confirmation to open the gate", () => {
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, windowHours: [""], maxMessages: [""] }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, windowHours: ["0"], maxMessages: ["1"] }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, windowHours: ["2161"], maxMessages: ["1"] }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, windowHours: ["24"], maxMessages: ["1.5"] }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, endLocal: "21:00" }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, startLocal: "25:00" }).ok, false);
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, timezone: "Mars/Olympus" }).ok, false);
    const nine = Array.from({ length: 9 }, () => "24");
    assert.equal(buildWhatsappSendPolicySubmission({ ...base, windowHours: nine, maxMessages: nine }).ok, false);
    const unconfirmed = buildWhatsappSendPolicySubmission({ ...base, executionEnabled: true });
    assert.equal(unconfirmed.ok, false);
    assert.equal(!unconfirmed.ok && unconfirmed.field, "confirmExecution");
    assert.ok(buildWhatsappSendPolicySubmission({ ...base, executionEnabled: true, confirmExecution: true }).ok);
  });

  test("the restated validator agrees with the WM-0 contract", () => {
    assert.equal(WHATSAPP_MARKETING_DEFAULT_TIMEZONE, WM0_DEFAULT_TIMEZONE);
    const cases = [
      { frequencyRules: [{ windowHours: 24, maxMessages: 1 }], quietHours: { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" } },
      { frequencyRules: [], quietHours: { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" } },
      { frequencyRules: [{ windowHours: 0, maxMessages: 101 }], quietHours: { timezone: "UTC", startLocal: "9:00", endLocal: "09:00" } },
      { frequencyRules: [{ windowHours: 2160, maxMessages: 100 }], quietHours: { timezone: "Nope/Zone", startLocal: "10:00", endLocal: "10:00" } },
      { frequencyRules: [{ windowHours: 1.5, maxMessages: 1 }], quietHours: { timezone: "UTC", startLocal: "23:59", endLocal: "00:00" } },
    ];
    for (const policy of cases) {
      assert.deepEqual(validateWhatsappSendPolicyValues(policy), validateWhatsappMarketingSendPolicy(policy));
    }
  });

  test("reads configured, not configured and unreadable policies distinctly", () => {
    assert.deepEqual(parseWhatsappSendPolicyPayload(null), { kind: "not_configured" });
    assert.deepEqual(parseWhatsappSendPolicyPayload({ version: 1 }), { kind: "unreadable" });
    const read = parseWhatsappSendPolicyPayload({
      id: "11111111-1111-4111-8111-111111111111",
      version: 2,
      execution_enabled: false,
      frequency_rules: [{ windowHours: 24, maxMessages: 1 }],
      quiet_hours: { startLocal: "21:00", endLocal: "09:00" },
      timezone: "Asia/Kolkata",
      effective_from: "2026-09-15T00:00:00Z",
    });
    assert.equal(read.kind, "configured");
    assert.equal(describeWhatsappFrequencyRule({ windowHours: 168, maxMessages: 3 }), "At most 3 marketing messages per contact in 7 days");
  });
});

describe("Runtime boundaries", () => {
  test("every WM-3 server module and page uses the caller's session, never a service-role client", () => {
    for (const rel of [...SERVER_MODULES, ...Object.values(PAGES), ...COMPONENTS]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /createAdminClient|service-role|service_role|SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/, rel);
    }
    for (const rel of SERVER_MODULES) {
      assert.match(read(rel), /import "server-only";/, rel);
    }
  });

  test("WM-3 channel-core files keep the WM-0 boundary: no import of the marketing module", () => {
    const channelCore = [
      ...SERVER_MODULES,
      ...COMPONENTS,
      "src/features/whatsapp/components/control-plane/ControlPlaneActionMessage.tsx",
      "src/features/whatsapp/contracts/control-plane.ts",
      "src/features/whatsapp/contracts/contacts-compliance.ts",
      "src/features/whatsapp/contracts/segment-rules.ts",
      "src/features/whatsapp/contracts/send-policy.ts",
    ];
    for (const rel of channelCore) {
      assert.doesNotMatch(read(rel), /whatsapp-marketing/, rel);
    }
  });

  test("queries and actions call exactly the migration's RPCs", () => {
    const contactsQ = code(read("src/features/whatsapp/server/whatsapp-contacts-queries.ts"));
    assert.match(contactsQ, /rpc\("list_whatsapp_contacts"/);
    assert.match(contactsQ, /from\("whatsapp_marketing_preference_events"\)/);
    const contactsA = code(read("src/features/whatsapp/server/whatsapp-contacts-actions.ts"));
    assert.match(contactsA, /rpc\("record_whatsapp_customer_opt_out"/);
    assert.match(contactsA, /rpc\("record_whatsapp_marketing_preference"/);
    const segmentsQ = code(read("src/features/whatsapp/server/whatsapp-segments-queries.ts"));
    assert.match(segmentsQ, /rpc\("preview_whatsapp_segment"/);
    const segmentsA = code(read("src/features/whatsapp/server/whatsapp-segments-actions.ts"));
    assert.match(segmentsA, /rpc\("save_whatsapp_segment"/);
    const settingsQ = code(read("src/features/whatsapp/server/whatsapp-settings-queries.ts"));
    assert.match(settingsQ, /rpc\("get_whatsapp_marketing_send_policy"/);
    const settingsA = code(read("src/features/whatsapp/server/whatsapp-settings-actions.ts"));
    assert.match(settingsA, /rpc\("set_whatsapp_marketing_send_policy"/);
    for (const rel of SERVER_MODULES) {
      assert.doesNotMatch(code(read(rel)), /record_whatsapp_inbound_opt_out/, `${rel} must not call the service-role STOP RPC`);
    }
  });

  test("actions re-check the exact WM-3 permission before the RPC", () => {
    const contactsA = code(read("src/features/whatsapp/server/whatsapp-contacts-actions.ts"));
    assert.match(contactsA, /permissions\["whatsapp\.opt_out\.record"\]/);
    assert.match(contactsA, /permissions\["whatsapp\.contacts\.read"\]/);
    assert.match(contactsA, /canCurrentUserAccessConversation\(conversationId, "use"\)/);
    assert.match(contactsA, /permissions\["marketing_consents\.manage"\]/);
    assert.match(code(read("src/features/whatsapp/server/whatsapp-segments-actions.ts")), /permissions\["whatsapp\.segments\.manage"\]/);
    assert.match(code(read("src/features/whatsapp/server/whatsapp-settings-actions.ts")), /permissions\["whatsapp\.settings\.manage"\]/);
    for (const rel of SERVER_MODULES.filter((r) => r.endsWith("-actions.ts"))) {
      const src = read(rel);
      assert.match(src, /^"use server";/, rel);
      const actionBodies = code(src);
      const authIndex = actionBodies.indexOf("resolveWhatsappControlPlaneAccess()");
      const rpcIndex = actionBodies.indexOf(".rpc(");
      assert.ok(authIndex > 0 && authIndex < rpcIndex, `${rel} authorises before its first RPC`);
    }
  });

  test("pages gate on their own read permission and render writes only for manage", () => {
    const contacts = code(read(PAGES.contacts));
    assert.match(contacts, /permissions\["whatsapp\.contacts\.read"\]/);
    assert.match(contacts, /permissions\["whatsapp\.opt_out\.record"\]/);
    const segments = code(read(PAGES.segments));
    assert.match(segments, /permissions\["whatsapp\.segments\.read"\]/);
    assert.match(segments, /canManage \? \(/);
    const settings = code(read(PAGES.settings));
    assert.match(settings, /permissions\["whatsapp\.settings\.read"\]/);
    assert.match(settings, /const canManage = permissions\["whatsapp\.settings\.manage"\]/);
    assert.match(settings, /canManage \? \(\s*<SendPolicyForm/);
  });

  test("MARKETING consent stays independent; P5 grant recording requires explicit customer evidence", () => {
    for (const rel of [...SERVER_MODULES, ...Object.values(PAGES), ...COMPONENTS]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /WHATSAPP_SERVICE|SERVICE_COMMUNICATION/, rel);
      assert.doesNotMatch(src, /from\("consent_events"\)/, rel);
    }

    const action = code(read("src/features/whatsapp/server/whatsapp-contacts-actions.ts"));
    assert.match(action, /permissions\["marketing_consents\.manage"\]/);
    assert.match(action, /confirmExplicit/);
    assert.match(action, /record_marketing_consent_event/);
    assert.match(action, /p_event_type:\s*"granted"/);
    assert.match(action, /p_idempotency_key:\s*randomUUID\(\)/);
    assert.match(action, /customer explicitly opted in to optional marketing/i);

    const form = code(read("src/features/whatsapp/components/control-plane/ContactComplianceForms.tsx"));
    assert.match(form, /Record explicit marketing consent/);
    assert.match(form, /customer explicitly opted in/i);
    assert.match(form, /not inferring consent from service activity/i);

    for (const rel of [...SERVER_MODULES, ...Object.values(PAGES), ...COMPONENTS]) {
      if (rel.endsWith("whatsapp-contacts-actions.ts") || rel.endsWith("ContactComplianceForms.tsx")) continue;
      assert.doesNotMatch(code(read(rel)), /record_marketing_consent_event|recordWhatsappMarketingConsentGrantAction/, rel);
    }

    // The opt-out RPC remains narrowing only.
    const optOut = migration.slice(migration.indexOf("function public.record_whatsapp_customer_opt_out"));
    const body = optOut.slice(0, optOut.indexOf("end;$$"));
    assert.match(body, /'MARKETING','whatsapp','withdrawn'/);
    assert.doesNotMatch(body, /'granted'/);
  });

  test("the conversation page offers opt-out only to a user who can use the conversation", () => {
    const page = code(read("src/app/admin/whatsapp/inbox/[conversationId]/page.tsx"));
    assert.match(page, /const canRecordOptOut = canUse && detail\.contactId \? await canCurrentUserRecordWhatsappOptOut\(\) : false;/);
    assert.match(page, /<MarketingOptOutForm contactId=\{detail\.contactId\} conversationId=\{conversationId\}/);
    const panel = code(read("src/features/whatsapp/components/inbox/ConversationDetailsPanel.tsx"));
    assert.doesNotMatch(panel, /authorize|rpc\(/);
  });

  test("the deterministic inbound STOP integration is preserved", () => {
    const ingest = code(read("src/features/whatsapp/server/meta-webhook-ingest.ts"));
    // The channel core classifies (typed text or Meta's opt-out button) and never imports the marketing plane.
    assert.match(ingest, /classifyWhatsappInboundOptOut\(event\) === "explicit_opt_out"/);
    assert.match(ingest, /"record_whatsapp_inbound_opt_out",\s*\{ p_message_id: messageId \}/);
    assert.doesNotMatch(ingest, /whatsapp-marketing/);
    // The WM-3 SQL list stays exactly the WM-0 phrases; the forward hardening adds only Meta's button label.
    const sqlPhrases = /v_text not in \(([^)]*)\)/.exec(migration)?.[1] ?? "";
    assert.deepEqual([...sqlPhrases.matchAll(/'([a-z ]+)'/g)].map((m) => m[1]), [...WHATSAPP_OPT_OUT_PHRASES]);
    const hardening = read("supabase/migrations/20260916100000_whatsapp_control_plane_runtime_hardening.sql");
    const hardened = /return v_text in \(([^)]*)\)/.exec(hardening)?.[1] ?? "";
    assert.deepEqual([...hardened.matchAll(/'([a-z ]+)'/g)].map((m) => m[1]), [...WHATSAPP_OPT_OUT_PHRASES, "stop promotions"]);
    assert.match(hardening, /normalize\(p_candidate,NFKC\)/);
  });

  test("the nullable overlay names save_whatsapp_segment.p_segment_id and nothing broader", () => {
    const overlay = read("src/types/database.ts");
    assert.match(overlay, /save_whatsapp_segment: "p_segment_id";/);
    assert.match(overlay, /save_whatsapp_segment: \["p_segment_id"\],/);
    assert.match(migration, /if p_segment_id is null then/);
  });

  test("this suite is classified as an application test", () => {
    const classification = JSON.parse(read("scripts/test-classification.json")) as { application: string[] };
    assert.ok(classification.application.includes("src/features/whatsapp/__tests__/wm-3-contacts-segments-settings.test.ts"));
  });
});
