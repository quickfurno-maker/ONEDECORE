/**
 * WM-4 — WhatsApp campaign execution runtime/UI.
 *
 * The database half (tables, RPCs, grants, state machine) is owned by
 * supabase/migrations/20260915100000_whatsapp_campaign_execution.sql. This
 * suite proves the application half builds against it: exact RPC names,
 * caller-session actions that authorize before any RPC, a service-role-only
 * bounded worker that parks ambiguity as needs_reconcile, and a Campaigns page
 * that reads the generic campaign approval instead of inventing one.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  availableWhatsappCampaignRunOperations,
  clampWhatsappCampaignWorkerBatch,
  decideWhatsappCampaignCompletion,
  parseWhatsappCampaignClaimedJobs,
  parseWhatsappCampaignPreview,
  parseWhatsappCampaignVersionDetail,
  parseWhatsappCampaignVersionList,
  readWhatsappCampaignButtonBindings,
  readWhatsappCampaignSpecParameters,
  parseWhatsappCampaignScheduledFor,
  parseWhatsappCampaignTestSendPayload,
  presentWhatsappCampaignApproval,
  WHATSAPP_CAMPAIGN_EXECUTION_RPC,
  WHATSAPP_CAMPAIGN_FAILURE_OUTCOMES,
  WHATSAPP_CAMPAIGN_MAX_ATTEMPTS,
  WHATSAPP_CAMPAIGN_PERMISSION_CODES,
  WHATSAPP_CAMPAIGN_ROLE_GRANTS,
  WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION,
  WHATSAPP_CAMPAIGN_WORKER_MAX_BATCH,
  WHATSAPP_CAMPAIGN_WORKER_RPC,
  whatsappTemplateButtonSlots,
} from "../contracts/campaign-execution.ts";
import {
  visibleWhatsappControlPlaneSections,
  WHATSAPP_ADMIN_CAMPAIGNS_PATH,
  WHATSAPP_CONTROL_PLANE_PERMISSION_CODES,
  type WhatsappControlPlanePermissionCode,
  type WhatsappControlPlanePermissions,
} from "../contracts/control-plane.ts";
import { dispatchWhatsappCampaignJobs, type WhatsappCampaignWorkerAdminClient } from "../server/whatsapp-campaign-worker.ts";
import type { WhatsappOutboundServerEnv } from "../server/whatsapp-outbound-env.ts";
import type { WhatsappTemplateMessageAdapter } from "../server/whatsapp-template-provider-adapter.ts";
import type { WhatsappProviderDispatchResult } from "../contracts/provider-dispatch.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const MIGRATION = "supabase/migrations/20260915100000_whatsapp_campaign_execution.sql";
/** WM-4 plus the forward migrations that replaced some of its functions (claims, template gate). */
const migration = [
  MIGRATION,
  "supabase/migrations/20260916100000_whatsapp_control_plane_runtime_hardening.sql",
  "supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql",
]
  .filter((file) => existsSync(join(root, file)))
  .map(read)
  .join("\n");
const generatedTypes = read("src/types/database.generated.ts");

const FILES = {
  contracts: "src/features/whatsapp/contracts/campaign-execution.ts",
  queries: "src/features/whatsapp/server/whatsapp-campaign-queries.ts",
  actions: "src/features/whatsapp/server/whatsapp-campaign-actions.ts",
  worker: "src/features/whatsapp/server/whatsapp-campaign-worker.ts",
  route: "src/app/api/internal/whatsapp-campaign-execution/dispatch/route.ts",
  page: "src/app/admin/whatsapp/campaigns/page.tsx",
  forms: "src/features/whatsapp/components/campaigns/CampaignExecutionForms.tsx",
};

function permissionsFor(codes: readonly WhatsappControlPlanePermissionCode[]): WhatsappControlPlanePermissions {
  return Object.fromEntries(WHATSAPP_CONTROL_PLANE_PERMISSION_CODES.map((c) => [c, codes.includes(c)])) as WhatsappControlPlanePermissions;
}

