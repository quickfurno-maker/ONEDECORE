/**
 * WM-0 (ADR-0034) — WhatsApp control-plane architecture freeze contracts.
 *
 * Proves the boundaries WM-1..WM-7 build on: the service path still refuses
 * MARKETING, CRM `leads.assigned_to` is the only conversation owner, Sales
 * Executives hold no bulk authority, paid-ads `campaign_runs` is not reused, no
 * unofficial WhatsApp dependency or browser-side Meta token exists, and WM-0
 * adds no marketing provider call.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  assertWhatsappServicePurpose,
  rejectMarketingPurpose,
} from "../../whatsapp/server/send-intent-normalization.ts";
import {
  WHATSAPP_INBOX_ROLE_PERMISSIONS,
  WHATSAPP_SERVICE_PURPOSE_CODE,
} from "../../whatsapp/contracts/inbox-permissions.ts";
import {
  canUseWhatsappConversation,
  canViewWhatsappConversation,
  type InboxAccessContext,
} from "../../whatsapp/server/inbox-access-resolver.ts";
import {
  FORBIDDEN_CONVERSATION_OWNER_COLUMNS,
  WHATSAPP_CONVERSATION_OWNERSHIP_AUTHORITY,
  WHATSAPP_REASSIGNMENT_RULES,
  WHATSAPP_TOMBSTONED_LEAD_CONVERSATION_POLICY,
} from "../../whatsapp/contracts/conversation-ownership.ts";
import {
  isWhatsappTemplateStatusSendable,
  normalizeWhatsappTemplateCategory,
  normalizeWhatsappTemplateStatus,
  resolveWhatsappTemplateSendPath,
  validateWhatsappTemplateVariables,
  WHATSAPP_TEMPLATE_RAW_VALUE_MAX_LENGTH,
} from "../../whatsapp/contracts/template-registry.ts";
import { deriveWhatsappConversationAttention } from "../../whatsapp/contracts/staff-conversation-state.ts";
import {
  PAID_ADS_CHANNELS,
} from "../../marketing/execution/contracts/run-lifecycle.ts";
import { resolvePaidAdsExecutionChannel } from "../../marketing/execution/domain/paid-channel.ts";
import { canApproveCampaignVersion } from "../../marketing/domain/campaign-capabilities.ts";
import { ONEDECORE_ENV_CONTRACT } from "../../../config/env-contract.ts";
import {
  evaluateWhatsappCampaignRunCreation,
  validateWhatsappCampaignRunTransition,
  WHATSAPP_CAMPAIGN_RUN_STATES,
  WHATSAPP_CAMPAIGN_RUN_TERMINAL_STATES,
  whatsappCampaignSpecStateForVersionStatus,
} from "../contracts/campaign-lifecycle.ts";
import {
  validateWhatsappDispatchJobTransition,
  WHATSAPP_DISPATCH_JOB_STATES,
  WHATSAPP_DISPATCH_WORKER_BOUNDS,
  whatsappDispatchCorrelationKey,
  whatsappDispatchRetryDelaySeconds,
} from "../contracts/recipient-lifecycle.ts";
import {
  evaluateWhatsappMarketingRecipient,
  WHATSAPP_AUDIENCE_PREVIEW_BUCKETS,
  WHATSAPP_MARKETING_SKIP_REASONS,
  whatsappAudiencePreviewBucket,
  type WhatsappMarketingRecipientEvidence,
} from "../contracts/eligibility.ts";
import {
  classifyWhatsappOptOutSignal,
  isWhatsappFrequencyCapped,
  isWithinWhatsappQuietHours,
  validateWhatsappMarketingSendPolicy,
  WHATSAPP_MARKETING_DEFAULT_TIMEZONE,
  WHATSAPP_MARKETING_PREFERENCE_CATEGORIES,
} from "../contracts/preferences.ts";
import {
  classifyWhatsappMarketingProviderResult,
  WHATSAPP_MARKETING_DISPATCH_OUTCOME_JOB_STATE,
  WHATSAPP_MARKETING_DISPATCH_OUTCOMES,
} from "../contracts/dispatch-outcome.ts";
import {
  evaluateWhatsappCampaignRunOperatorAuthority,
  SALES_EXECUTIVE_FORBIDDEN_WHATSAPP_CODES,
  WHATSAPP_BULK_AUTHORITY_ROLES,
  WHATSAPP_CAMPAIGN_RUN_OPERATOR_ACTIONS,
  WHATSAPP_CONTROL_PLANE_PERMISSIONS,
  WHATSAPP_LEGACY_ROLE_EXISTING_CODES,
  WHATSAPP_SUPER_ADMIN_ONLY_RUN_ACTIONS,
  whatsappControlPlaneCodesForRole,
  type WhatsappCampaignRunOperatorEvidence,
} from "../contracts/capability-matrix.ts";
import {
  PAID_ADS_EXECUTION_TABLES_NOT_FOR_WHATSAPP,
  WHATSAPP_CONTROL_PLANE_AUTHORITATIVE_TABLES,
  WHATSAPP_PLANNED_SCHEMA_OBJECTS,
} from "../contracts/schema-plan.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const MIGRATIONS_DIR = "supabase/migrations";
const migrationFiles = readdirSync(join(root, MIGRATIONS_DIR))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationText = (name: string) => read(`${MIGRATIONS_DIR}/${name}`);
const allMigrations = migrationFiles.map((name) => ({
  name,
  sql: migrationText(name),
}));

/** Body of the LAST `create or replace function <name>(` across ordered migrations. */
function latestFunctionDefinition(qualifiedName: string): string {
  const needle = `create or replace function ${qualifiedName}(`;
  let latest: string | null = null;
  for (const { sql } of allMigrations) {
    let from = sql.indexOf(needle);
    while (from !== -1) {
      const tag = /\bas\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(from));
      assert.ok(tag, `${qualifiedName} has a dollar-quoted body`);
      const bodyStart = from + tag.index + tag[0].length;
      const bodyEnd = sql.indexOf(tag[1], bodyStart);
      assert.ok(bodyEnd !== -1, `${qualifiedName} body is closed`);
      latest = sql.slice(from, bodyEnd + tag[1].length);
      from = sql.indexOf(needle, bodyEnd + tag[1].length);
    }
  }
  assert.ok(latest, `${qualifiedName} is defined in some migration`);
  return latest;
}

