/**
 * Phase 6B — integrated local matrix (repository schema M1–M21).
 * Complements pgTAP 13/14/15 with orchestration-level dispatch tests.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createFakeWhatsappProviderAdapter } from "../server/whatsapp-fake-provider-adapter.ts";
import { dispatchWhatsappSendIntent } from "../server/whatsapp-dispatch-service.ts";
import type { WhatsappOutboundServerEnv } from "../server/whatsapp-outbound-env.ts";
import { getWhatsappOutboundMode } from "../server/whatsapp-outbound-env.ts";
import { rejectMarketingPurpose } from "../server/send-intent-normalization.ts";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "../contracts/inbox-permissions.ts";

const root = process.cwd();

const FROZEN_HASHES = {
  M19: "ACC743F9D6E73961F4AC18589374D81DB4FD43D5FAB6713A21328EBD2A1CC82C",
  M20: "38DF4251D0F4DE6C86288F23323947175294814A06AC13EAF570577F7EF6F825",
  M21: "13EF6B7D33CB4740DCBE98AA61C04311041E3E74C9EA5B3E93A1C54B3BE540DA",
} as const;

function sha256File(relPath: string): string {
  const bytes = readFileSync(join(root, relPath));
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function localTestEnv(): WhatsappOutboundServerEnv {
  return {
    mode: "local-test",
    providerCode: "fake",
    supabaseUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "service-role-test-key-not-publishable",
    graphApiVersion: "v22.0",
    accessToken: null,
    phoneNumberId: null,
  };
}

function mockAdmin(rpcImpl: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => rpcImpl(name, args),
  };
}

describe("Phase 6B integrated — frozen migration ledger", () => {
  test("M19/M20/M21 hashes match protected main freeze", () => {
    assert.equal(
      sha256File(
        "supabase/migrations/20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql"
      ),
      FROZEN_HASHES.M19
    );
    assert.equal(
      sha256File(
        "supabase/migrations/20260807140000_whatsapp_shared_inbox_read_model_foundation.sql"
      ),
      FROZEN_HASHES.M20
    );
    assert.equal(
      sha256File(
        "supabase/migrations/20260808140000_whatsapp_provider_dispatch_foundation.sql"
      ),
      FROZEN_HASHES.M21
    );
  });

  test("repository has exactly 21 migrations (no unexpected M22+)", () => {
    const files = readdirSync(join(root, "supabase/migrations")).filter((f) =>
      f.endsWith(".sql")
    );
    assert.equal(files.length, 21);
    assert.equal(
      files.some((f) => f.startsWith("20260809")),
      false
    );
  });
});

describe("Phase 6B integrated — consent/purpose", () => {
  test("MARKETING purpose is rejected on service path", () => {
    assert.throws(() => rejectMarketingPurpose("MARKETING"), /MARKETING/);
    assert.doesNotThrow(() =>
      rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE)
    );
  });
});

describe("Phase 6B integrated — outbound modes", () => {
  test("defaults to disabled; local-test forbidden in production NODE_ENV", () => {
    assert.equal(getWhatsappOutboundMode({}), "disabled");
    assert.equal(
      getWhatsappOutboundMode({
        ONEDECORE_WHATSAPP_OUTBOUND_MODE: "local-test",
        NODE_ENV: "production",
      }),
      "disabled"
    );
  });
});

describe("Phase 6B integrated — dispatch orchestration", () => {
  const envBackup = { ...process.env };

  before(() => {
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "local-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key-not-publishable";
  });

  after(() => {
    process.env = { ...envBackup };
  });

  test("disabled mode records intent path without provider RPC", async () => {
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "disabled";
    let rpcCalls = 0;
    const result = await dispatchWhatsappSendIntent("intent-disabled", {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        ({
          rpc: async () => {
            rpcCalls += 1;
            return { data: null, error: null };
          },
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "disabled");
    assert.equal(rpcCalls, 0);
    process.env.ONEDECORE_WHATSAPP_OUTBOUND_MODE = "local-test";
  });

  test("fake provider success binds with provider evidence", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const calls: string[] = [];

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          calls.push(name);
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "bind_whatsapp_send_intent_dispatch") {
            return {
              data: [
                {
                  outcome_code: "bound",
                  send_intent_id: intentId,
                  outbound_message_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                  provider_message_id: "wamid.fake.test",
                },
              ],
              error: null,
            };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "bound");
    assert.equal(calls[0], "claim_whatsapp_send_intent_for_dispatch");
    assert.equal(calls[1], "bind_whatsapp_send_intent_dispatch");
    assert.equal(result.providerMessageId, "wamid.fake.test");
    assert.match(result.message, /webhook evidence/i);
  });

  test("terminal provider failure records outcome without bind", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const calls: string[] = [];

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          calls.push(name);
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => ({
        providerCode: "fake" as const,
        async dispatchTextMessage() {
          return {
            kind: "failed" as const,
            errorClass: "terminal" as const,
            code: "validation",
            message: "Provider rejected message.",
            httpStatus: 400,
            responseSnapshot: {},
          };
        },
      }),
    });

    assert.equal(result.outcome, "failed");
    assert.ok(calls.includes("record_whatsapp_dispatch_attempt_outcome"));
    assert.equal(
      calls.includes("bind_whatsapp_send_intent_dispatch"),
      false
    );
  });

  test("ambiguous provider result records ambiguous without bind", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => ({
        providerCode: "fake" as const,
        async dispatchTextMessage() {
          return {
            kind: "ambiguous" as const,
            code: "timeout",
            message: "Ambiguous provider response.",
            httpStatus: 504,
            responseSnapshot: {},
          };
        },
      }),
    });

    assert.equal(result.outcome, "ambiguous");
  });

  test("bind failure after provider success becomes ambiguous reconciliation", async () => {
    const intentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const result = await dispatchWhatsappSendIntent(intentId, {
      getEnv: () => localTestEnv(),
      createAdminClient: () =>
        mockAdmin(async (name) => {
          if (name === "claim_whatsapp_send_intent_for_dispatch") {
            return {
              data: [
                {
                  outcome_code: "claimed",
                  send_intent_id: intentId,
                  dispatch_attempt_id: attemptId,
                  conversation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  requested_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                  body_text: "Hello",
                  phone_number_id: "1201",
                  customer_e164: "+919555666777",
                  sender_e164: "+919876543211",
                },
              ],
              error: null,
            };
          }
          if (name === "bind_whatsapp_send_intent_dispatch") {
            return {
              data: null,
              error: { message: "bind failed" },
            };
          }
          if (name === "record_whatsapp_dispatch_attempt_outcome") {
            return { data: [{ outcome_code: "recorded" }], error: null };
          }
          return { data: null, error: { message: `unexpected ${name}` } };
        }) as never,
      createProviderAdapter: () => createFakeWhatsappProviderAdapter(),
    });

    assert.equal(result.outcome, "ambiguous");
    assert.match(result.message, /Reconciliation required/i);
  });
});

describe("Phase 6B integrated — security contracts", () => {
  test("Meta adapter source references graph API version only in enabled adapter module", () => {
    const meta = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts"),
      "utf8"
    );
    const sendActions = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-send-actions.ts"),
      "utf8"
    );
    assert.match(meta, /graph\.facebook\.com/);
    assert.doesNotMatch(sendActions, /graph\.facebook/i);
  });

  test("dispatch service is server-only", () => {
    const src = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-dispatch-service.ts"),
      "utf8"
    );
    assert.match(src, /server-only/);
  });
});
