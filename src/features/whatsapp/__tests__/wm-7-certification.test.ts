/**
 * WM-7 — WhatsApp control-plane certification (application half).
 *
 * One place that re-proves the locked rules across WM-2…WM-6 so a later change
 * cannot quietly loosen one of them:
 *
 *   permission matrix and legacy freeze        nav and route permissions
 *   UTILITY approved-only; MARKETING never     unknown raw template statuses
 *   on the service path                        official type=template payload
 *   independent consent and opt-out            quiet hours and caps
 *   campaign eligibility precedence            independent approval actors
 *   durable queue ambiguity and retry          internal worker authentication
 *   closed-window composer guidance            no existence oracle
 *   safe-off environment defaults              database proof manifest
 *
 * Database proof lives in supabase/tests/database/64…69.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  evaluateWhatsappCampaignRunOperatorAuthority,
  WHATSAPP_CONTROL_PLANE_PERMISSIONS,
  whatsappControlPlaneCodesForRole,
} from "../../whatsapp-marketing/contracts/capability-matrix.ts";
import { evaluateWhatsappMarketingRecipient, type WhatsappMarketingRecipientEvidence } from "../../whatsapp-marketing/contracts/eligibility.ts";
import { isWhatsappFrequencyCapped, isWithinWhatsappQuietHours } from "../../whatsapp-marketing/contracts/preferences.ts";
import { ONEDECORE_ENV_CONTRACT } from "../../../config/env-contract.ts";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "../contracts/inbox-permissions.ts";
import { classifyWhatsappInboundOptOut, classifyWhatsappOptOutSignal } from "../contracts/inbound-opt-out.ts";
import {
  visibleWhatsappControlPlaneSections,
  WHATSAPP_CONTROL_PLANE_PERMISSION_CODES,
  WHATSAPP_CONTROL_PLANE_SECTIONS,
  type WhatsappControlPlanePermissions,
} from "../contracts/control-plane.ts";
import { presentServiceWindow } from "../contracts/message-presentation.ts";
import {
  isWhatsappTemplateStatusSendable,
  normalizeWhatsappTemplateCategory,
  normalizeWhatsappTemplateStatus,
  resolveWhatsappTemplateSendPath,
} from "../contracts/template-registry.ts";
import { rejectMarketingPurpose } from "../server/send-intent-normalization.ts";
import { buildMetaWhatsappTemplateMessagePayload } from "../server/whatsapp-meta-provider-adapter.ts";
import { getWhatsappFlowManagementMode, getWhatsappMediaMode, getWhatsappTemplateManagementMode } from "../server/whatsapp-business-env.ts";
import { getWhatsappClickTrackingMode } from "../server/whatsapp-click-env.ts";
import { getWhatsappOutboundMode } from "../server/whatsapp-outbound-env.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
const wmMigrations = migrations.filter((name) => /^2026091[3-9]\d{6}_whatsapp_/.test(name));

type Role = "super_admin" | "sales_manager" | "management" | "sales_executive" | "sales" | "project_manager" | "designer";

/** Grants as the migrations make them: ('role','code') pairs in WM migrations plus M19 inbox grants. */
function migratedCodesFor(role: Role): Set<string> {
  const codes = new Set<string>();
  for (const file of wmMigrations) {
    for (const match of read(`supabase/migrations/${file}`).matchAll(/\('([a-z_]+)',\s*'([a-z_.]+)'\)/g)) {
      if (match[1] === role && WHATSAPP_CONTROL_PLANE_PERMISSIONS.some((entry) => entry.code === match[2])) codes.add(match[2]!);
    }
  }
  for (const entry of WHATSAPP_CONTROL_PLANE_PERMISSIONS) {
    if (!/^2026091[3-9]/.test(entry.source) && entry.grantedTo.includes(role as never)) codes.add(entry.code);
  }
  return codes;
}

function navPermissions(role: Role): WhatsappControlPlanePermissions {
  const codes = migratedCodesFor(role);
  return Object.fromEntries(WHATSAPP_CONTROL_PLANE_PERMISSION_CODES.map((c) => [c, codes.has(c)])) as WhatsappControlPlanePermissions;
}