function walk(dir: string, accept: (path: string) => boolean): string[] {
  const out: string[] = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, accept));
    else if (accept(rel)) out.push(rel);
  }
  return out;
}

const isSource = (path: string) => /\.(ts|tsx)$/.test(path) && !path.includes("/__tests__/");
const MARKETING_ROOT = "src/features/whatsapp-marketing";
const WHATSAPP_ROOT = "src/features/whatsapp";
const marketingSources = walk(MARKETING_ROOT, isSource);
const whatsappSources = walk(WHATSAPP_ROOT, isSource);
const allAppSources = walk("src", (path) => /\.(ts|tsx)$/.test(path));

/* ========================================================================== */
/* 1. Service path stays non-marketing                                        */
/* ========================================================================== */

describe("1 — the WHATSAPP_SERVICE path still rejects MARKETING", () => {
  test("application normaliser rejects MARKETING and accepts only WHATSAPP_SERVICE", () => {
    assert.throws(() => rejectMarketingPurpose("MARKETING"), /denied_purpose: MARKETING/);
    assert.throws(() => assertWhatsappServicePurpose("MARKETING"), /denied_purpose/);
    assert.doesNotThrow(() => rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE));
  });

  test("the current database send-intent authority refuses any other purpose", () => {
    const impl = latestFunctionDefinition("private.create_whatsapp_service_send_intent_impl_v2");
    assert.match(impl, /p_purpose_code is distinct from 'WHATSAPP_SERVICE'/);
    assert.match(impl, /denied_purpose: only WHATSAPP_SERVICE is allowed/);
  });

  test("the send-intent purpose CHECK is still in force and never dropped", () => {
    const definitions = allMigrations.filter(({ sql }) =>
      sql.includes("constraint chk_whatsapp_send_intents_purpose check (purpose_code = 'WHATSAPP_SERVICE')")
    );
    assert.equal(definitions.length, 1);
    for (const { name, sql } of allMigrations) {
      assert.doesNotMatch(sql, /drop constraint (if exists )?chk_whatsapp_send_intents_purpose/i, name);
    }
  });

  test("a MARKETING template can never be routed into the service purpose", () => {
    const path = resolveWhatsappTemplateSendPath(normalizeWhatsappTemplateCategory("MARKETING"));
    assert.deepEqual(path, { allowed: true, purposeCode: "MARKETING" });
    assert.deepEqual(
      resolveWhatsappTemplateSendPath(normalizeWhatsappTemplateCategory("utility")),
      { allowed: true, purposeCode: "WHATSAPP_SERVICE" }
    );
    assert.equal(
      resolveWhatsappTemplateSendPath(normalizeWhatsappTemplateCategory("AUTHENTICATION")).allowed,
      false
    );
    assert.equal(
      resolveWhatsappTemplateSendPath(normalizeWhatsappTemplateCategory("NEW_META_CATEGORY")).allowed,
      false
    );
  });

  test("the marketing module never calls the service send-intent RPC", () => {
    for (const file of marketingSources) {
      assert.doesNotMatch(code(read(file)), /create_whatsapp_service_send_intent/, file);
    }
  });
});

/* ========================================================================== */
/* 2. Permission matrix                                                       */
/* ========================================================================== */

