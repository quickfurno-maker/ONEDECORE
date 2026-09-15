/**
 * WM-6 — governed automations, official Flows and CTWA referral capture,
 * application half.
 *
 * Database proof: supabase/tests/database/69_whatsapp_automations_flows_referrals_test.sql.
 * This suite proves the app: exact permissions before every RPC, a Flow
 * provider path that records the human decision first and never claims a
 * publish Meta did not report, a worker that drains automation enrollments
 * with the same ambiguity rules as campaigns, sanitised referral capture in
 * the webhook, and no Kriti path to any send, approval or mutation.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  availableWhatsappAutomationActions,
  buildWhatsappAutomationDraft,
  parseWhatsappAutomationDetail,
  WHATSAPP_AUTOMATION_RPC,
  WHATSAPP_AUTOMATION_TRIGGERS,
  WHATSAPP_AUTOMATION_WORKER_RPC,
} from "../contracts/automations.ts";
import {
  availableWhatsappFlowActions,
  buildWhatsappFlowDraft,
  normalizeWhatsappFlowStatus,
  parseWhatsappFlowProviderRequest,
  WHATSAPP_FLOW_FIELD_TARGETS,
  WHATSAPP_FLOW_RPC,
  WHATSAPP_FLOW_SERVICE_RPC,
} from "../contracts/flows.ts";
import { normalizeMetaWebhookPayload, normalizeWhatsappReferral } from "../server/meta-webhook-contract.ts";
import { dispatchWhatsappCampaignJobs, type WhatsappCampaignWorkerAdminClient } from "../server/whatsapp-campaign-worker.ts";
import { boundMetaFlowValidationErrors, createFakeWhatsappFlowProviderAdapter } from "../server/whatsapp-flow-provider-adapter.ts";
import { performWhatsappFlowProviderAction } from "../server/whatsapp-flow-management-service.ts";
import type { WhatsappBusinessServerEnv } from "../server/whatsapp-business-env.ts";
import { buildMetaGraphUrl } from "../server/whatsapp-graph-url.ts";
import type { WhatsappOutboundServerEnv } from "../server/whatsapp-outbound-env.ts";
import type { WhatsappTemplateMessageAdapter } from "../server/whatsapp-template-provider-adapter.ts";
import type { WhatsappProviderDispatchResult } from "../contracts/provider-dispatch.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MIGRATION = read("supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql");
const generatedTypes = read("src/types/database.generated.ts");
const UUID = "11111111-1111-4111-8111-111111111111";

function walk(dir: string): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const rel = `${dir}/${entry}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(rel) ? [rel] : [];
  });
}

describe("WM-6 RPC names are the migrated ones", () => {
  const all = [
    ...Object.values(WHATSAPP_AUTOMATION_RPC),
    ...Object.values(WHATSAPP_AUTOMATION_WORKER_RPC),
    ...Object.values(WHATSAPP_FLOW_RPC),
    ...Object.values(WHATSAPP_FLOW_SERVICE_RPC),
    "record_whatsapp_referral_context",
    "get_whatsapp_automation_analytics",
    "get_whatsapp_referral_analytics",
  ];
  for (const rpc of all) {
    test(rpc, () => assert.match(generatedTypes, new RegExp(`\\b${rpc}: \\{`)));
  }

  test("grants exactly SA+SM for the four WM-6 codes, no legacy or executive pair", () => {
    for (const permission of ["whatsapp.automations.read", "whatsapp.automations.manage", "whatsapp.flows.read", "whatsapp.flows.manage"]) {
      for (const role of ["super_admin", "sales_manager"]) {
        assert.ok(MIGRATION.includes(`('${role}','${permission}')`), `${role}:${permission}`);
      }
      assert.doesNotMatch(MIGRATION, new RegExp(`\\('(sales_executive|management|sales|project_manager|designer)','${permission.replace(/\./g, "\\.")}'\\)`));
    }
  });
});

describe("automation contracts", () => {
  test("triggers are the governed, evidence-backed set", () => {
    assert.deepEqual([...WHATSAPP_AUTOMATION_TRIGGERS], ["lead_created", "lead_stage_changed", "campaign_reply", "flow_completed", "ctwa_referral"]);
    for (const trigger of WHATSAPP_AUTOMATION_TRIGGERS) assert.ok(MIGRATION.includes(`'${trigger}'`), trigger);
  });

  test("status buttons: pause and archive always offered to managers; nothing to readers", () => {
    assert.deepEqual(availableWhatsappAutomationActions("draft", true), ["activate", "archive"]);
    assert.deepEqual(availableWhatsappAutomationActions("active", true), ["pause", "archive"]);
    assert.deepEqual(availableWhatsappAutomationActions("paused", true), ["resume", "archive"]);
    assert.deepEqual(availableWhatsappAutomationActions("archived", true), []);
    assert.deepEqual(availableWhatsappAutomationActions("active", false), []);
  });

  test("drafts validate triggers, config keys, delay bounds and stop statuses", () => {
    const base = {
      name: "Consultation prep",
      description: "",
      triggerType: "lead_stage_changed",
      toStage: "consultation_scheduled",
      triggerCampaignVersionId: "",
      flowId: "",
      sourceId: "",
      campaignVersionId: UUID,
      delayMinutes: "60",
      stopOnLeadStatuses: ["closed_won"],
      stopOnReply: true,
    };
    const ok = buildWhatsappAutomationDraft(base);
    assert.ok(ok.ok);
    assert.deepEqual(ok.ok && ok.value.triggerConfig, { to_stage: "consultation_scheduled" });
    assert.equal(buildWhatsappAutomationDraft({ ...base, triggerType: "every_contact" }).ok, false);
    assert.equal(buildWhatsappAutomationDraft({ ...base, delayMinutes: "43201" }).ok, false);
    assert.equal(buildWhatsappAutomationDraft({ ...base, stopOnLeadStatuses: ["new"] }).ok, false);
    assert.equal(buildWhatsappAutomationDraft({ ...base, triggerType: "flow_completed", flowId: "x" }).ok, false);
    assert.equal(buildWhatsappAutomationDraft({ ...base, triggerType: "ctwa_referral", sourceId: "ad id; drop" }).ok, false);
    assert.equal(buildWhatsappAutomationDraft({ ...base, campaignVersionId: "" }).ok, false);
  });

  test("the SQL stops on every compliance and CRM condition before a claim", () => {
    for (const reason of ["automation_not_active", "lead_tombstoned", "lead_terminal_status", "customer_replied", "send_policy_unconfigured", "frequency_capped", "quiet_hours"]) {
      assert.ok(MIGRATION.includes(`'${reason}'`), reason);
    }
    assert.match(MIGRATION, /private\.whatsapp_campaign_evaluate_contact\(e\.contact_id/);
    assert.match(MIGRATION, /constraint uq_whatsapp_automation_enrollment_contact unique \(automation_id,contact_id\)/);
    assert.match(MIGRATION, /if p_outcome='ambiguous' then v_next:='needs_reconcile';/);
  });

  test("detail parsing keeps reason counts and reconcile ids, drops junk", () => {
    const detail = parseWhatsappAutomationDetail({
      id: UUID,
      campaign_version_id: UUID,
      reasons: { customer_replied: 2, bad: "x" },
      reconcile_enrollment_ids: [UUID, 3],
      events: [{ event_type: "enrolled", actor_type: "worker" }, 7],
    });
    assert.deepEqual(detail?.reasons, [{ code: "customer_replied", count: 2 }]);
    assert.deepEqual(detail?.reconcileEnrollmentIds, [UUID]);
    assert.equal(detail?.events.length, 1);
  });
});

describe("Flow contracts and provider path", () => {
  test("unrecognised provider statuses stay unknown, never PUBLISHED", () => {
    assert.equal(normalizeWhatsappFlowStatus("published"), "PUBLISHED");
    assert.equal(normalizeWhatsappFlowStatus("LIVE"), "unknown");
    assert.equal(normalizeWhatsappFlowStatus(null), "unknown");
  });

  test("offered actions follow the provider state", () => {
    assert.deepEqual(availableWhatsappFlowActions({ providerStatus: "local_draft", providerFlowId: null, hasJson: true, validationErrorCount: 0 }), ["create"]);
    assert.deepEqual(availableWhatsappFlowActions({ providerStatus: "local_draft", providerFlowId: null, hasJson: false, validationErrorCount: 0 }), []);
    assert.deepEqual(availableWhatsappFlowActions({ providerStatus: "DRAFT", providerFlowId: "1", hasJson: true, validationErrorCount: 2 }), ["update_json", "sync"]);
    assert.deepEqual(availableWhatsappFlowActions({ providerStatus: "PUBLISHED", providerFlowId: "1", hasJson: true, validationErrorCount: 0 }), ["deprecate", "sync"]);
  });

  test("drafts accept only Meta categories, allowlisted CRM targets and a Flow document", () => {
    const base = {
      name: "Qualifier",
      categories: ["LEAD_GENERATION"],
      purpose: "lead_qualification",
      mappingKeys: ["budget", ""],
      mappingTargets: ["budget", ""],
      flowJson: '{"version":"7.0","screens":[{"id":"A"}]}',
    };
    assert.ok(buildWhatsappFlowDraft(base).ok);
    assert.equal(buildWhatsappFlowDraft({ ...base, categories: ["MAGIC"] }).ok, false);
    assert.equal(buildWhatsappFlowDraft({ ...base, mappingTargets: ["assigned_to", ""] }).ok, false);
    assert.equal(buildWhatsappFlowDraft({ ...base, mappingKeys: ["flow_token", ""] }).ok, false);
    assert.equal(buildWhatsappFlowDraft({ ...base, flowJson: '{"screens":[]}' }).ok, false);
    for (const target of WHATSAPP_FLOW_FIELD_TARGETS) assert.ok(MIGRATION.includes(`'${target}'`), target);
  });

  test("Graph URLs for Flows stay on graph.facebook.com with reviewed edges only", () => {
    assert.equal(buildMetaGraphUrl("v22.0", ["123", "flows"]), "https://graph.facebook.com/v22.0/123/flows");
    assert.equal(buildMetaGraphUrl("v22.0", ["456", "publish"]), "https://graph.facebook.com/v22.0/456/publish");
    assert.throws(() => buildMetaGraphUrl("v22.0", ["456", "../me"]));
    assert.throws(() => buildMetaGraphUrl("v22.0", ["evil.example"]));
  });

  test("the local-test fake creates DRAFT Flows and can never publish", async () => {
    const fake = createFakeWhatsappFlowProviderAdapter(new Map());
    const created = await fake.createFlow({ wabaId: "1", name: "Q", categories: ["OTHER"] });
    assert.equal(created.kind, "success");
    assert.equal(created.kind === "success" && created.rawStatus, "DRAFT");
    const published = await fake.publishFlow({ providerFlowId: created.kind === "success" ? created.providerFlowId! : "0" });
    assert.equal(published.kind, "failed");
  });

  test("validation errors from Meta are bounded to allowlisted scalar fields", () => {
    const bounded = boundMetaFlowValidationErrors(Array.from({ length: 30 }, () => ({ error: "x".repeat(500), secret: "token", line_start: 3 })));
    assert.equal(bounded?.length, 20);
    assert.deepEqual(Object.keys(bounded![0] as object).sort(), ["error", "line_start"]);
    assert.equal(((bounded![0] as Record<string, string>).error).length, 160);
  });

  const ENV: WhatsappBusinessServerEnv = {
    mode: "local-test",
    providerCode: "fake",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "service",
    graphApiVersion: "v22.0",
    accessToken: null,
    wabaId: "900000000000691",
  };

  test("disabled mode records nothing and calls nobody", async () => {
    let touched = false;
    const outcome = await performWhatsappFlowProviderAction(
      { flowId: UUID, action: "create", idempotencyKey: UUID },
      {
        getEnv: () => ({ ...ENV, mode: "disabled" }),
        createSessionClient: async () => {
          touched = true;
          return { rpc: () => Promise.resolve({ data: null, error: null }) };
        },
      }
    );
    assert.equal(outcome.outcome, "disabled");
    assert.equal(touched, false);
  });

  test("the human decision is recorded through the session BEFORE any provider call or service-role write", async () => {
    const order: string[] = [];
    const outcome = await performWhatsappFlowProviderAction(
      { flowId: UUID, action: "create", idempotencyKey: UUID },
      {
        getEnv: () => ENV,
        createSessionClient: async () => ({
          rpc: (fn: string) => {
            order.push(`session:${fn}`);
            return Promise.resolve({
              data: { request_id: UUID, reused: false, resolved: false, action: "create", flow: { provider_flow_id: null, name: "Q", categories: ["OTHER"], flow_json: { version: "7.0", screens: [{}] } } },
              error: null,
            });
          },
        }),
        createAdminClient: () => ({
          rpc: (fn: string, args?: Record<string, unknown>) => {
            order.push(`service:${fn}:${String(args?.p_outcome)}`);
            return Promise.resolve({ data: { provider_status: "DRAFT" }, error: null });
          },
        }),
        createAdapter: () => {
          const fake = createFakeWhatsappFlowProviderAdapter(new Map());
          return {
            ...fake,
            createFlow: async (request) => {
              order.push("provider:create");
              return fake.createFlow(request);
            },
          };
        },
      }
    );
    assert.equal(outcome.outcome, "accepted");
    assert.deepEqual(order, ["session:request_whatsapp_flow_provider_action", "provider:create", "service:record_whatsapp_flow_provider_outcome:accepted"]);
  });

  test("a refused session decision reaches neither Meta nor the service role", async () => {
    let providerCalled = false;
    let serviceCalled = false;
    const outcome = await performWhatsappFlowProviderAction(
      { flowId: UUID, action: "publish", idempotencyKey: UUID },
      {
        getEnv: () => ENV,
        createSessionClient: async () => ({ rpc: () => Promise.resolve({ data: null, error: { message: "WHATSAPP_FLOWS_DENIED", code: "42501" } }) }),
        createAdminClient: () => {
          serviceCalled = true;
          return { rpc: () => Promise.resolve({ data: null, error: null }) };
        },
        createAdapter: () => {
          providerCalled = true;
          return createFakeWhatsappFlowProviderAdapter(new Map());
        },
      }
    );
    assert.equal(outcome.outcome, "refused");
    assert.equal(providerCalled || serviceCalled, false);
    assert.equal(parseWhatsappFlowProviderRequest({ request_id: UUID, action: "hack", flow: {} }), null);
  });
});

describe("CTWA referral capture", () => {
  test("only allowlisted referral keys survive, bounded; Meta CDN media URLs are dropped", () => {
    const referral = normalizeWhatsappReferral({
      source_url: "https://fb.me/x",
      source_id: "1".repeat(300),
      source_type: "ad",
      headline: "h".repeat(400),
      image_url: "https://scontent.xx.fbcdn.net/secret",
      video_url: "https://video.xx.fbcdn.net/secret",
      ctwa_clid: "ARAk",
      welcome_message: { text: "hi" },
    });
    assert.deepEqual(Object.keys(referral ?? {}).sort(), ["ctwa_clid", "headline", "source_id", "source_type", "source_url"]);
    assert.equal(referral?.source_id?.length, 128);
    assert.equal(referral?.headline?.length, 200);
    assert.equal(normalizeWhatsappReferral({ image_url: "x" }), null);
  });

  test("referral stays outside the event hash, so replays of older events remain idempotent", () => {
    const payload = (referral?: unknown) => ({
      object: "whatsapp_business_account",
      entry: [{ id: "900000000000691", changes: [{ value: {
        metadata: { phone_number_id: "900000000000692", display_phone_number: "+919769000099" },
        messages: [{ id: "wamid.X", from: "919769000001", timestamp: "1757900000", type: "text", text: { body: "Hi" }, ...(referral ? { referral } : {}) }],
      } }] }],
    });
    const plain = normalizeMetaWebhookPayload(payload()).events[0]!;
    const referred = normalizeMetaWebhookPayload(payload({ source_type: "ad", source_id: "123", ctwa_clid: "abc" })).events[0]!;
    assert.equal(plain.eventHash, referred.eventHash);
    assert.equal(referred.kind === "inbound_message" && referred.referral?.source_id, "123");
  });

  test("the SQL keeps host + hash only and never makes ad metadata identity or consent", () => {
    assert.match(MIGRATION, /source_url_hash text/);
    assert.doesNotMatch(MIGRATION, /\bsource_url text\b|\bimage_url text\b/);
    const referralFn = MIGRATION.slice(MIGRATION.indexOf("create or replace function public.record_whatsapp_referral_context"));
    assert.doesNotMatch(referralFn.slice(0, referralFn.indexOf("grant execute")), /consent_events|insert into public\.contacts|insert into public\.leads|assigned_to/);
  });
});

describe("automation worker queue", () => {
  const ENV: WhatsappOutboundServerEnv = {
    mode: "local-test",
    providerCode: "fake",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "service",
    graphApiVersion: "v22.0",
    accessToken: null,
    phoneNumberId: null,
  };
  const claim = (id: string, attempt = 1) => ({
    enrollment_id: id,
    claim_token: `tok-${id}`,
    attempt,
    phone_number_id: "pn",
    recipient_e164: "+919999999999",
    template_name: "tips",
    template_language: "en",
    template_components: [],
  });

  function harness(results: WhatsappProviderDispatchResult[], enrollments = [claim("e1")], testSends: unknown[] = []) {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    let sends = 0;
    const admin: WhatsappCampaignWorkerAdminClient = {
      rpc(fn, args) {
        calls.push({ fn, args });
        if (fn === "claim_whatsapp_campaign_dispatch_jobs" || fn === "materialize_due_whatsapp_campaign_runs") return Promise.resolve({ data: [], error: null });
        if (fn === "claim_whatsapp_campaign_test_sends") return Promise.resolve({ data: testSends, error: null });
        if (fn === WHATSAPP_AUTOMATION_WORKER_RPC.enrollTriggers) return Promise.resolve({ data: [{ automation_id: "a", enrolled: 3 }], error: null });
        if (fn === WHATSAPP_AUTOMATION_WORKER_RPC.claim) return Promise.resolve({ data: enrollments, error: null });
        if (fn === WHATSAPP_AUTOMATION_WORKER_RPC.completeFailure) {
          return Promise.resolve({ data: { outcome: args.p_outcome === "ambiguous" ? "needs_reconcile" : "failed_terminal" }, error: null });
        }
        return Promise.resolve({ data: { ok: true }, error: null });
      },
    };
    const adapter: WhatsappTemplateMessageAdapter = {
      providerCode: "fake",
      dispatchTemplateMessage: () => Promise.resolve(results[sends++ % results.length]!),
    };
    return { calls, sends: () => sends, deps: { getEnv: () => ENV, createAdminClient: () => admin, createAdapter: () => adapter } };
  }

  const AMBIGUOUS: WhatsappProviderDispatchResult = { kind: "ambiguous", code: "timeout", message: "", httpStatus: null, responseSnapshot: {} };
  const SUCCESS: WhatsappProviderDispatchResult = { kind: "success", providerMessageId: "wamid.1", providerTimestamp: "2026-09-15T00:00:00Z", httpStatus: 200, responseSnapshot: {} };

  test("scan → claim → mark before send → ambiguous parks as needs_reconcile, sent once", async () => {
    const h = harness([AMBIGUOUS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.automations.enrolled, 3);
    assert.equal(summary.automations.needsReconcile, 1);
    assert.equal(h.sends(), 1);
    const fns = h.calls.map((c) => c.fn);
    assert.ok(fns.indexOf(WHATSAPP_AUTOMATION_WORKER_RPC.enrollTriggers) < fns.indexOf(WHATSAPP_AUTOMATION_WORKER_RPC.claim));
    assert.ok(fns.indexOf(WHATSAPP_AUTOMATION_WORKER_RPC.markProviderRequestStarted) < fns.indexOf(WHATSAPP_AUTOMATION_WORKER_RPC.completeFailure));
    assert.equal(h.calls.find((c) => c.fn === WHATSAPP_AUTOMATION_WORKER_RPC.completeFailure)?.args.p_enrollment_id, "e1");
  });

  test("a bound automation send completes through the automation success RPC", async () => {
    const h = harness([SUCCESS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.automations.sent, 1);
    assert.ok(h.calls.some((c) => c.fn === WHATSAPP_AUTOMATION_WORKER_RPC.completeSuccess && c.args.p_provider_message_id === "wamid.1"));
  });

  test("internal test sends are one attempt: ambiguous parks, never retried", async () => {
    const test = { test_send_id: "t1", claim_token: "tok", phone_number_id: "pn", recipient_e164: "+919999999999", template_name: "x", template_language: "en", template_components: [] };
    const h = harness([AMBIGUOUS], [], [test]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.testSends.needsReconcile, 1);
    const completion = h.calls.find((c) => c.fn === "complete_whatsapp_campaign_test_send");
    assert.equal(completion?.args.p_outcome, "needs_reconcile");
    assert.ok(h.calls.findIndex((c) => c.fn === "mark_whatsapp_campaign_test_send_started") < h.calls.indexOf(completion!));
  });
});

describe("caller-session actions and pages", () => {
  const cases = [
    { file: "src/features/whatsapp/server/whatsapp-automation-actions.ts", permission: "whatsapp.automations.manage" },
    { file: "src/features/whatsapp/server/whatsapp-flow-actions.ts", permission: "whatsapp.flows.manage" },
  ];
  for (const { file, permission } of cases) {
    test(`${file}: every action authorizes ${permission} before any client or RPC`, () => {
      const src = code(read(file));
      assert.match(src, /^"use server";/m);
      assert.doesNotMatch(src, /supabase-js|serviceRoleKey|SUPABASE_SERVICE_ROLE/);
      const bodies = src.split(/export async function /).slice(1);
      assert.ok(bodies.length >= 2);
      for (const body of bodies) {
        const auth = body.indexOf("resolveWhatsappControlPlaneAccess()");
        const gate = body.indexOf(`permissions["${permission}"]`);
        const client = Math.max(body.indexOf("createClient()"), body.indexOf("performWhatsappFlowProviderAction("));
        assert.ok(auth > -1 && gate > auth && client > gate, body.slice(0, 40));
      }
    });
  }

  test("pages gate on their exact read permission", () => {
    assert.match(code(read("src/app/admin/whatsapp/automations/page.tsx")), /permissions\["whatsapp\.automations\.read"\]/);
    assert.match(code(read("src/app/admin/whatsapp/forms-flows/page.tsx")), /permissions\["whatsapp\.flows\.read"\]/);
  });
});

describe("Kriti is draft-only", () => {
  const kriti = walk("src/features/kriti").filter((file) => !file.includes("/__tests__/"));

  test("no Kriti module reaches a send, approval, automation, Flow, campaign, consent or opt-out path", () => {
    assert.ok(kriti.length > 0);
    for (const file of kriti) {
      const src = code(read(file));
      assert.doesNotMatch(
        src,
        /whatsapp-(automation|flow|campaign|template|settings|contacts|segments)-actions|whatsapp-send-actions|create_whatsapp_\w+_intent|decide_campaign_version|set_whatsapp_automation_status|request_whatsapp_flow_provider_action|record_whatsapp_\w*opt_out|record_whatsapp_marketing_preference|dispatchTemplateMessage|dispatchTextMessage/,
        file
      );
    }
  });

  test("no WM migration grants a Kriti or AI role anything", () => {
    for (const file of readdirSync(join(root, "supabase/migrations")).filter((name) => /^2026091[3-9]\d{6}_whatsapp_/.test(name))) {
      assert.doesNotMatch(read(`supabase/migrations/${file}`), /\('(kriti|ai|assistant)[a-z_]*',/i, file);
    }
  });
});