function campaignPerms(role: string) {
  const granted = WHATSAPP_CAMPAIGN_ROLE_GRANTS[role] ?? [];
  return Object.fromEntries(WHATSAPP_CAMPAIGN_PERMISSION_CODES.map((c) => [c, granted.includes(c)])) as Record<
    (typeof WHATSAPP_CAMPAIGN_PERMISSION_CODES)[number],
    boolean
  >;
}

describe("WM-4 deliverables exist", () => {
  for (const [name, path] of Object.entries(FILES)) {
    test(`${name}: ${path}`, () => assert.ok(existsSync(join(root, path)), path));
  }
});

describe("WM-4 RPC names are exactly the migrated ones", () => {
  const all = [...Object.values(WHATSAPP_CAMPAIGN_EXECUTION_RPC), ...Object.values(WHATSAPP_CAMPAIGN_WORKER_RPC)];
  for (const rpc of all) {
    test(`${rpc} is in database.generated.ts`, () => {
      assert.match(generatedTypes, new RegExp(`\\b${rpc}: \\{`));
    });
  }

  test("caller-session RPC set is exactly the visibility-scoped WM-4/WM-5 staff surface", () => {
    assert.deepEqual(Object.values(WHATSAPP_CAMPAIGN_EXECUTION_RPC).sort(), [
      "cancel_whatsapp_campaign_run",
      "create_whatsapp_campaign_run",
      "create_whatsapp_campaign_test_send",
      "get_whatsapp_campaign_run_breakdown",
      "get_whatsapp_campaign_version",
      "list_whatsapp_campaign_scheduler_runs",
      "list_whatsapp_campaign_template_options",
      "list_whatsapp_campaign_test_destinations",
      "list_whatsapp_campaign_versions",
      "list_whatsapp_click_destinations",
      "pause_whatsapp_campaign_run",
      "preview_whatsapp_campaign_audience",
      "reschedule_whatsapp_campaign_run",
      "resolve_whatsapp_campaign_reconcile",
      "resume_whatsapp_campaign_run",
      "save_whatsapp_campaign_spec",
      "set_whatsapp_campaign_spec_button_bindings",
      "start_whatsapp_campaign_run",
    ]);
  });

  test("no RPC name the database does not have (the stale materialize_whatsapp_campaign_run is gone)", () => {
    assert.doesNotMatch(generatedTypes, /\bmaterialize_whatsapp_campaign_run: \{/);
    assert.ok(!(Object.values(WHATSAPP_CAMPAIGN_EXECUTION_RPC) as string[]).includes("materialize_whatsapp_campaign_run"));
  });
});

describe("WM-4 permission model", () => {
  test("execute + test_send: Super Admin and Sales Manager; cancel: Super Admin only", () => {
    assert.deepEqual([...WHATSAPP_CAMPAIGN_ROLE_GRANTS.super_admin!].sort(), [...WHATSAPP_CAMPAIGN_PERMISSION_CODES].sort());
    assert.deepEqual([...WHATSAPP_CAMPAIGN_ROLE_GRANTS.sales_manager!].sort(), [
      "whatsapp.campaigns.execute",
      "whatsapp.campaigns.test_send",
    ]);
    assert.deepEqual(WHATSAPP_CAMPAIGN_ROLE_GRANTS.sales_executive, []);
  });

  test("migration grants match the mirror when present", { skip: migration === "" }, () => {
    for (const permission of WHATSAPP_CAMPAIGN_PERMISSION_CODES) {
      assert.ok(migration.includes(permission), permission);
      assert.ok(!new RegExp(`\\('sales_executive'\\s*,\\s*'${permission.replace(/\./g, "\\.")}'\\)`).test(migration));
      assert.ok(!new RegExp(`\\('(management|sales)'\\s*,\\s*'${permission.replace(/\./g, "\\.")}'\\)`).test(migration));
    }
    assert.ok(!/\('sales_manager'\s*,\s*'whatsapp\.campaigns\.cancel'\)/.test(migration));
  });

  test("cancel is the only operation that needs cancel", () => {
    for (const [op, permission] of Object.entries(WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION)) {
      assert.equal(permission, op === "cancel" ? "whatsapp.campaigns.cancel" : "whatsapp.campaigns.execute");
    }
  });

  test("lifecycle buttons follow role", () => {
    assert.deepEqual(availableWhatsappCampaignRunOperations("scheduled", campaignPerms("super_admin")), ["start", "cancel"]);
    assert.deepEqual(availableWhatsappCampaignRunOperations("scheduled", campaignPerms("sales_manager")), ["start"]);
    assert.deepEqual(availableWhatsappCampaignRunOperations("dispatching", campaignPerms("super_admin")), ["pause", "cancel"]);
    assert.deepEqual(availableWhatsappCampaignRunOperations("dispatching", campaignPerms("sales_manager")), ["pause"]);
    assert.deepEqual(availableWhatsappCampaignRunOperations("paused", campaignPerms("sales_manager")), ["resume"]);
    assert.deepEqual(availableWhatsappCampaignRunOperations("dispatching", campaignPerms("sales_executive")), []);
    assert.deepEqual(availableWhatsappCampaignRunOperations("reconciling", campaignPerms("super_admin")), []);
    assert.deepEqual(availableWhatsappCampaignRunOperations("completed", campaignPerms("super_admin")), []);
  });

  test("Campaigns nav appears only with whatsapp.campaigns.execute", () => {
    const withCampaigns = visibleWhatsappControlPlaneSections(permissionsFor(["whatsapp.campaigns.execute"]));
    assert.deepEqual(
      withCampaigns.map((s) => s.key),
      ["campaigns", "scheduler"]
    );
    assert.equal(withCampaigns[0]!.href, WHATSAPP_ADMIN_CAMPAIGNS_PATH);
    assert.equal(
      visibleWhatsappControlPlaneSections(permissionsFor(["whatsapp.campaigns.test_send"])).some((s) => s.key === "campaigns"),
      false
    );
  });
});

describe("WM-4 caller-session actions authorize before any RPC", () => {
  const actions = code(read(FILES.actions));
  const bodies = actions.split(/export async function /).slice(1);

  test("seven actions, each server-only and caller-session", () => {
    assert.match(actions, /^"use server";/m);
    assert.match(actions, /import "server-only"/);
    assert.match(actions, /from "@\/lib\/supabase\/server"/);
    assert.ok(!/supabase-js|serviceRoleKey|SUPABASE_SERVICE_ROLE/.test(actions));
    assert.equal(bodies.length, 7);
  });

  for (const body of bodies) {
    const name = body.slice(0, body.indexOf("("));
    test(`${name}: permission check precedes createClient and rpc`, () => {
      const auth = body.indexOf("resolveWhatsappControlPlaneAccess()");
      const client = body.indexOf("createClient()");
      const rpc = body.indexOf(".rpc(");
      assert.ok(auth > -1 && client > auth && rpc > auth, name);
      assert.match(body, /permissions\[/);
    });
  }

  test("spec needs generic campaigns.draft; reconcile needs cancel; test send test_send; no approval write", () => {
    assert.match(actions, /permissions\["campaigns\.draft"\]/);
    assert.match(actions, /permissions\["whatsapp\.campaigns\.cancel"\]/);
    assert.doesNotMatch(actions, /p_template_parameters/);
    assert.match(actions, /permissions\["whatsapp\.campaigns\.test_send"\]/);
    assert.match(actions, /WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION\[operation\]/);
    assert.ok(!/campaign_approvals|approve_campaign|record_campaign_approval/.test(actions));
    assert.ok(!/bulk/i.test(actions));
  });

  test("queries use the caller session only", () => {
    const queries = code(read(FILES.queries));
    assert.match(queries, /from "@\/lib\/supabase\/server"/);
    assert.ok(!/supabase-js|serviceRoleKey/.test(queries));
    assert.doesNotMatch(queries, /from\("campaign_versions"\)|from\("campaign_approvals"\)|from\("whatsapp_template_snapshots"\)/);
    assert.match(queries, /WHATSAPP_CAMPAIGN_EXECUTION_RPC\.listVersions/);
    assert.match(queries, /WHATSAPP_CAMPAIGN_EXECUTION_RPC\.getVersion/);
  });
});

describe("WM-4 page", () => {
  const page = code(read(FILES.page));
  const forms = code(read(FILES.forms));

  test("gates on whatsapp.campaigns.execute and exposes spec/preview/test/run lifecycle", () => {
    assert.match(page, /permissions\["whatsapp\.campaigns\.execute"\]/);
    assert.match(page, /permissions\["whatsapp\.campaigns\.test_send"\]/);
    for (const part of ["CampaignSpecForm", "CampaignButtonBindingsForm", "CampaignTestSendForm", "CampaignCreateRunForm", "CampaignRunControls", "CampaignReconcileForm"]) {
      assert.ok(page.includes(part), part);
    }
    assert.match(page, /previewWhatsappCampaignAudienceForCurrentUser/);
    assert.match(forms, /datetime-local/);
    assert.match(forms, /scheduledFor/);
  });

  test("reads the generic approval, never records one", () => {
    assert.match(page, /presentWhatsappCampaignApproval/);
    assert.ok(!/approveCampaign|campaign_approvals|decide_campaign_version/.test(page + forms));
    assert.match(page, /operatorDenial/);
    assert.deepEqual(presentWhatsappCampaignApproval("approved"), { label: "Approved", tone: "positive", approved: true });
    assert.equal(presentWhatsappCampaignApproval(null).approved, false);
  });
});

describe("WM-4 internal worker route", () => {
  const route = code(read(FILES.route));
  test("uses the campaign execution worker secret with a constant-time compare", () => {
    assert.match(route, /getCampaignExecutionWorkerSecret/);
    assert.match(route, /timingSafeEqual/);
    assert.match(route, /Bearer /);
    assert.match(route, /clampWhatsappCampaignWorkerBatch/);
    assert.match(route, /dispatchWhatsappCampaignJobs/);
  });

  test("worker module is service role and server-only", () => {
    const worker = code(read(FILES.worker));
    assert.match(worker, /import "server-only"/);
    assert.match(worker, /serviceRoleKey/);
    assert.ok(!/@\/lib\/supabase\/server/.test(worker));
    assert.match(worker, /createMetaWhatsappTemplateMessageAdapter/);
  });
});

describe("WM-4 contracts", () => {
  test("batch bounded to 50, attempts to 3", () => {
    assert.equal(WHATSAPP_CAMPAIGN_WORKER_MAX_BATCH, 50);
    assert.equal(WHATSAPP_CAMPAIGN_MAX_ATTEMPTS, 3);
    assert.equal(clampWhatsappCampaignWorkerBatch(500), 50);
    assert.equal(clampWhatsappCampaignWorkerBatch(0), 25);
    assert.equal(clampWhatsappCampaignWorkerBatch("7"), 7);
  });

  test("ambiguous stays ambiguous regardless of attempt; transient retries only under 3", () => {
    assert.deepEqual(decideWhatsappCampaignCompletion({ kind: "ambiguous", code: "timeout" }, 1), {
      rpc: "failure",
      outcome: "ambiguous",
      errorCode: "timeout",
    });
    const outcome = (r: ReturnType<typeof decideWhatsappCampaignCompletion>) => (r as { outcome: string }).outcome;
    assert.equal(outcome(decideWhatsappCampaignCompletion({ kind: "failed", errorClass: "transient", code: "x" }, 2)), "transient");
    assert.equal(outcome(decideWhatsappCampaignCompletion({ kind: "failed", errorClass: "transient", code: "x" }, 3)), "terminal");
    assert.equal(outcome(decideWhatsappCampaignCompletion({ kind: "failed", errorClass: "terminal", code: "x" }, 1)), "terminal");
  });

  test("failure outcomes are exactly the migration's accepted set", { skip: migration === "" }, () => {
    const accepted = migration.match(/p_outcome not in \(([^)]*)\) or p_error_code/);
    assert.ok(accepted, "failure outcome check present");
    assert.deepEqual(
      accepted[1]!.split(",").map((v) => v.trim().replace(/'/g, "")).sort(),
      [...WHATSAPP_CAMPAIGN_FAILURE_OUTCOMES].sort()
    );
    assert.match(migration, /p_outcome='ambiguous' then \w+:='needs_reconcile'/);
    assert.match(migration, /p_outcome='transient' and j\.attempt_count<3/);
    assert.match(migration, /private\.whatsapp_mint_button_components\(snap\.components,s\.button_bindings,'campaign'/);
    assert.match(migration, /least\(coalesce\(p_batch_size,20\),50\)/);
  });

  test("claim payload keys the parser reads are the ones SQL builds", { skip: migration === "" }, () => {
    for (const key of ["job_id", "claim_token", "attempt", "phone_number_id", "recipient_e164", "template_name", "template_language", "template_components"]) {
      assert.ok(migration.includes(`'${key}',`), key);
    }
  });

  test("claimed jobs parse from array or {jobs}, bounded to 50", () => {
    const job = { job_id: "j1", claim_token: "t1", attempt: 1, phone_number_id: "p", recipient_e164: "+911", template_name: "n", template_language: "en", template_components: [] };
    assert.equal(parseWhatsappCampaignClaimedJobs([job]).length, 1);
    assert.equal(parseWhatsappCampaignClaimedJobs({ jobs: [job] }).length, 1);
    assert.equal(parseWhatsappCampaignClaimedJobs({ jobs: Array.from({ length: 80 }, () => job) }).length, 50);
    assert.equal(parseWhatsappCampaignClaimedJobs([{ job_id: "j1" }]).length, 0);
  });

  test("caller inputs", () => {
    const form: [string, string][] = [
      ["param:body:1", "ignored because bound"],
      ["bind:body:1", "contact_first_name"],
      ["param:body:2", " Diwali "],
      ["bind:body:2", ""],
      ["bind:body:3", "contact_phone"],
      ["param:footer:1", "not a component"],
      ["param:header:x;drop", "bad key"],
    ];
    assert.deepEqual(readWhatsappCampaignSpecParameters(form), {
      defaults: { body: { "2": "Diwali" } },
      bindings: { body: { "1": "contact_first_name" } },
    });
    const slots = whatsappTemplateButtonSlots([
      { type: "BODY", text: "Hi" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Stop promotions" },
          { type: "URL", text: "See", url: "https://onedecore.in/w/c/{{1}}" },
          { type: "FLOW", text: "Book", flow_id: "123" },
        ],
      },
    ]);
    assert.deepEqual(slots.map((slot) => [slot.index, slot.kind]), [[1, "url"], [2, "flow"]]);
    const uuid = "11111111-1111-4111-8111-111111111111";
    assert.deepEqual(readWhatsappCampaignButtonBindings([["button:1", uuid], ["button:2", uuid], ["button:0", uuid], ["button:1x", uuid]], slots), {
      "1": { kind: "click_destination", destination_id: uuid },
      "2": { kind: "flow", flow_id: uuid },
    });
    const now = new Date("2026-09-15T00:00:00Z");
    assert.deepEqual(parseWhatsappCampaignScheduledFor("", now), { ok: true, value: null });
    assert.equal(parseWhatsappCampaignScheduledFor("2026-09-14T00:00:00Z", now).ok, false);
    assert.equal(parseWhatsappCampaignScheduledFor("2026-09-16T00:00:00Z", now).ok, true);
    assert.equal(parseWhatsappCampaignPreview({ eligible: 3 }), null);
    const preview = parseWhatsappCampaignPreview({
      total_matched: 8,
      eligible: 2,
      reasons: { frequency_capped: 1, contact_do_not_contact: 5 },
      button_bindings_problem: "button_binding_missing",
    });
    assert.deepEqual(preview?.reasons, [
      { code: "contact_do_not_contact", count: 5 },
      { code: "frequency_capped", count: 1 },
    ]);
    assert.equal(preview?.buttonBindingsProblem, "button_binding_missing");
    assert.equal(parseWhatsappCampaignVersionDetail({ campaign: { id: "c" } }), null);
    assert.equal(
      parseWhatsappCampaignVersionList([{ version_id: "v", campaign_id: "c", status: "approved", latest_run: { id: "r", status: "dispatching" } }])[0]?.latestRun?.status,
      "dispatching"
    );
    assert.deepEqual(parseWhatsappCampaignTestSendPayload({ test_send_id: "t", outcome: "pending" }), {
      testSendId: "t",
      outcome: "pending",
    });
    assert.equal(parseWhatsappCampaignTestSendPayload({}), null);
  });
});

/* ------------------------------------------------------------------ */
/* Worker behaviour against a fake service client and fake adapter     */
/* ------------------------------------------------------------------ */

const ENV: WhatsappOutboundServerEnv = {
  mode: "local-test",
  providerCode: "fake",
  supabaseUrl: "http://127.0.0.1:54321",
  serviceRoleKey: "service",
  graphApiVersion: "v22.0",
  accessToken: null,
  phoneNumberId: null,
};

function job(id: string, attempt = 1) {
  return {
    job_id: id,
    claim_token: `tok-${id}`,
    attempt,
    phone_number_id: "pn",
    recipient_e164: "+919999999999",
    template_name: "offer",
    template_language: "en",
    template_components: [],
  };
}

/** Mirrors complete_whatsapp_campaign_dispatch_failure's decision for the fake. */
function sqlFailureReply(args: Record<string, unknown>, attempts: Map<string, number>) {
  const attempt = attempts.get(String(args.p_job_id)) ?? 1;
  if (args.p_outcome === "ambiguous") return { outcome: "needs_reconcile", state: "needs_reconcile" };
  if (args.p_outcome === "transient" && attempt < 3) return { outcome: "retry_scheduled", state: "pending" };
  return { outcome: "failed_terminal", state: "failed" };
}

function harness(
  jobs: ReturnType<typeof job>[],
  results: WhatsappProviderDispatchResult[],
  opts: { failSuccessBind?: boolean; failMark?: boolean } = {}
) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const attempts = new Map(jobs.map((j) => [j.job_id, j.attempt]));
  let sends = 0;
  const admin: WhatsappCampaignWorkerAdminClient = {
    rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === WHATSAPP_CAMPAIGN_WORKER_RPC.materializeDueRuns) return Promise.resolve({ data: [], error: null });
      if (fn === WHATSAPP_CAMPAIGN_WORKER_RPC.claimJobs) return Promise.resolve({ data: jobs, error: null });
      if (fn === WHATSAPP_CAMPAIGN_WORKER_RPC.markProviderRequestStarted) {
        return Promise.resolve(
          opts.failMark
            ? { data: null, error: { message: "WHATSAPP_CAMPAIGN_JOB_NOT_CLAIMED", code: "P0002" } }
            : { data: { job_id: args.p_job_id, provider_request_started: true }, error: null }
        );
      }
      if (fn === WHATSAPP_CAMPAIGN_WORKER_RPC.completeSuccess && opts.failSuccessBind) {
        return Promise.resolve({ data: null, error: { message: "lost" } });
      }
      if (fn === WHATSAPP_CAMPAIGN_WORKER_RPC.completeFailure) {
        return Promise.resolve({ data: sqlFailureReply(args, attempts), error: null });
      }
      return Promise.resolve({ data: { outcome: "succeeded" }, error: null });
    },
  };
  const adapter: WhatsappTemplateMessageAdapter = {
    providerCode: "fake",
    dispatchTemplateMessage: () => Promise.resolve(results[sends++ % results.length]!),
  };
  return {
    calls,
    sends: () => sends,
    deps: { getEnv: () => ENV, createAdminClient: () => admin, createAdapter: () => adapter },
  };
}