describe("2 — Sales Executive target matrix holds no bulk or global authority", () => {
  test("sales_executive (and legacy sales) hold none of the forbidden codes", () => {
    for (const role of ["sales_executive", "sales"] as const) {
      const codes = whatsappControlPlaneCodesForRole(role);
      for (const forbidden of SALES_EXECUTIVE_FORBIDDEN_WHATSAPP_CODES) {
        assert.equal(codes.has(forbidden), false, `${role} must not hold ${forbidden}`);
      }
    }
  });

  test("the executive target set is exactly assigned-chat capabilities", () => {
    assert.deepEqual(
      [...whatsappControlPlaneCodesForRole("sales_executive")].sort(),
      [
        "whatsapp.inbox.read",
        "whatsapp.inbox.use",
        "whatsapp.opt_out.record",
        "whatsapp.templates.use",
      ]
    );
  });

  test("every bulk-risk code is limited to Super Admin and Sales Manager", () => {
    for (const entry of WHATSAPP_CONTROL_PLANE_PERMISSIONS.filter((e) => e.risk === "bulk")) {
      for (const role of entry.grantedTo) {
        assert.ok(
          (WHATSAPP_BULK_AUTHORITY_ROLES as readonly string[]).includes(role),
          `${entry.code} granted to ${role}`
        );
      }
    }
  });

  /** WM codes are those not inserted by M19/M31/M33; once migrated they stay legacy-free. */
  const wmCodes = WHATSAPP_CONTROL_PLANE_PERMISSIONS.filter(
    (e) => e.status === "planned" || /^2026091[3-9]\d{6}_whatsapp_/.test(e.source)
  );

  test("legacy management holds no WM code, only its existing M19 inbox grants", () => {
    assert.equal(wmCodes.length, 18, "WM-2..WM-6 codes are classified");
    for (const entry of wmCodes) {
      assert.equal(entry.grantedTo.includes("management"), false, entry.code);
      for (const { name, sql } of allMigrations) {
        assert.doesNotMatch(sql, new RegExp(`\\('management'\\s*,\\s*'${entry.code.replace(/\./g, "\\.")}'\\)`), `${entry.code} in ${name}`);
      }
    }
    assert.deepEqual(
      [...whatsappControlPlaneCodesForRole("management")].sort(),
      [...WHATSAPP_LEGACY_ROLE_EXISTING_CODES.management].sort()
    );
    assert.deepEqual(
      [...whatsappControlPlaneCodesForRole("management", "existing")].sort(),
      [...whatsappControlPlaneCodesForRole("management", "target")].sort()
    );
  });

  test("legacy sales holds no WM code, only its existing M19 assigned-inbox grants", () => {
    for (const entry of wmCodes) {
      assert.equal(entry.grantedTo.includes("sales"), false, entry.code);
      for (const { name, sql } of allMigrations) {
        assert.doesNotMatch(sql, new RegExp(`\\('sales'\\s*,\\s*'${entry.code.replace(/\./g, "\\.")}'\\)`), `${entry.code} in ${name}`);
      }
    }
    assert.deepEqual(
      [...whatsappControlPlaneCodesForRole("sales")].sort(),
      [...WHATSAPP_LEGACY_ROLE_EXISTING_CODES.sales].sort()
    );
    assert.equal(whatsappControlPlaneCodesForRole("sales").has("whatsapp.templates.use"), false);
    assert.equal(whatsappControlPlaneCodesForRole("sales").has("whatsapp.opt_out.record"), false);
  });

  test("sales_executive holds no bulk-risk code", () => {
    const codes = whatsappControlPlaneCodesForRole("sales_executive");
    for (const entry of WHATSAPP_CONTROL_PLANE_PERMISSIONS.filter((e) => e.risk === "bulk")) {
      assert.equal(codes.has(entry.code), false, entry.code);
    }
  });

  test("project manager and designer hold no WhatsApp control-plane code", () => {
    assert.equal(whatsappControlPlaneCodesForRole("project_manager").size, 0);
    assert.equal(whatsappControlPlaneCodesForRole("designer").size, 0);
  });

  test("codes are unique", () => {
    const codes = WHATSAPP_CONTROL_PLANE_PERMISSIONS.map((e) => e.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  test("existing rows are real grants; planned rows exist in no migration yet", () => {
    for (const entry of WHATSAPP_CONTROL_PLANE_PERMISSIONS) {
      if (entry.status === "existing") {
        assert.ok(migrationFiles.includes(entry.source), `${entry.code} source ${entry.source}`);
        assert.ok(migrationText(entry.source).includes(`'${entry.code}'`), entry.code);
      } else {
        assert.match(entry.source, /^WM-[1-7]$/);
        for (const { name, sql } of allMigrations) {
          assert.equal(sql.includes(`'${entry.code}'`), false, `${entry.code} in ${name}`);
        }
      }
    }
  });

  test("existing inbox rows mirror the M19 role grants", () => {
    for (const code of ["whatsapp.inbox.read", "whatsapp.inbox.use", "whatsapp.inbox.manage"]) {
      const entry = WHATSAPP_CONTROL_PLANE_PERMISSIONS.find((e) => e.code === code);
      assert.ok(entry);
      const expected = Object.entries(WHATSAPP_INBOX_ROLE_PERMISSIONS)
        .filter(([, codes]) => (codes as readonly string[]).includes(code))
        .map(([role]) => role)
        .sort();
      assert.deepEqual([...entry.grantedTo].sort(), expected, code);
    }
  });

  test("generic campaign grants in M31/M33 are Super Admin and Sales Manager only", () => {
    for (const file of [
      "20260818140000_campaign_consent_audience_approval_foundation.sql",
      "20260820140000_campaign_execution_foundation.sql",
    ]) {
      assert.match(migrationText(file), /and r\.code in \('super_admin', 'sales_manager'\)/, file);
    }
  });

  test("campaigns.execute alone does not authorise a WhatsApp run", () => {
    const execute = WHATSAPP_CONTROL_PLANE_PERMISSIONS.find((e) => e.code === "campaigns.execute");
    assert.match(execute?.note ?? "", /NOT sufficient for a WhatsApp run/);
    assert.ok(WHATSAPP_CONTROL_PLANE_PERMISSIONS.some((e) => e.code === "whatsapp.campaigns.execute"));
  });

  test("Sales Manager self-approval restriction is reused unchanged", () => {
    const base = { profileId: "sm", role: "sales_manager" as const, isVersionRequester: false };
    assert.equal(canApproveCampaignVersion({ ...base, isVersionCreator: true }), false);
    assert.equal(canApproveCampaignVersion({ ...base, isVersionCreator: false }), true);
  });
});

describe("2b — locked Sales Manager run execution authority", () => {
  const sm: WhatsappCampaignRunOperatorEvidence = {
    role: "sales_manager",
    permissions: whatsappControlPlaneCodesForRole("sales_manager"),
    action: "execute",
    versionStatus: "approved",
    actorApprovedVersion: false,
    sendingGatesOpen: true,
  };
  const sa: WhatsappCampaignRunOperatorEvidence = {
    ...sm,
    role: "super_admin",
    permissions: whatsappControlPlaneCodesForRole("super_admin"),
  };

  test("Sales Manager may execute, schedule, pause and resume an independently approved version", () => {
    for (const action of ["execute", "schedule", "pause", "resume"] as const) {
      assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action }), { allowed: true }, action);
    }
  });

  test("Sales Manager is refused when not approved, self-approved, gates closed or code missing", () => {
    for (const action of ["execute", "schedule", "pause", "resume"] as const) {
      assert.deepEqual(
        evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action, versionStatus: "pending_approval" }),
        { allowed: false, reason: "version_not_approved" },
        action
      );
      assert.deepEqual(
        evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action, actorApprovedVersion: true }),
        { allowed: false, reason: "approved_by_actor" },
        action
      );
      const withoutDedicated = new Set([...sm.permissions].filter((c) => c !== "whatsapp.campaigns.execute"));
      withoutDedicated.add("campaigns.execute");
      assert.deepEqual(
        evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action, permissions: withoutDedicated }),
        { allowed: false, reason: "missing_permission" },
        `${action}: generic campaigns.execute is not sufficient`
      );
    }
    for (const action of ["execute", "schedule", "resume"] as const) {
      assert.deepEqual(
        evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action, sendingGatesOpen: false }),
        { allowed: false, reason: "sending_gates_closed" },
        action
      );
    }
    assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action: "pause", sendingGatesOpen: false }), {
      allowed: true,
    });
  });

  test("cancel, per-recipient export and settings are Super Admin only", () => {
    for (const action of WHATSAPP_SUPER_ADMIN_ONLY_RUN_ACTIONS) {
      assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, action }), {
        allowed: false,
        reason: "super_admin_only",
      });
      assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...sa, action }), { allowed: true });
    }
  });

  test("every other role is refused every run action, even holding codes by mistake", () => {
    const everything = new Set(WHATSAPP_CONTROL_PLANE_PERMISSIONS.map((e) => e.code));
    for (const role of ["management", "sales", "sales_executive", "project_manager", "designer"] as const) {
      for (const action of WHATSAPP_CAMPAIGN_RUN_OPERATOR_ACTIONS) {
        assert.deepEqual(
          evaluateWhatsappCampaignRunOperatorAuthority({ ...sm, role, action, permissions: everything }),
          { allowed: false, reason: "role_not_authorised" },
          `${role} ${action}`
        );
      }
    }
  });
});

