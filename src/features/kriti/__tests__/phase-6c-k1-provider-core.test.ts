/**
 * Phase 6C K1 — provider and task engine tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { KritiRequest } from "../contracts/context.ts";
import { createKritiFakeProvider } from "../providers/kriti-fake-provider.ts";
import { createKritiInferenceProvider } from "../server/create-kriti-provider.ts";
import { getKritiProviderMode, getKritiServerEnv } from "../server/kriti-env.ts";
import { runKritiTask } from "../server/run-kriti-task.ts";

function sampleRequest(): KritiRequest {
  return {
    requestId: "req-test-1",
    taskType: "service_reply_draft",
    requestedAt: "2026-08-07T12:00:00.000Z",
    context: {
      taskType: "service_reply_draft",
      trustedPolicy: {
        brandName: "ONEDECORE",
        assistanceScope: "draft assistance only",
        prohibitedActions: ["auto-send", "mutate assignment"],
      },
      authorizedBusiness: {
        leadReference: "LEAD-001",
        conversationReference: "CONV-001",
        quotationReference: null,
        projectReference: null,
        staffRole: "sales_executive",
        staffDisplayName: "Staff A",
      },
      untrustedCustomer: {
        messages: [{ id: "m1", direction: "inbound", body: "Can we schedule a visit?", sentAt: "2026-08-07T11:00:00Z" }],
        notes: [],
      },
      supplementalFacts: ["Assigned lead"],
    },
  };
}

describe("Phase 6C K1 Kriti provider/core", () => {
  test("default mode is disabled", () => {
    assert.equal(getKritiProviderMode({ ONEDECORE_KRITI_MODE: undefined }), "disabled");
  });

  test("disabled mode returns KRITI_DISABLED", async () => {
    const env = getKritiServerEnv({ ONEDECORE_KRITI_MODE: "disabled" });
    const result = await runKritiTask(sampleRequest(), {
      env,
      provider: createKritiInferenceProvider(env),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "KRITI_DISABLED");
  });

  test("fake provider success validates output", async () => {
    const env = getKritiServerEnv({ ONEDECORE_KRITI_MODE: "local-test", NODE_ENV: "test" });
    const provider = createKritiFakeProvider({ scenario: "success" });
    const result = await runKritiTask(sampleRequest(), { env, provider });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.suggestion.humanReviewRequired, true);
  });

  test("fake malformed output fails closed", async () => {
    const env = getKritiServerEnv({ ONEDECORE_KRITI_MODE: "local-test", NODE_ENV: "test" });
    const provider = createKritiFakeProvider({ scenario: "malformed_output" });
    const result = await runKritiTask(sampleRequest(), { env, provider });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "KRITI_INVALID_OUTPUT");
  });

  test("fake timeout is retryable", async () => {
    const env = getKritiServerEnv({ ONEDECORE_KRITI_MODE: "local-test", NODE_ENV: "test" });
    const provider = createKritiFakeProvider({ scenario: "timeout" });
    const result = await runKritiTask(sampleRequest(), { env, provider });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "KRITI_TIMEOUT");
      assert.equal(result.error.retryable, true);
    }
  });

  test("enabled mode requires Groq API key", () => {
    assert.throws(() =>
      getKritiServerEnv({ ONEDECORE_KRITI_MODE: "enabled", ONEDECORE_KRITI_GROQ_API_KEY: "" })
    );
  });

  test("local-test uses fake provider factory", () => {
    const env = getKritiServerEnv({ ONEDECORE_KRITI_MODE: "local-test", NODE_ENV: "test" });
    const provider = createKritiInferenceProvider(env);
    assert.ok(provider);
    assert.equal(provider?.code, "fake");
  });
});