describe("1 — permission matrix and legacy freeze, from the migrations themselves", () => {
  test("every WM code is migrated and the matrix mirrors the migrated grants exactly", () => {
    for (const entry of WHATSAPP_CONTROL_PLANE_PERMISSIONS) {
      assert.equal(entry.status, "existing", entry.code);
      assert.ok(migrations.includes(entry.source), `${entry.code} → ${entry.source}`);
    }
    for (const role of ["super_admin", "sales_manager", "sales_executive", "management", "sales", "project_manager", "designer"] as const) {
      assert.deepEqual([...migratedCodesFor(role)].sort(), [...whatsappControlPlaneCodesForRole(role)].sort(), role);
    }
  });

  test("legacy roles keep only M19 inbox codes; PM and Designer hold nothing", () => {
    assert.deepEqual([...migratedCodesFor("management")].sort(), ["whatsapp.inbox.manage", "whatsapp.inbox.read", "whatsapp.inbox.use"]);
    assert.deepEqual([...migratedCodesFor("sales")].sort(), ["whatsapp.inbox.read", "whatsapp.inbox.use"]);
    assert.equal(migratedCodesFor("project_manager").size, 0);
    assert.equal(migratedCodesFor("designer").size, 0);
  });

  test("the Sales Executive target set is assigned-chat only", () => {
    assert.deepEqual([...migratedCodesFor("sales_executive")].sort(), ["whatsapp.inbox.read", "whatsapp.inbox.use", "whatsapp.opt_out.record", "whatsapp.templates.use"]);
  });

  test("Super Admin-only authority stays Super Admin only", () => {
    for (const code of ["whatsapp.settings.manage", "whatsapp.campaigns.cancel", "whatsapp.reports.export"]) {
      assert.ok(migratedCodesFor("super_admin").has(code), code);
      assert.equal(migratedCodesFor("sales_manager").has(code), false, code);
    }
  });
});

describe("2 — navigation and route permissions", () => {
  test("the nine sections in the locked order, each tied to the exact code its page checks", () => {
    assert.deepEqual(
      WHATSAPP_CONTROL_PLANE_SECTIONS.map((section) => section.label),
      ["Inbox", "Contacts", "Templates", "Campaigns", "Segments", "Automations", "Forms / Flows", "Analytics", "Settings & Compliance"]
    );
    const pages: Record<string, string> = {
      contacts: "src/app/admin/whatsapp/contacts/page.tsx",
      templates: "src/app/admin/whatsapp/templates/page.tsx",
      campaigns: "src/app/admin/whatsapp/campaigns/page.tsx",
      segments: "src/app/admin/whatsapp/segments/page.tsx",
      automations: "src/app/admin/whatsapp/automations/page.tsx",
      flows: "src/app/admin/whatsapp/forms-flows/page.tsx",
      analytics: "src/app/admin/whatsapp/analytics/page.tsx",
      settings: "src/app/admin/whatsapp/settings/page.tsx",
    };
    for (const section of WHATSAPP_CONTROL_PLANE_SECTIONS) {
      if (section.key === "inbox") continue;
      const page = code(read(pages[section.key]!));
      assert.ok(page.includes(`permissions["${section.requires}"]`), `${section.key} checks ${section.requires}`);
      assert.equal(existsSync(join(root, `src/app${section.href}/page.tsx`)), true, section.href);
    }
  });

  test("what each role is offered", () => {
    const keys = (role: Role) => visibleWhatsappControlPlaneSections(navPermissions(role)).map((section) => section.key);
    assert.deepEqual(keys("super_admin"), ["inbox", "contacts", "templates", "campaigns", "segments", "automations", "flows", "analytics", "settings"]);
    assert.deepEqual(keys("sales_manager"), ["inbox", "contacts", "templates", "campaigns", "segments", "automations", "flows", "analytics", "settings"]);
    assert.deepEqual(keys("sales_executive"), ["inbox"]);
    assert.deepEqual(keys("management"), ["inbox"]);
    assert.deepEqual(keys("sales"), ["inbox"]);
    assert.deepEqual(keys("project_manager"), []);
    assert.deepEqual(keys("designer"), []);
  });

  test("the layout is an active-staff shell, not an inbox gate for the subtree", () => {
    const layout = code(read("src/app/admin/whatsapp/layout.tsx"));
    assert.match(layout, /resolveWhatsappWorkspaceAccess/);
    assert.doesNotMatch(layout, /resolveWhatsappInboxAccess|whatsapp\.inbox\.read|WhatsappAccessDenied/);
    assert.match(layout, /visibleWhatsappControlPlaneSections/);
    const nav = code(read("src/features/whatsapp/components/shell/WhatsappWorkspaceNav.tsx"));
    assert.match(nav, /sections\.length < 2/);
  });

  test("inbox pages still guard themselves", () => {
    for (const file of ["src/app/admin/whatsapp/inbox/page.tsx", "src/app/admin/whatsapp/inbox/[conversationId]/page.tsx"]) {
      assert.match(code(read(file)), /getWhatsappInboxAccessContext\(\)[\s\S]*if \(!context\)/, file);
    }
  });
});