/* ========================================================================== */
/* 3. leads.assigned_to is the only conversation owner                        */
/* ========================================================================== */

describe("3 — leads.assigned_to remains canonical conversation ownership", () => {
  test("the frozen authority names leads.assigned_to", () => {
    assert.deepEqual(WHATSAPP_CONVERSATION_OWNERSHIP_AUTHORITY, {
      table: "public.leads",
      column: "assigned_to",
      linkedVia: "public.whatsapp_conversations.lead_id",
    });
    assert.ok(Object.values(WHATSAPP_REASSIGNMENT_RULES).every((rule) => rule === true));
  });

  test("current DB view/use predicates compare leads.assigned_to to auth.uid()", () => {
    for (const fn of [
      "private.whatsapp_inbox_can_view_conversation",
      "private.whatsapp_inbox_can_use_conversation",
    ]) {
      assert.match(latestFunctionDefinition(fn), /l\.assigned_to = \(select auth\.uid\(\)\)/, fn);
    }
  });

  test("no migration gives whatsapp_conversations an owner column", () => {
    const createStart = allMigrations
      .map(({ sql }) => sql)
      .join("\n")
      .indexOf("create table public.whatsapp_conversations (");
    const all = allMigrations.map(({ sql }) => sql).join("\n");
    const createBlock = all.slice(createStart, all.indexOf(");", createStart));
    for (const column of FORBIDDEN_CONVERSATION_OWNER_COLUMNS) {
      assert.doesNotMatch(createBlock, new RegExp(`^\\s*${column}\\s`, "m"), column);
      assert.doesNotMatch(
        all,
        new RegExp(
          `alter table (public\\.)?whatsapp_conversations[^;]*add column (if not exists )?${column}\\b`,
          "i"
        ),
        column
      );
    }
  });

  test("tombstoned-lead chats: manage scope read-only, salesperson invisible, nobody sends", () => {
    const policy = WHATSAPP_TOMBSTONED_LEAD_CONVERSATION_POLICY;
    assert.deepEqual(policy.assignedScope, { read: false, use: false, existenceVisible: false });
    assert.deepEqual(policy.manageScope, { read: "historical_read_only", use: false, existenceVisible: true });
    assert.equal(policy.evidenceRetained, true);
    assert.equal(policy.governedRestoreResumesAssignmentAccess, true);
    assert.equal(policy.readSideImplementedIn, "WM-1");
  });

  test("the use/send predicate is already tombstone-hardened", () => {
    assert.match(
      latestFunctionDefinition("private.whatsapp_inbox_can_use_conversation"),
      /from public\.leads where deleted_at is null/
    );
  });

  test("no WhatsApp source invents a competing owner field", () => {
    for (const file of [...whatsappSources, ...marketingSources]) {
      if (file.endsWith("conversation-ownership.ts")) continue;
      assert.doesNotMatch(code(read(file)), /assigned_sales_rep|salesRepId|conversationOwner/, file);
    }
  });

  test("reassignment moves access immediately and leaves manage scope intact", () => {
    const actor = (id: string, roles: string[], perms: string[]): InboxAccessContext => ({
      actorId: id,
      isActiveStaff: true,
      permissions: new Set(perms),
      roles: new Set(roles),
    });
    const alice = actor("alice", ["sales_executive"], ["whatsapp.inbox.read", "whatsapp.inbox.use"]);
    const bob = actor("bob", ["sales_executive"], ["whatsapp.inbox.read", "whatsapp.inbox.use"]);
    const manager = actor("mgr", ["sales_manager"], [
      "whatsapp.inbox.read",
      "whatsapp.inbox.use",
      "whatsapp.inbox.manage",
    ]);

    const before = { conversationId: "c1", leadId: "l1", assignedTo: "alice" };
    const after = { ...before, assignedTo: "bob" };

    assert.equal(canViewWhatsappConversation(alice, before), true);
    assert.equal(canViewWhatsappConversation(bob, before), false);
    assert.equal(canViewWhatsappConversation(alice, after), false);
    assert.equal(canUseWhatsappConversation(alice, after), false);
    assert.equal(canViewWhatsappConversation(bob, after), true);
    assert.equal(canUseWhatsappConversation(bob, after), true);
    assert.equal(after.leadId, before.leadId);
    assert.equal(canViewWhatsappConversation(manager, before), true);
    assert.equal(canViewWhatsappConversation(manager, after), true);

    const unlinked = { conversationId: "c2", leadId: null, assignedTo: null };
    assert.equal(canViewWhatsappConversation(alice, unlinked), false);
    assert.equal(canViewWhatsappConversation(manager, unlinked), true);
  });
});

/* ========================================================================== */
/* 4. Official Cloud API only                                                 */
/* ========================================================================== */

const UNOFFICIAL_WHATSAPP_PACKAGES = [
  "whatsapp-web.js",
  "baileys",
  "@whiskeysockets/baileys",
  "@adiwajshing/baileys",
  "venom-bot",
  "@wppconnect-team/wppconnect",
  "@open-wa/wa-automate",
  "whatsapp-web",
  "wa-automate",
  "puppeteer",
  "puppeteer-core",
];

describe("4 — no unofficial WhatsApp dependency", () => {
  test("package.json declares none", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of UNOFFICIAL_WHATSAPP_PACKAGES) {
      assert.equal(declared.includes(banned), false, banned);
    }
  });

  test("the lockfile resolves none", () => {
    const lock = JSON.parse(read("package-lock.json")) as { packages?: Record<string, unknown> };
    const installed = Object.keys(lock.packages ?? {});
    for (const banned of UNOFFICIAL_WHATSAPP_PACKAGES) {
      assert.equal(
        installed.some((key) => key === `node_modules/${banned}` || key.endsWith(`/node_modules/${banned}`)),
        false,
        banned
      );
    }
  });

  test("no source targets WhatsApp Web or QR pairing", () => {
    for (const file of allAppSources) {
      if (file.endsWith("wm-0-control-plane-contracts.test.ts")) continue;
      assert.doesNotMatch(code(read(file)), /web\.whatsapp\.com|qrcode-terminal|useMultiFileAuthState/, file);
    }
  });
});

