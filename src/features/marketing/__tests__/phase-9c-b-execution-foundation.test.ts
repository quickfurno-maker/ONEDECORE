/**
 * Phase 9C-B — campaign execution foundation (mock only).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CAMPAIGN_RUN_STATES,
  validateCampaignRunTransition,
  canRequestPause,
  canRequestResume,
  canRequestCancel,
} from "../execution/contracts/run-lifecycle.ts";
import {
  resolvePaidAdsExecutionChannel,
  describeDeferredChannels,
  MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS,
} from "../execution/domain/paid-channel.ts";
import { resolveCampaignExecutionCapabilities, visibleRunControls } from "../execution/domain/execution-capabilities.ts";
import { canShareProviderCustomerData } from "../execution/domain/provider-data-sharing.ts";
import { MockCampaignExecutionProvider } from "../execution/server/mock-provider.ts";
import { resolveCampaignExecutionProvider } from "../execution/server/provider-factory.ts";
import { dispatchCampaignRunOperations, reconcileCampaignRunOperation, type CampaignExecutionAdmin } from "../execution/server/dispatcher.ts";
import { executeAuthorizedManualMockDispatch } from "../execution/server/manual-dispatch.ts";
import { evaluateManualCampaignDispatchAuth } from "../execution/domain/manual-dispatch-auth.ts";
import {
  signCampaignExecutionContext,
  verifyCampaignExecutionContext,
  buildCanonicalCampaignExecutionContextPayload,
  rejectUnsignedRunGuess,
  type CampaignExecutionContext,
} from "../execution/server/execution-context-crypto.ts";
import {
  getCampaignExecutionMode,
  getCampaignExecutionHmacSecret,
} from "../execution/server/execution-env.ts";
import {
  CAMPAIGN_PRODUCTION_GATE_OFF,
  CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE,
} from "../execution/server/provider-factory.ts";

const root = process.cwd();
const hmacSecret = "phase-9c-b-execution-hmac-secret-32chars";

function sampleContext(overrides: Partial<CampaignExecutionContext> = {}): CampaignExecutionContext {
  return {
    version: 1,
    runReference: "OD-CR-2026-000001",
    runTargetReference: "OD-CRT-2026-000001",
    providerChannel: "meta_ads",
    campaignReference: "OD-C-2026-000001",
    campaignVersionNumber: 1,
    landingPublicationReference: "OD-LP-2026-000001",
    issuedAt: "2026-08-19T00:00:00.000Z",
    expiresAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

const mockCommand = {
  operationType: "create" as const,
  operationKey: "create:OD-CR-2026-000001",
  providerChannel: "meta_ads" as const,
  runReference: "OD-CR-2026-000001",
  runTargetReference: "OD-CRT-2026-000001",
  boundProviderCampaignId: null,
};

describe("Phase 9C-B run lifecycle", () => {
  test("canonical states include scheduled running paused completed failed cancelled", () => {
    assert.deepEqual([...CAMPAIGN_RUN_STATES], [
      "scheduled",
      "running",
      "paused",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  test("valid and invalid transitions", () => {
    assert.equal(validateCampaignRunTransition("scheduled", "running").allowed, true);
    assert.equal(validateCampaignRunTransition("running", "paused").allowed, true);
    assert.equal(validateCampaignRunTransition("paused", "running").allowed, true);
    assert.equal(validateCampaignRunTransition("running", "completed").allowed, true);
    assert.equal(validateCampaignRunTransition("completed", "running").allowed, false);
    assert.equal(validateCampaignRunTransition("cancelled", "running").allowed, false);
    assert.equal(validateCampaignRunTransition("scheduled", "paused").allowed, false);
  });

  test("pause resume cancel guards", () => {
    assert.equal(canRequestPause("running"), true);
    assert.equal(canRequestPause("scheduled"), false);
    assert.equal(canRequestResume("paused"), true);
    assert.equal(canRequestCancel("completed"), false);
  });
});

describe("Phase 9C-B OD9C-A paid channel", () => {
  test("single ads channel plus deferred email", () => {
    const result = resolvePaidAdsExecutionChannel(["meta_ads", "email"]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.providerChannel, "meta_ads");
      assert.deepEqual([...result.deferredChannels], ["email"]);
    }
    assert.match(describeDeferredChannels(["email"]), /NOT EXECUTED/);
  });

  test("both Meta and Google fail closed", () => {
    const result = resolvePaidAdsExecutionChannel(["meta_ads", "google_ads"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS);
    }
  });

  test("provider mismatch is not invented as a split", () => {
    const result = resolvePaidAdsExecutionChannel(["google_ads"]);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.providerChannel, "google_ads");
  });
});

describe("Phase 9C-B mock provider", () => {
  test("deterministic success with zero network", async () => {
    const provider = new MockCampaignExecutionProvider("success");
    const result = await provider.create(mockCommand);
    assert.equal(result.kind, "success");
    assert.equal(provider.networkRequestCount, 0);
  });

  test("transient validation timeout and reconcile", async () => {
    assert.equal((await new MockCampaignExecutionProvider("transient_failure").create(mockCommand)).kind, "transient_failure");
    assert.equal((await new MockCampaignExecutionProvider("validation_failure").create(mockCommand)).kind, "validation_failure");
    assert.equal((await new MockCampaignExecutionProvider("timeout_unknown").create(mockCommand)).kind, "timeout_unknown");
    assert.equal((await new MockCampaignExecutionProvider("reconcile_found").getStatus(mockCommand)).kind, "found");
    assert.equal((await new MockCampaignExecutionProvider("reconcile_not_found").getStatus(mockCommand)).kind, "not_found");
  });
});

describe("Phase 9C-B execution mode factory", () => {
  test("default disabled", () => {
    assert.equal(getCampaignExecutionMode({}), "disabled");
  });

  test("mock allowed, sandbox and live fail closed", () => {
    assert.equal(resolveCampaignExecutionProvider({ ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock" }).ok, true);
    const sandbox = resolveCampaignExecutionProvider({ ONEDECORE_CAMPAIGN_EXECUTION_MODE: "sandbox" });
    const live = resolveCampaignExecutionProvider({ ONEDECORE_CAMPAIGN_EXECUTION_MODE: "live" });
    assert.equal(sandbox.ok, false);
    assert.equal(live.ok, false);
    if (!sandbox.ok) assert.equal(sandbox.code, CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE);
    if (!live.ok) assert.equal(live.code, CAMPAIGN_PRODUCTION_GATE_OFF);
  });
});

function fakeAdmin(claim: Record<string, unknown>): CampaignExecutionAdmin {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let claimed = false;
  const admin = {
    rpcCalls,
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === "claim_campaign_run_operation") {
        if (claimed) return { data: { outcome_code: "none" }, error: null };
        claimed = true;
        return { data: claim, error: null };
      }
      return { data: { outcome_code: "ok" }, error: null };
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: {
                      run_reference: "OD-CR-2026-000001",
                      provider_channel: "meta_ads",
                      run_target_reference: "OD-CRT-2026-000001",
                      provider_campaign_id: null,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return admin as unknown as CampaignExecutionAdmin;
}

describe("Phase 9C-B dispatcher", () => {
  test("disabled does nothing", async () => {
    const result = await dispatchCampaignRunOperations({
      env: { ONEDECORE_CAMPAIGN_EXECUTION_MODE: "disabled" },
    });
    assert.equal(result.processed, 0);
    assert.equal(result.code, "CAMPAIGN_EXECUTION_DISABLED");
  });

  test("live and sandbox fail closed without mock fallback", async () => {
    const live = await dispatchCampaignRunOperations({
      env: { ONEDECORE_CAMPAIGN_EXECUTION_MODE: "live" },
    });
    assert.equal(live.processed, 0);
    assert.equal(live.code, CAMPAIGN_PRODUCTION_GATE_OFF);
  });

  test("mock success completes", async () => {
    const admin = fakeAdmin({
      outcome_code: "claimed",
      operation_id: "11111111-1111-1111-1111-111111111111",
      campaign_run_id: "22222222-2222-2222-2222-222222222222",
      campaign_run_target_id: "33333333-3333-3333-3333-333333333333",
      operation_type: "create",
      operation_key: "create:OD-CR-2026-000001",
    });
    const result = await dispatchCampaignRunOperations({
      env: { ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock" },
      admin,
      maxBatch: 2,
    });
    assert.equal(result.processed, 1);
    assert.deepEqual([...result.outcomes], ["succeeded"]);
  });

  test("mock retry and needs_reconcile", async () => {
    const retryAdmin = fakeAdmin({
      outcome_code: "claimed",
      operation_id: "11111111-1111-1111-1111-111111111111",
      campaign_run_id: "22222222-2222-2222-2222-222222222222",
      campaign_run_target_id: "33333333-3333-3333-3333-333333333333",
      operation_type: "create",
      operation_key: "create:OD-CR-2026-000001",
    });
    const retry = await dispatchCampaignRunOperations({
      env: {
        ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock",
        ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO: "transient_failure",
      },
      admin: retryAdmin,
    });
    assert.deepEqual([...retry.outcomes], ["retry"]);

    const timeoutAdmin = fakeAdmin({
      outcome_code: "claimed",
      operation_id: "11111111-1111-1111-1111-111111111111",
      campaign_run_id: "22222222-2222-2222-2222-222222222222",
      campaign_run_target_id: "33333333-3333-3333-3333-333333333333",
      operation_type: "create",
      operation_key: "create:OD-CR-2026-000001",
    });
    const timeout = await dispatchCampaignRunOperations({
      env: {
        ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock",
        ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO: "timeout_unknown",
      },
      admin: timeoutAdmin,
    });
    assert.deepEqual([...timeout.outcomes], ["needs_reconcile"]);
  });
});

describe("Phase 9C-B reconcile and manual dispatch auth", () => {
  test("reconcile_found calls resolution RPC not ordinary bind", async () => {
    const rpcCalls: Array<{ name: string }> = [];
    const admin = {
      async rpc(name: string) {
        rpcCalls.push({ name });
        if (name === "get_campaign_run_operation_for_reconcile") {
          return {
            data: {
              outcome_code: "found",
              operation_type: "create",
              operation_key: "create:OD-CR-2026-000001",
              provider_channel: "meta_ads",
              run_reference: "OD-CR-2026-000001",
              run_target_reference: "OD-CRT-2026-000001",
              provider_campaign_id: null,
            },
            error: null,
          };
        }
        if (name === "bind_campaign_run_operation") {
          throw new Error("ordinary bind must not be used for reconcile_found");
        }
        return { data: { outcome_code: "reconcile_found" }, error: null };
      },
    } as unknown as CampaignExecutionAdmin;

    const outcome = await reconcileCampaignRunOperation("11111111-1111-1111-1111-111111111111", {
      env: {
        ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock",
        ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO: "reconcile_found",
      },
      admin,
    });
    assert.equal(outcome, "reconcile_found");
    assert.equal(rpcCalls.some((c) => c.name === "resolve_campaign_run_create_reconcile_found"), true);
    assert.equal(rpcCalls.some((c) => c.name === "bind_campaign_run_operation"), false);
  });

  test("reconcile_not_found leaves unresolved and does not recreate", async () => {
    const rpcCalls: Array<{ name: string }> = [];
    const admin = {
      async rpc(name: string) {
        rpcCalls.push({ name });
        if (name === "get_campaign_run_operation_for_reconcile") {
          return {
            data: {
              outcome_code: "found",
              operation_type: "create",
              operation_key: "create:OD-CR-2026-000001",
              provider_channel: "meta_ads",
              run_reference: "OD-CR-2026-000001",
              run_target_reference: "OD-CRT-2026-000001",
              provider_campaign_id: null,
            },
            error: null,
          };
        }
        return { data: { outcome_code: "ok" }, error: null };
      },
    } as unknown as CampaignExecutionAdmin;

    const outcome = await reconcileCampaignRunOperation("11111111-1111-1111-1111-111111111111", {
      env: {
        ONEDECORE_CAMPAIGN_EXECUTION_MODE: "mock",
        ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO: "reconcile_not_found",
      },
      admin,
    });
    assert.equal(outcome, "reconcile_not_found");
    assert.equal(rpcCalls.some((c) => c.name === "resolve_campaign_run_create_reconcile_found"), false);
    assert.equal(rpcCalls.some((c) => c.name === "bind_campaign_run_operation"), false);
    assert.equal(rpcCalls.some((c) => c.name === "claim_campaign_run_operation"), false);
  });

  test("unauthorized manual dispatch is denied before service-role work", async () => {
    let dispatched = false;
    const result = await executeAuthorizedManualMockDispatch({
      authorize: async () => ({
        ok: false,
        code: "CAMPAIGN_UNAUTHORIZED",
        message: "denied",
      }),
      getMode: () => "mock",
      dispatch: async () => {
        dispatched = true;
        return { mode: "mock", processed: 1, outcomes: ["succeeded"] };
      },
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "CAMPAIGN_UNAUTHORIZED");
    assert.equal(dispatched, false);
  });

  test("SA/SM authorization is accepted for manual dispatch", async () => {
    assert.equal(
      evaluateManualCampaignDispatchAuth({
        hasActiveStaffSession: true,
        canExecuteCampaigns: true,
      }).ok,
      true
    );
    let dispatched = false;
    const result = await executeAuthorizedManualMockDispatch({
      authorize: async () => ({ ok: true }),
      getMode: () => "mock",
      dispatch: async () => {
        dispatched = true;
        return { mode: "mock", processed: 1, outcomes: ["succeeded"] };
      },
    });
    assert.equal(result.success, true);
    assert.equal(dispatched, true);
  });

  test("sales executive and unauthenticated are denied", () => {
    assert.equal(
      evaluateManualCampaignDispatchAuth({
        hasActiveStaffSession: true,
        canExecuteCampaigns: false,
      }).ok,
      false
    );
    assert.equal(
      evaluateManualCampaignDispatchAuth({
        hasActiveStaffSession: false,
        canExecuteCampaigns: false,
      }).ok,
      false
    );
  });

  test("disabled mode still authorizes before treating as admin operation", async () => {
    let authorized = false;
    let dispatched = false;
    const result = await executeAuthorizedManualMockDispatch({
      authorize: async () => {
        authorized = true;
        return { ok: true };
      },
      getMode: () => "disabled",
      dispatch: async () => {
        dispatched = true;
        return { mode: "disabled", processed: 1, outcomes: [] };
      },
    });
    assert.equal(authorized, true);
    assert.equal(dispatched, false);
    assert.equal(result.success, true);
  });

  test("live and sandbox fail closed after authorization without dispatcher", async () => {
    let dispatched = false;
    const live = await executeAuthorizedManualMockDispatch({
      authorize: async () => ({ ok: true }),
      getMode: () => "live",
      dispatch: async () => {
        dispatched = true;
        return { mode: "live", processed: 1, outcomes: [] };
      },
    });
    const sandbox = await executeAuthorizedManualMockDispatch({
      authorize: async () => ({ ok: true }),
      getMode: () => "sandbox",
      dispatch: async () => {
        dispatched = true;
        return { mode: "sandbox", processed: 1, outcomes: [] };
      },
    });
    assert.equal(live.success, false);
    assert.equal(sandbox.success, false);
    assert.equal(live.code, "CAMPAIGN_PRODUCTION_GATE_OFF");
    assert.equal(sandbox.code, "CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE");
    assert.equal(dispatched, false);
  });
});

describe("Phase 9C-B signed execution context OD9C-B", () => {
  test("valid context verifies", () => {
    const signed = signCampaignExecutionContext(hmacSecret, sampleContext());
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    assert.equal(verifyCampaignExecutionContext(hmacSecret, signed, now).valid, true);
  });

  test("tampered signature fails", () => {
    const signed = signCampaignExecutionContext(hmacSecret, sampleContext());
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    assert.equal(
      verifyCampaignExecutionContext(hmacSecret, { ...signed, signature: "00".repeat(32) }, now).valid,
      false
    );
  });

  test("expired fails", () => {
    const signed = signCampaignExecutionContext(hmacSecret, sampleContext());
    const now = Date.parse("2026-08-21T00:00:01.000Z");
    assert.equal(verifyCampaignExecutionContext(hmacSecret, signed, now).valid, false);
  });

  test("wrong run target provider publication fail after field change", () => {
    const now = Date.parse("2026-08-19T12:00:00.000Z");
    const signed = signCampaignExecutionContext(hmacSecret, sampleContext());
    for (const mutated of [
      sampleContext({ runReference: "OD-CR-2026-000002" }),
      sampleContext({ runTargetReference: "OD-CRT-2026-000002" }),
      sampleContext({ providerChannel: "google_ads" }),
      sampleContext({ landingPublicationReference: "OD-LP-2026-000099" }),
    ]) {
      assert.equal(
        verifyCampaignExecutionContext(hmacSecret, { context: mutated, signature: signed.signature }, now).valid,
        false
      );
    }
  });

  test("canonical serialization is stable", () => {
    const a = buildCanonicalCampaignExecutionContextPayload(sampleContext());
    const b = buildCanonicalCampaignExecutionContextPayload(sampleContext());
    assert.equal(a, b);
    assert.match(a, /runReference/);
  });

  test("unsigned UTM/time guessing is rejected", () => {
    assert.throws(() => rejectUnsignedRunGuess({ utmCampaign: "diwali", nowIso: "2026-08-19T00:00:00Z" }));
  });

  test("HMAC secret does not fall back to Landing Lab key", () => {
    assert.equal(
      getCampaignExecutionHmacSecret({
        ONEDECORE_LANDING_LAB_HMAC_SECRET: "landing-lab-secret-value-32chars-min",
      }),
      null
    );
    assert.equal(
      getCampaignExecutionHmacSecret({
        ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET: hmacSecret,
        ONEDECORE_LANDING_LAB_HMAC_SECRET: hmacSecret,
      }),
      null
    );
  });
});

describe("Phase 9C-B OD9C-C sharing policy", () => {
  test("MARKETING alone does not enable sharing", () => {
    const decision = canShareProviderCustomerData({
      provider: "meta_ads",
      purpose: "custom_audience",
      targetingMode: "broad_public",
      executionMode: "mock",
      productionSharingEnabled: false,
      marketingConsentGranted: true,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "MARKETING_CONSENT_NOT_PROVIDER_SHARING");
  });

  test("direct custom denied while gate off with no broad fallback", () => {
    const decision = canShareProviderCustomerData({
      provider: "google_ads",
      purpose: "hashed_match",
      targetingMode: "direct_or_custom",
      executionMode: "mock",
      productionSharingEnabled: false,
      marketingConsentGranted: true,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "PROVIDER_CUSTOM_EXPORT_DISABLED");
    assert.match(decision.reason, /does not silently switch to broad_public/);
  });
});

describe("Phase 9C-B admin controls", () => {
  test("SE has no execute/pause/cancel", () => {
    const caps = resolveCampaignExecutionCapabilities("sales_executive");
    assert.equal(caps.canExecuteCampaign, false);
    assert.equal(caps.canPauseCampaign, false);
    assert.equal(caps.canCancelCampaign, false);
  });

  test("SM pause/resume but not cancel; SA cancel", () => {
    assert.equal(visibleRunControls("sales_manager", "running").showCancel, false);
    assert.equal(visibleRunControls("sales_manager", "running").showPause, true);
    assert.equal(visibleRunControls("super_admin", "running").showCancel, true);
  });

  test("execution panel messaging", () => {
    const src = readFileSync(join(root, "src/features/marketing/components/CampaignExecutionPanel.tsx"), "utf8");
    assert.match(src, /No live provider writes/);
    assert.match(src, /Production activation Phase 10/);
    assert.match(src, /does not switch to broad_public/);
    assert.match(src, /Create\/schedule mock run/);
    assert.doesNotMatch(src, /SERVICE_ROLE|HMAC/);
  });
});

describe("Phase 9C-B containment", () => {
  test("M33 exists and M31/M32 are not rewritten in this file", () => {
    const m33 = readFileSync(
      join(root, "supabase/migrations/20260820140000_campaign_execution_foundation.sql"),
      "utf8"
    );
    assert.match(m33, /create table public.campaign_runs/);
    assert.match(m33, /campaigns\.execute/);
    assert.doesNotMatch(m33, /facebook-nodejs-business-sdk|google-ads-api/);
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    assert.doesNotMatch(pkg, /facebook-nodejs-business-sdk|google-ads-api/);
  });

  test("public lp gate is not enabled by execution env", () => {
    const envSrc = readFileSync(
      join(root, "src/features/marketing/execution/server/execution-env.ts"),
      "utf8"
    );
    assert.doesNotMatch(envSrc, /ONEDECORE_LANDING_LAB_PUBLIC_ENABLED=true/);
  });
});