describe("3 — templates: UTILITY approved-only; MARKETING never on the service path", () => {
  test("unknown raw provider values normalise to unknown and are never sendable", () => {
    assert.equal(normalizeWhatsappTemplateStatus("SOMETHING_NEW").value, "unknown");
    assert.equal(isWhatsappTemplateStatusSendable(normalizeWhatsappTemplateStatus("SOMETHING_NEW")), false);
    assert.equal(isWhatsappTemplateStatusSendable(normalizeWhatsappTemplateStatus("PENDING")), false);
    assert.equal(isWhatsappTemplateStatusSendable(normalizeWhatsappTemplateStatus("APPROVED")), true);
    assert.deepEqual(resolveWhatsappTemplateSendPath(normalizeWhatsappTemplateCategory("utility_v2")), { allowed: false, reason: "template_category_unknown" });
  });

  test("the service lane refuses MARKETING in code and in SQL; one-to-one lists are UTILITY-only", () => {
    assert.throws(() => rejectMarketingPurpose("MARKETING"));
    assert.doesNotThrow(() => rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE));
    const wm2 = read("supabase/migrations/20260913140000_whatsapp_template_studio_utility_send.sql");
    assert.match(wm2, /and t\.status = 'APPROVED'\s+and t\.category = 'UTILITY'\s+and s\.category = 'UTILITY'/);
    assert.match(wm2, /'template_category_not_utility'/);
    for (const file of wmMigrations) {
      assert.doesNotMatch(read(`supabase/migrations/${file}`), /drop constraint (if exists )?chk_whatsapp_send_intents_purpose/i, file);
    }
  });

  test("the provider payload is official type=template with parameters, never substituted text", () => {
    const payload = buildMetaWhatsappTemplateMessagePayload({
      phoneNumberId: "1",
      customerE164: "+919999999999",
      templateName: "visit_update",
      templateLanguage: "en",
      components: [{ type: "body", parameters: [{ type: "text", text: "Monday" }] }],
      providerAttemptKey: "k",
    });
    assert.equal(payload.type, "template");
    assert.equal(payload.to, "919999999999");
    assert.deepEqual((payload.template as Record<string, unknown>).language, { code: "en" });
    assert.equal("text" in payload, false);
  });
});

describe("4 — consent, opt-out, quiet hours and caps", () => {
  test("opt-out is whole-message, NFKC, bounded, and includes Meta's button label only as a button", () => {
    assert.equal(classifyWhatsappOptOutSignal("ＳＴＯＰ"), "explicit_opt_out");
    assert.equal(classifyWhatsappOptOutSignal("please stop"), "none");
    assert.equal(classifyWhatsappInboundOptOut({ providerMessageType: "button", bodyText: null, content: { text: "Stop promotions" } }), "explicit_opt_out");
    assert.equal(classifyWhatsappInboundOptOut({ providerMessageType: "text", bodyText: "Stop promotions", content: {} }), "none");
    assert.equal(classifyWhatsappInboundOptOut({ providerMessageType: "interactive", bodyText: null, content: { button_reply: { title: "Unsubscribe" } } }), "explicit_opt_out");
  });

  test("service consent never counts as marketing consent in any WM SQL", () => {
    const helper = read("supabase/migrations/20260914100000_whatsapp_contacts_consent_segments_policy.sql");
    assert.match(helper, /ce\.purpose_code='MARKETING' order by/);
    for (const file of wmMigrations) {
      assert.doesNotMatch(read(`supabase/migrations/${file}`), /purpose_code\s*in\s*\([^)]*SERVICE[^)]*MARKETING|purpose_code\s*in\s*\([^)]*MARKETING[^)]*SERVICE/i, file);
    }
  });

  test("quiet hours handle overnight windows; caps count every send in the window", () => {
    const quiet = { timezone: "Asia/Kolkata", startLocal: "21:00", endLocal: "09:00" };
    assert.equal(isWithinWhatsappQuietHours(new Date("2026-09-15T17:00:00Z"), quiet), true); // 22:30 IST
    assert.equal(isWithinWhatsappQuietHours(new Date("2026-09-15T06:00:00Z"), quiet), false); // 11:30 IST
    const now = new Date("2026-09-15T12:00:00Z");
    assert.equal(isWhatsappFrequencyCapped(now, [new Date("2026-09-15T01:00:00Z")], [{ windowHours: 24, maxMessages: 1 }]), true);
    assert.equal(isWhatsappFrequencyCapped(now, [new Date("2026-09-13T01:00:00Z")], [{ windowHours: 24, maxMessages: 1 }]), false);
    const wm6 = read("supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql");
    assert.match(wm6, /from public\.whatsapp_message_automation_attributions a\s+join public\.whatsapp_automation_enrollments e/);
  });

  test("the preview agrees with JIT: a closed execution gate never counts anyone eligible", () => {
    assert.match(
      read("supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql"),
      /\(not v_has_policy or v_policy\.execution_enabled is not true\) then v_reason:='send_policy_unconfigured'/
    );
  });
});