/* ========================================================================== */
/* 5. Meta secrets stay on the server                                         */
/* ========================================================================== */

describe("5 — no browser-side Meta token", () => {
  const clientFiles = allAppSources.filter(
    (file) => !file.includes("/__tests__/") && /^\s*["']use client["']/.test(read(file))
  );

  test("client components never touch Meta WhatsApp credentials or the Graph API", () => {
    assert.ok(clientFiles.length > 0, "client components were discovered");
    for (const file of clientFiles) {
      const src = code(read(file));
      assert.doesNotMatch(src, /META_WHATSAPP_|accessToken|graph\.facebook\.com/, file);
      assert.doesNotMatch(src, /whatsapp-outbound-env|whatsapp-meta-provider-adapter/, file);
    }
  });

  test("no NEXT_PUBLIC variable exposes a Meta WhatsApp credential or account id", () => {
    // NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164 is the public number printed on the
    // site, not a credential; everything that authenticates to Meta is not.
    const credentialLike =
      /NEXT_PUBLIC_[A-Z_]*(META_WHATSAPP|WHATSAPP_[A-Z_]*(TOKEN|SECRET|KEY|PHONE_NUMBER_ID|WABA|APP_ID))/;
    for (const file of allAppSources) {
      if (file.includes("/__tests__/")) continue;
      assert.doesNotMatch(read(file), credentialLike, file);
    }
    for (const entry of ONEDECORE_ENV_CONTRACT) {
      if (entry.name.startsWith("META_WHATSAPP_") || entry.sensitivity === "secret") {
        assert.equal(entry.scope, "server", entry.name);
      }
    }
  });

  test("the marketing module reads no environment and holds no credential", () => {
    for (const file of marketingSources) {
      assert.doesNotMatch(code(read(file)), /process\.env|accessToken|appSecret/, file);
    }
  });
});

/* ========================================================================== */
/* 6. public.campaign_runs remains paid-ads only                              */
/* ========================================================================== */

describe("6 — WhatsApp bulk sends do not reuse public.campaign_runs", () => {
  test("campaign_runs provider CHECK is still meta_ads / google_ads only", () => {
    const hits = allMigrations.filter(({ sql }) => sql.includes("chk_campaign_runs_provider"));
    assert.equal(hits.length, 1);
    assert.match(
      hits[0]?.sql ?? "",
      /constraint chk_campaign_runs_provider check \(provider_channel in \('meta_ads', 'google_ads'\)\)/
    );
  });

  test("paid-ads execution refuses a WhatsApp-only version", () => {
    assert.equal((PAID_ADS_CHANNELS as readonly string[]).includes("whatsapp"), false);
    assert.equal(resolvePaidAdsExecutionChannel(["whatsapp"]).ok, false);
  });

  test("the plan writes WhatsApp execution to its own tables", () => {
    for (const object of WHATSAPP_PLANNED_SCHEMA_OBJECTS) {
      assert.match(object.name, /^public\.whatsapp_/, object.name);
      for (const paid of PAID_ADS_EXECUTION_TABLES_NOT_FOR_WHATSAPP) {
        assert.equal(object.name.startsWith(paid), false, object.name);
      }
    }
    const names = WHATSAPP_PLANNED_SCHEMA_OBJECTS.map((o) => o.name);
    for (const required of [
      "public.whatsapp_campaign_specs",
      "public.whatsapp_campaign_runs",
      "public.whatsapp_campaign_recipients",
      "public.whatsapp_campaign_dispatch_jobs",
      "public.whatsapp_campaign_dispatch_events",
      "public.whatsapp_message_campaign_attributions",
      "public.whatsapp_template_snapshots",
      "public.whatsapp_conversation_staff_state",
    ]) {
      assert.ok(names.includes(required), required);
    }
  });

  test("authoritative tables are reused, not re-planned", () => {
    const planned = new Set(WHATSAPP_PLANNED_SCHEMA_OBJECTS.map((o) => o.name));
    for (const { table } of WHATSAPP_CONTROL_PLANE_AUTHORITATIVE_TABLES) {
      assert.equal(planned.has(table), false, table);
    }
  });

  test("marketing sources reference paid-ads run tables only in the exclusion list", () => {
    for (const file of marketingSources) {
      if (file.endsWith("schema-plan.ts")) continue;
      assert.doesNotMatch(code(read(file)), /campaign_run(s|_targets|_operations)\b/, file);
    }
  });
});

/* ========================================================================== */
/* 7. WM-0 adds no marketing provider call                                    */
/* ========================================================================== */

describe("7 — no marketing provider call in WM-0", () => {
  test("the marketing module has no network, server-only or provider imports", () => {
    assert.ok(marketingSources.length > 0);
    for (const file of marketingSources) {
      const src = code(read(file));
      assert.doesNotMatch(src, /\bfetch\(|graph\.facebook\.com|["']server-only["']/, file);
      assert.doesNotMatch(src, /whatsapp\/server\//, file);
    }
  });

  test("the provider port still exposes text dispatch only", () => {
    const port = code(read("src/features/whatsapp/server/whatsapp-provider-adapter.ts"));
    assert.match(port, /dispatchTextMessage\(/);
    assert.doesNotMatch(port, /dispatchTemplateMessage|dispatchMediaMessage/);
  });

  test("the WhatsApp /messages Graph call site is still the single Meta adapter", () => {
    const callers = allAppSources.filter(
      (file) =>
        !file.includes("/__tests__/") &&
        /graph\.facebook\.com\/\$\{[^}]+\}\/\$\{[^}]*phoneNumberId[^}]*\}\/messages/.test(read(file))
    );
    assert.deepEqual(callers, ["src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts"]);
  });

  test("the channel core never imports the marketing control plane", () => {
    for (const file of whatsappSources) {
      assert.doesNotMatch(read(file), /whatsapp-marketing/, file);
    }
  });
});

/* ========================================================================== */
/* Frozen lifecycle, eligibility and policy contracts                         */
/* ========================================================================== */

describe("campaign and run lifecycle", () => {
  test("a spec freezes the moment its version leaves draft", () => {
    assert.equal(whatsappCampaignSpecStateForVersionStatus("draft"), "draft");
    for (const status of ["pending_approval", "approved", "rejected"] as const) {
      assert.equal(whatsappCampaignSpecStateForVersionStatus(status), "frozen");
    }
  });

  test("terminal run states have no exits and reconciliation cannot be cancelled away", () => {
    for (const terminal of WHATSAPP_CAMPAIGN_RUN_TERMINAL_STATES) {
      for (const to of WHATSAPP_CAMPAIGN_RUN_STATES) {
        assert.equal(validateWhatsappCampaignRunTransition(terminal, to).allowed, false);
      }
    }
    assert.equal(validateWhatsappCampaignRunTransition("reconciling", "cancelled").allowed, false);
    assert.equal(validateWhatsappCampaignRunTransition("paused", "dispatching").allowed, true);
  });

  test("a run needs an approved, WhatsApp-only, frozen, approved-template version with gates open", () => {
    const ok = {
      versionStatus: "approved" as const,
      intendedChannels: ["whatsapp"],
      specState: "frozen" as const,
      templateSnapshotApproved: true,
      outboundKillSwitchOpen: true,
      marketingExecutionEnabled: true,
    };
    assert.deepEqual(evaluateWhatsappCampaignRunCreation(ok), { allowed: true });
    assert.deepEqual(evaluateWhatsappCampaignRunCreation({ ...ok, versionStatus: "pending_approval" }), {
      allowed: false,
      reason: "version_not_approved",
    });
    assert.deepEqual(evaluateWhatsappCampaignRunCreation({ ...ok, intendedChannels: ["whatsapp", "meta_ads"] }), {
      allowed: false,
      reason: "version_not_whatsapp_only",
    });
    assert.equal(evaluateWhatsappCampaignRunCreation({ ...ok, outboundKillSwitchOpen: false }).allowed, false);
    assert.equal(evaluateWhatsappCampaignRunCreation({ ...ok, marketingExecutionEnabled: false }).allowed, false);
  });
});

describe("dispatch job lifecycle and outcomes", () => {
  test("a claimed job is never cancelled and an ambiguous job is never re-queued", () => {
    assert.equal(validateWhatsappDispatchJobTransition("claimed", "cancelled").allowed, false);
    assert.equal(validateWhatsappDispatchJobTransition("needs_reconcile", "pending").allowed, false);
    assert.equal(validateWhatsappDispatchJobTransition("needs_reconcile", "succeeded").allowed, true);
    for (const terminal of ["succeeded", "skipped", "failed", "cancelled"] as const) {
      for (const to of WHATSAPP_DISPATCH_JOB_STATES) {
        assert.equal(validateWhatsappDispatchJobTransition(terminal, to).allowed, false);
      }
    }
  });

  test("ambiguous provider outcomes reconcile; transient failures retry within bounds", () => {
    const snapshot = {};
    const ambiguous = { kind: "ambiguous", code: "timeout", message: "t", httpStatus: null, responseSnapshot: snapshot } as const;
    const transient = { kind: "failed", errorClass: "transient", code: "429", message: "r", httpStatus: 429, responseSnapshot: snapshot } as const;
    const terminal = { kind: "failed", errorClass: "terminal", code: "400", message: "b", httpStatus: 400, responseSnapshot: snapshot } as const;
    const success = { kind: "success", providerMessageId: "wamid.x", providerTimestamp: "2026-09-13T00:00:00Z", httpStatus: 200, responseSnapshot: snapshot } as const;

    assert.equal(classifyWhatsappMarketingProviderResult(ambiguous, 1), "needs_reconcile");
    assert.equal(classifyWhatsappMarketingProviderResult(transient, 1), "retry_scheduled");
    assert.equal(
      classifyWhatsappMarketingProviderResult(transient, WHATSAPP_DISPATCH_WORKER_BOUNDS.maxAttempts),
      "failed_terminal"
    );
    assert.equal(classifyWhatsappMarketingProviderResult(terminal, 1), "failed_terminal");
    assert.equal(classifyWhatsappMarketingProviderResult(success, 1), "bound");
  });

  test("every outcome maps to a job state or to no change", () => {
    for (const outcome of WHATSAPP_MARKETING_DISPATCH_OUTCOMES) {
      assert.ok(outcome in WHATSAPP_MARKETING_DISPATCH_OUTCOME_JOB_STATE, outcome);
    }
  });

  test("backoff is bounded and correlation keys carry no PII", () => {
    assert.equal(whatsappDispatchRetryDelaySeconds(1), WHATSAPP_DISPATCH_WORKER_BOUNDS.backoffBaseSeconds);
    assert.equal(whatsappDispatchRetryDelaySeconds(99), WHATSAPP_DISPATCH_WORKER_BOUNDS.backoffMaxSeconds);
    assert.equal(whatsappDispatchCorrelationKey({ runId: "r1", jobId: "j1" }), "odwm:r1:j1");
  });
});

describe("recipient eligibility", () => {
  const eligible: WhatsappMarketingRecipientEvidence = {
    runState: "dispatching",
    templateStatus: normalizeWhatsappTemplateStatus("APPROVED"),
    templateCategory: normalizeWhatsappTemplateCategory("MARKETING"),
    alreadyBound: false,
    contactStatus: "active",
    whatsappChannelStatus: "active",
    latestMarketingConsentEvent: "granted",
    preferenceOptedOut: false,
    variables: { ok: true },
    policy: { frequencyCapped: false, withinQuietHours: false },
  };

  test("a fully evidenced recipient is eligible", () => {
    assert.deepEqual(evaluateWhatsappMarketingRecipient(eligible), { decision: "eligible" });
  });

  test("DNC outranks missing consent; suppression outranks consent", () => {
    assert.deepEqual(
      evaluateWhatsappMarketingRecipient({ ...eligible, contactStatus: "do_not_contact", latestMarketingConsentEvent: null }),
      { decision: "skip", reason: "contact_do_not_contact" }
    );
    assert.deepEqual(
      evaluateWhatsappMarketingRecipient({ ...eligible, whatsappChannelStatus: "suppressed", latestMarketingConsentEvent: "withdrawn" }),
      { decision: "skip", reason: "channel_suppressed" }
    );
  });

  test("only a latest MARKETING grant counts; withdrawal wins", () => {
    for (const [event, reason] of [
      [null, "marketing_consent_missing"],
      ["withdrawn", "marketing_consent_withdrawn"],
      ["suppressed", "marketing_consent_suppressed"],
      ["expired", "marketing_consent_expired"],
    ] as const) {
      assert.deepEqual(
        evaluateWhatsappMarketingRecipient({ ...eligible, latestMarketingConsentEvent: event }),
        { decision: "skip", reason }
      );
    }
  });

  test("paused template, missing variables, unconfigured policy and caps fail closed", () => {
    assert.equal(
      (evaluateWhatsappMarketingRecipient({ ...eligible, templateStatus: normalizeWhatsappTemplateStatus("PAUSED") }) as { reason: string }).reason,
      "template_not_approved"
    );
    assert.equal(
      (evaluateWhatsappMarketingRecipient({ ...eligible, variables: { ok: false, missing: ["1"], invalid: [], unexpected: [] } }) as { reason: string }).reason,
      "variables_missing"
    );
    assert.equal(
      (evaluateWhatsappMarketingRecipient({ ...eligible, policy: null }) as { reason: string }).reason,
      "send_policy_unconfigured"
    );
    assert.equal(
      (evaluateWhatsappMarketingRecipient({ ...eligible, policy: { frequencyCapped: true, withinQuietHours: false } }) as { reason: string }).reason,
      "frequency_capped"
    );
    assert.equal(
      (evaluateWhatsappMarketingRecipient({ ...eligible, alreadyBound: true }) as { reason: string }).reason,
      "already_sent"
    );
  });

  test("quiet hours defer rather than skip; paused runs claim nothing", () => {
    assert.deepEqual(
      evaluateWhatsappMarketingRecipient({ ...eligible, policy: { frequencyCapped: false, withinQuietHours: true } }),
      { decision: "defer", reason: "quiet_hours" }
    );
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, runState: "paused" }), {
      decision: "skip",
      reason: "run_not_active",
    });
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, runState: null }), { decision: "eligible" });
  });

  test("there is no override input and every skip reason has a preview bucket", () => {
    assert.doesNotMatch(
      code(read(`${MARKETING_ROOT}/contracts/eligibility.ts`)),
      /override|force|sendAnyway|send_anyway|bypass/i
    );
    for (const reason of WHATSAPP_MARKETING_SKIP_REASONS) {
      const bucket = whatsappAudiencePreviewBucket({ decision: "skip", reason });
      assert.ok((WHATSAPP_AUDIENCE_PREVIEW_BUCKETS as readonly string[]).includes(bucket), reason);
      assert.notEqual(bucket, "eligible", reason);
    }
    assert.equal(whatsappAudiencePreviewBucket({ decision: "skip", reason: "contact_do_not_contact" }), "do_not_contact");
    assert.equal(whatsappAudiencePreviewBucket({ decision: "skip", reason: "whatsapp_channel_missing" }), "missing_whatsapp");
  });
});