const SUCCESS: WhatsappProviderDispatchResult = {
  kind: "success",
  providerMessageId: "wamid.1",
  providerTimestamp: "2026-09-15T00:00:00Z",
  httpStatus: 200,
  responseSnapshot: {},
};
const AMBIGUOUS: WhatsappProviderDispatchResult = { kind: "ambiguous", code: "timeout", message: "", httpStatus: null, responseSnapshot: {} };
const TRANSIENT: WhatsappProviderDispatchResult = {
  kind: "failed",
  errorClass: "transient",
  code: "rate",
  message: "",
  httpStatus: 429,
  responseSnapshot: {},
};

describe("WM-4 worker", () => {
  test("disabled mode never touches the database or provider", async () => {
    const h = harness([job("a")], [SUCCESS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, { ...h.deps, getEnv: () => ({ ...ENV, mode: "disabled" }) });
    assert.equal(summary.mode, "disabled");
    assert.equal(h.calls.length, 0);
    assert.equal(h.sends(), 0);
  });

  test("materialize → claim (bounded to 50) → mark before send → success", async () => {
    const h = harness([job("a")], [SUCCESS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t", maxBatch: 999 }, h.deps);
    assert.equal(summary.sent, 1);
    assert.deepEqual(
      h.calls.map((c) => c.fn).slice(0, 4),
      [
        "materialize_due_whatsapp_campaign_runs",
        "claim_whatsapp_campaign_dispatch_jobs",
        "mark_whatsapp_campaign_provider_request_started",
        "complete_whatsapp_campaign_dispatch_success",
      ]
    );
    assert.equal(h.calls[1]!.args.p_batch_size, 50);
    assert.equal(h.calls[3]!.args.p_claim_token, "tok-a");
  });

  test("never claims more than 50 even if more come back", async () => {
    const h = harness(Array.from({ length: 70 }, (_, i) => job(`j${i}`)), [SUCCESS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t", maxBatch: 50 }, h.deps);
    assert.equal(summary.claimed, 50);
    assert.equal(h.sends(), 50);
  });

  test("ambiguous provider result completes as needs_reconcile, sent once, no retry", async () => {
    const h = harness([job("a")], [AMBIGUOUS]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.needsReconcile, 1);
    assert.equal(summary.retryScheduled, 0);
    const failure = h.calls.find((c) => c.fn === WHATSAPP_CAMPAIGN_WORKER_RPC.completeFailure);
    assert.equal(failure?.args.p_outcome, "ambiguous");
    assert.equal(h.sends(), 1);
  });

  test("success that cannot be bound is parked as ambiguous → needs_reconcile", async () => {
    const h = harness([job("a")], [SUCCESS], { failSuccessBind: true });
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.needsReconcile, 1);
    const failure = h.calls.findLast((c) => c.fn === WHATSAPP_CAMPAIGN_WORKER_RPC.completeFailure);
    assert.equal(failure?.args.p_outcome, "ambiguous");
    assert.equal(failure?.args.p_error_code, "local_bind_failed");
  });

  test("transient: retry under 3 attempts, terminal at 3, no provider call past 3", async () => {
    const h = harness([job("a", 1), job("b", 3), job("c", 4)], [TRANSIENT]);
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.retryScheduled, 1);
    assert.equal(summary.failed, 2);
    assert.equal(h.sends(), 2);
    const outcomes = h.calls.filter((c) => c.fn === WHATSAPP_CAMPAIGN_WORKER_RPC.completeFailure).map((c) => c.args.p_outcome);
    assert.deepEqual(outcomes, ["transient", "terminal", "terminal"]);
  });

  test("if provider_request_started cannot be recorded, nothing is sent or completed", async () => {
    const h = harness([job("a")], [SUCCESS], { failMark: true });
    const summary = await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    assert.equal(summary.skipped, 1);
    assert.equal(h.sends(), 0);
    assert.ok(!h.calls.some((c) => c.fn.startsWith("complete_")));
  });

  test("every completion follows a provider-start mark (SQL requires it)", async () => {
    const h = harness([job("a", 1), job("b", 4)], [TRANSIENT]);
    await dispatchWhatsappCampaignJobs({ workerId: "t" }, h.deps);
    for (const id of ["a", "b"]) {
      const mark = h.calls.findIndex((c) => c.fn === WHATSAPP_CAMPAIGN_WORKER_RPC.markProviderRequestStarted && c.args.p_job_id === id);
      const done = h.calls.findIndex((c) => c.fn.startsWith("complete_") && c.args.p_job_id === id);
      assert.ok(mark > -1 && done > mark, id);
    }
  });
});