describe("5 — campaign eligibility and independent approval actors", () => {
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
  } as unknown as WhatsappMarketingRecipientEvidence;

  test("first failing reason wins; quiet hours defer, never skip", () => {
    assert.equal(evaluateWhatsappMarketingRecipient(eligible).decision, "eligible");
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, contactStatus: "do_not_contact", latestMarketingConsentEvent: null } as never), {
      decision: "skip",
      reason: "contact_do_not_contact",
    });
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, templateCategory: normalizeWhatsappTemplateCategory("UTILITY") }), {
      decision: "skip",
      reason: "template_category_not_marketing",
    });
    assert.equal(evaluateWhatsappMarketingRecipient({ ...eligible, policy: { frequencyCapped: false, withinQuietHours: true } }).decision, "defer");
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, policy: { frequencyCapped: true, withinQuietHours: true } }), { decision: "skip", reason: "frequency_capped" });
    assert.deepEqual(evaluateWhatsappMarketingRecipient({ ...eligible, policy: null }), { decision: "skip", reason: "send_policy_unconfigured" });
  });

  test("a Sales Manager never operates a version they approved; cancel stays Super Admin", () => {
    const base = {
      role: "sales_manager" as const,
      permissions: new Set(["whatsapp.campaigns.execute", "campaigns.pause"]),
      action: "execute" as const,
      versionStatus: "approved" as const,
      actorApprovedVersion: false,
      sendingGatesOpen: true,
    };
    assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority(base), { allowed: true });
    assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...base, actorApprovedVersion: true }), { allowed: false, reason: "approved_by_actor" });
    assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...base, action: "cancel" }), { allowed: false, reason: "super_admin_only" });
    assert.deepEqual(evaluateWhatsappCampaignRunOperatorAuthority({ ...base, action: "pause", sendingGatesOpen: false }), { allowed: true });
    const wm4 = read("supabase/migrations/20260915100000_whatsapp_campaign_execution.sql");
    assert.match(wm4, /a\.decision='approved' and a\.decided_by=p_actor_id/);
    const wm6 = read("supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql");
    assert.match(wm6, /v_denial:=private\.whatsapp_campaign_operator_denial\(v_actor,a\.campaign_version_id\)/);
  });
});