describe("templates", () => {
  test("unknown provider values stay raw-safe and are never sendable", () => {
    const unknown = normalizeWhatsappTemplateStatus("SOMETHING_NEW");
    assert.equal(unknown.value, "unknown");
    assert.equal(isWhatsappTemplateStatusSendable(unknown), false);
    assert.equal(isWhatsappTemplateStatusSendable(normalizeWhatsappTemplateStatus("approved")), true);
    assert.equal(isWhatsappTemplateStatusSendable(normalizeWhatsappTemplateStatus("PAUSED")), false);
    assert.equal(normalizeWhatsappTemplateStatus("x".repeat(500)).raw.length, WHATSAPP_TEMPLATE_RAW_VALUE_MAX_LENGTH);
    assert.equal(normalizeWhatsappTemplateStatus(42).value, "unknown");
  });

  test("variables fail closed on missing, blank, invalid or unexpected values", () => {
    const schema = {
      parameterFormat: "POSITIONAL" as const,
      variables: [
        { key: "1", component: "BODY" as const, maxLength: 20 },
        { key: "2", component: "BODY" as const, maxLength: 20 },
      ],
    };
    assert.deepEqual(validateWhatsappTemplateVariables(schema, { "1": "Asha", "2": "Pune" }), { ok: true });
    assert.deepEqual(validateWhatsappTemplateVariables(schema, { "1": "Asha", "2": "  " }), {
      ok: false,
      missing: ["2"],
      invalid: [],
      unexpected: [],
    });
    assert.deepEqual(validateWhatsappTemplateVariables(schema, { "1": "a\nb", "2": "ok", "3": "x" }), {
      ok: false,
      missing: [],
      invalid: ["1"],
      unexpected: ["3"],
    });
  });

  test("the Graph API version is not hard-coded into the template contracts", () => {
    assert.doesNotMatch(code(read("src/features/whatsapp/contracts/template-registry.ts")), /v\d+\.\d+/);
  });
});