describe("6 — durable queues: ambiguity is parked, retries are bounded", () => {
  test("both queues use SKIP LOCKED claims with a TTL, bounded batches and max three attempts", () => {
    const wm5 = read("supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql");
    const wm6 = read("supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql");
    for (const sql of [wm5, wm6]) {
      assert.match(sql, /for update of [a-z] skip locked limit n/);
      assert.match(sql, /interval '120 seconds'/);
      assert.match(sql, /least\(coalesce\(p_batch_size,20\),50\)/);
      assert.match(sql, /attempt_count>=3/);
      assert.match(sql, /'claim_expired_after_provider_start'/);
    }
  });

  test("worker code never retries an ambiguous outcome itself", () => {
    const worker = code(read("src/features/whatsapp/server/whatsapp-campaign-worker.ts"));
    assert.match(worker, /return failJob\(admin, queue, job, "ambiguous", "provider_call_threw"\)/);
    assert.match(worker, /"local_bind_failed"/);
    assert.doesNotMatch(worker, /while\s*\(|setTimeout|retry\(/);
  });
});

describe("7 — internal worker authentication", () => {
  test("the WhatsApp worker route refuses a missing secret, a missing bearer and a wrong bearer", async () => {
    const saved = process.env.ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET;
    try {
      const { POST } = await import("../../../app/api/internal/whatsapp-campaign-execution/dispatch/route.ts");
      delete process.env.ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET;
      assert.equal((await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: "Bearer anything" } }))).status, 401);
      process.env.ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET = "s".repeat(40);
      assert.equal((await POST(new Request("http://localhost/x", { method: "POST" }))).status, 401);
      assert.equal((await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${"t".repeat(40)}` } }))).status, 401);
      assert.equal((await POST(new Request("http://localhost/x", { method: "POST", headers: { authorization: `Basic ${"s".repeat(40)}` } }))).status, 401);
    } finally {
      if (saved === undefined) delete process.env.ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET;
      else process.env.ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET = saved;
    }
  });

  test("the route reuses the existing worker secret, compares in constant time and invents no credential", () => {
    const route = code(read("src/app/api/internal/whatsapp-campaign-execution/dispatch/route.ts"));
    assert.match(route, /getCampaignExecutionWorkerSecret/);
    assert.match(route, /timingSafeEqual/);
    // The only WhatsApp credentials are Meta's own; WM phases added none.
    assert.deepEqual(
      ONEDECORE_ENV_CONTRACT.filter((entry) => /WHATSAPP.*(SECRET|TOKEN)/.test(entry.name)).map((entry) => entry.name).sort(),
      ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_APP_SECRET", "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"]
    );
  });
});

describe("8 — closed-window composer guidance", () => {
  test("a closed window explains the refusal and points at approved templates", () => {
    const closed = presentServiceWindow("2026-09-10T00:00:00Z", new Date("2026-09-15T00:00:00Z"));
    assert.equal(closed.open, false);
    assert.match(closed.detail, /reject a free-form reply/);
    const section = code(read("src/features/whatsapp/components/inbox/InboxComposerSection.tsx"));
    assert.match(section, /canUse && serviceWindow && !serviceWindow\.open/);
    assert.match(section, /only an approved template can reach this customer/);
    assert.match(section, /canUse && templates \?/);

    const composer = code(read("src/features/whatsapp/components/inbox/InboxComposer.tsx"));
    assert.match(composer, /freeFormBlocked = serviceWindow != null && !serviceWindow\.open/);
    assert.match(composer, /disabled=\{pending \|\| freeFormBlocked\}/);
    assert.match(composer, /disabled=\{pending \|\| freeFormBlocked \|\| length === 0 \|\| over\}/);
    assert.match(composer, /Template only/);
    assert.match(composer, /Use an approved Utility template above/);
  });
});

describe("8b — growth workspace UX", () => {
  test("templates and campaigns expose guided Interakt-style workspaces without relaxing governance", () => {
    const templatesPage = code(read("src/app/admin/whatsapp/templates/page.tsx"));
    const templateForms = code(read("src/features/whatsapp/components/templates/TemplateStudioForms.tsx"));
    const campaignsPage = code(read("src/app/admin/whatsapp/campaigns/page.tsx"));
    const campaignForms = code(read("src/features/whatsapp/components/campaigns/CampaignExecutionForms.tsx"));
    const css = read("src/features/whatsapp/components/growth-workspace.css");

    assert.match(templatesPage, /WhatsApp growth workspace/);
    assert.match(templatesPage, /Message Templates/);
    assert.match(templatesPage, /Create template/);
    assert.match(templatesPage, /Pending review/);
    assert.match(templateForms, /Live preview is illustrative/);
    assert.match(templateForms, /Submit to Meta for review/);
    assert.match(templateForms, /Utility is for enquiry updates/);
    assert.match(templateForms, /Marketing is for nurture or promotions/);

    assert.match(campaignsPage, /WhatsApp campaign manager/);
    assert.match(campaignsPage, /Broadcasts, audiences & delivery/);
    assert.match(campaignsPage, /Campaign setup/);
    assert.match(campaignsPage, /Independent approval/);
    assert.match(campaignsPage, /Operator allowed/);
    assert.match(campaignForms, /ONEDECORE campaign preview/);
    assert.match(campaignForms, /revalidated before send/);

    assert.match(css, /od-growth__journey/);
    assert.match(css, /od-growth__phone/);
    assert.match(css, /od-growth__campaign-card/);

    assert.match(campaignsPage, /previewWhatsappCampaignAudienceForCurrentUser/);
    assert.match(campaignsPage, /availableWhatsappCampaignRunOperations/);
    assert.match(campaignForms, /saveWhatsappCampaignSpecAction/);
    assert.match(templateForms, /submitWhatsappTemplateAction/);
  });
});

describe("9 — no existence oracle", () => {
  test("refused and missing records answer the same in the readers the pages use", () => {
    assert.match(code(read("src/features/whatsapp/server/whatsapp-campaign-queries.ts")), /if \(error\) return null;/);
    assert.match(code(read("src/features/whatsapp/server/whatsapp-automation-queries.ts")), /if \(error\) return null;/);
    assert.match(code(read("src/app/admin/whatsapp/campaigns/page.tsx")), /does not exist or is not visible to you/);
    const wm4 = read("supabase/migrations/20260915100000_whatsapp_campaign_execution.sql");
    assert.match(wm4, /-- Invisible and nonexistent answer the same\./);
    const hardening = read("supabase/migrations/20260916100000_whatsapp_control_plane_runtime_hardening.sql");
    assert.match(hardening, /An executive outside scope learns nothing about whether the contact exists/);
  });
});

describe("10 — safe-off defaults and server-only secrets", () => {
  test("every WhatsApp provider surface defaults to disabled", () => {
    assert.equal(getWhatsappOutboundMode({}), "disabled");
    assert.equal(getWhatsappTemplateManagementMode({}), "disabled");
    assert.equal(getWhatsappFlowManagementMode({}), "disabled");
    assert.equal(getWhatsappMediaMode({}), "disabled");
    assert.equal(getWhatsappClickTrackingMode({}), "disabled");
    const example = read(".env.example");
    for (const name of ["ONEDECORE_WHATSAPP_FLOW_MODE", "ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE", "ONEDECORE_WHATSAPP_TEMPLATE_MODE", "ONEDECORE_WHATSAPP_MEDIA_MODE"]) {
      assert.match(example, new RegExp(`^${name}=disabled$`, "m"), name);
    }
  });

  test("the marketing execution gate defaults off in the database", () => {
    assert.match(read("supabase/migrations/20260914100000_whatsapp_contacts_consent_segments_policy.sql"), /execution_enabled boolean not null default false/);
    assert.match(read("supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql"), /status text not null default 'draft'/);
  });

  test("new WhatsApp env keys are server-scoped", () => {
    for (const entry of ONEDECORE_ENV_CONTRACT.filter((e) => e.subsystem === "whatsapp")) {
      assert.equal(entry.scope, "server", entry.name);
    }
  });
});

describe("11 — database proof manifest", () => {
  const suites: Record<string, readonly RegExp[]> = {
    "64_whatsapp_inbox_staff_state_attention_test.sql": [/tombstone/i, /reassign/i],
    "65_whatsapp_template_studio_utility_send_test.sql": [/MARKETING template can never enter the one-to-one lane/, /unknown/, /TOMBSTONE/, /REASSIGN/],
    "66_whatsapp_campaign_execution_test.sql": [/APPROVER_CANNOT_EXECUTE/, /needs_reconcile/, /quiet hours defer/, /frequency caps skip/],
    "67_whatsapp_contacts_consent_segments_policy_test.sql": [/service consent is shown as NO marketing consent/, /NO ORACLE/, /Stop promotions/],
    "68_whatsapp_analytics_attribution_test.sql": [/exact_context/, /inferred_window/, /NO ORACLE/, /EXPORT/],
    "69_whatsapp_automations_flows_referrals_test.sql": [/lead_tombstoned/, /AMBIGUITY/, /PROVIDER_TRUTH_FORBIDDEN/, /CTWA/],
  };
  for (const [file, patterns] of Object.entries(suites)) {
    test(file, () => {
      const path = `supabase/tests/database/${file}`;
      assert.ok(existsSync(join(root, path)), path);
      const sql = read(path);
      for (const pattern of patterns) assert.match(sql, pattern, `${file} ${pattern}`);
      assert.match(sql, /select \* from finish\(\);\s+rollback;/);
    });
  }
});