describe("preferences, opt-out, frequency and quiet hours", () => {
  test("preference categories are frozen", () => {
    assert.deepEqual([...WHATSAPP_MARKETING_PREFERENCE_CATEGORIES], [
      "design_inspiration",
      "offers",
      "project_updates",
      "referral",
      "educational_content",
    ]);
  });

  test("opt-out is whole-message, case/punctuation tolerant, and never a substring match", () => {
    for (const text of ["STOP", " Stop! ", "unsubscribe", "Remove me", "NO MARKETING.", "opt-out"]) {
      assert.equal(classifyWhatsappOptOutSignal(text), "explicit_opt_out", text);
    }
    for (const text of [
      "don't stop",
      "I can't stop smiling",
      "stopping by tomorrow",
      "please remove me from the old number and use this one",
      "nonstop",
      "",
      null,
    ]) {
      assert.equal(classifyWhatsappOptOutSignal(text), "none", String(text));
    }
    assert.equal(classifyWhatsappOptOutSignal("STOP"), classifyWhatsappOptOutSignal("STOP"));
  });

  test("quiet hours are evaluated in the policy timezone, overnight windows included", () => {
    const quiet = { timezone: WHATSAPP_MARKETING_DEFAULT_TIMEZONE, startLocal: "21:00", endLocal: "09:00" };
    assert.equal(WHATSAPP_MARKETING_DEFAULT_TIMEZONE, "Asia/Kolkata");
    // 16:30Z = 22:00 IST
    assert.equal(isWithinWhatsappQuietHours(new Date("2026-09-13T16:30:00Z"), quiet), true);
    // 06:30Z = 12:00 IST
    assert.equal(isWithinWhatsappQuietHours(new Date("2026-09-13T06:30:00Z"), quiet), false);
    // 03:30Z = 09:00 IST, end exclusive
    assert.equal(isWithinWhatsappQuietHours(new Date("2026-09-13T03:30:00Z"), quiet), false);
  });

  test("frequency caps are rolling and the policy has no hidden defaults", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    const rules = [{ windowHours: 24, maxMessages: 1 }];
    assert.equal(isWhatsappFrequencyCapped(now, [new Date("2026-09-13T01:00:00Z")], rules), true);
    assert.equal(isWhatsappFrequencyCapped(now, [new Date("2026-09-12T11:00:00Z")], rules), false);
    assert.equal(
      validateWhatsappMarketingSendPolicy({
        frequencyRules: [],
        quietHours: { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" },
      }).ok,
      false
    );
    assert.equal(
      validateWhatsappMarketingSendPolicy({
        frequencyRules: rules,
        quietHours: { timezone: "Not/AZone", startLocal: "21:00", endLocal: "09:00" },
      }).ok,
      false
    );
    assert.equal(
      validateWhatsappMarketingSendPolicy({
        frequencyRules: rules,
        quietHours: { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" },
      }).ok,
      true
    );
  });
});

describe("staff read state is separate from provider read", () => {
  test("unread and needs-reply derive from staff and message evidence only", () => {
    const evidence = {
      lastInboundAt: "2026-09-13T10:00:00Z",
      lastOutboundAt: "2026-09-13T09:00:00Z",
      staffLastReadMessageAt: null,
    };
    assert.deepEqual(deriveWhatsappConversationAttention(evidence), {
      unread: true,
      needsReply: true,
      waitingOnCustomer: false,
    });
    assert.deepEqual(
      deriveWhatsappConversationAttention({ ...evidence, staffLastReadMessageAt: "2026-09-13T10:00:00Z" }),
      { unread: false, needsReply: true, waitingOnCustomer: false }
    );
    assert.deepEqual(
      deriveWhatsappConversationAttention({ ...evidence, lastOutboundAt: "2026-09-13T11:00:00Z" }),
      { unread: true, needsReply: false, waitingOnCustomer: true }
    );
  });

  test("the staff state contract never references provider read status", () => {
    const src = code(read("src/features/whatsapp/contracts/staff-conversation-state.ts"));
    assert.doesNotMatch(src, /latest_status|latestStatus|status_events/);
  });
});

describe("governance documents exist and point at each other", () => {
  test("ADR-0034 and the master plan are present", () => {
    const adr = "docs/ADR/ADR-0034-complete-whatsapp-marketing-control-plane-and-crm-owned-conversation-access.md";
    const plan = "docs/product/whatsapp-marketing-control-plane.md";
    assert.ok(existsSync(join(root, adr)));
    assert.ok(existsSync(join(root, plan)));
    assert.match(read(adr), /Complete WhatsApp Marketing Control Plane and CRM-Owned Conversation Access/);
    assert.match(read(plan), /ADR-0034/);
    assert.match(read("docs/08-whatsapp-and-n8n-boundary.md"), /ADR-0034/);
    assert.match(read("docs/product/crm-whatsapp-launch-certification.md"), /ADR-0034/);
  });

  test("role, execution and tombstone decisions are locked, not open, in the ADR and master plan", () => {
    const adr = read(
      "docs/ADR/ADR-0034-complete-whatsapp-marketing-control-plane-and-crm-owned-conversation-access.md"
    );
    const plan = read("docs/product/whatsapp-marketing-control-plane.md");
    for (const [name, doc] of [["ADR", adr], ["plan", plan]] as const) {
      assert.doesNotMatch(doc, /Sales Manager \/ management/, `${name} groups SM with legacy management`);
      assert.doesNotMatch(doc, /must decide|tombstone view decision/i, `${name} leaves tombstone open`);
      assert.doesNotMatch(doc, /whether legacy|whether Sales Manager may execute/i, `${name} leaves a decision open`);
    }
    for (const actor of ["| Sales Manager |", "| Legacy `management` |", "| Sales Executive |", "| Legacy `sales` |"]) {
      assert.ok(adr.includes(actor), `ADR authority row ${actor}`);
    }
    assert.doesNotMatch(adr, /hardened by the lead link repair and the lead tombstone migration/);
    assert.match(adr, /hardened the \*\*use\/send\*\* predicates/);
    assert.match(plan, /### 3\.4 Open owner decision\r?\n\r?\nOnly one remains: which phase carries governed outbound media/);
  });

  test("the master plan freezes sales representative chat capabilities without bulk authority", () => {
    const plan = read("docs/product/whatsapp-marketing-control-plane.md");
    const start = plan.indexOf("### 12.1 Sales Representative chat capabilities");
    assert.ok(start !== -1, "§12.1 present");
    const section = plan.slice(start, plan.indexOf("\n## ", start));
    for (const capability of [
      "True unread state",
      "Approved template insertion",
      "Saved replies",
      "Reply-to",
      "Delivery / read / failed evidence",
      "inbound media",
      "Kriti / AI draft assist",
      "Lead context",
      "Campaign / template origin context",
      "send-eligibility",
    ]) {
      assert.ok(section.includes(capability), capability);
    }
    assert.match(section, /never auto-send/);
    assert.match(section, /no override control exists for any role/);
    assert.match(section, /never gains[^\n]*bulk draft\/approve\/execute/);
  });
});
