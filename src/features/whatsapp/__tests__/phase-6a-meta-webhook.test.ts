/**
 * Phase 6A — Meta WhatsApp webhook foundation application tests.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  getMetaWebhookMode,
  getMetaWebhookServerEnv,
  isLoopbackSupabaseUrl,
  isManagedOneDecoreSupabaseUrl,
} from "../server/meta-webhook-env.ts";
import {
  computeEnvelopeHash,
  parseHubSignature256Header,
  verifyMetaWebhookSignature,
} from "../server/meta-webhook-signature.ts";
import {
  META_WEBHOOK_MAX_BODY_BYTES,
  readBoundedRawBody,
} from "../server/meta-webhook-body.ts";
import {
  META_WEBHOOK_OBJECT,
  normalizeMetaWebhookPayload,
  normalizeWaIdToE164,
} from "../server/meta-webhook-contract.ts";
import {
  handleMetaWebhookPost,
  handleMetaWebhookVerification,
  MetaWebhookError,
} from "../server/meta-webhook-ingest.ts";

const root = process.cwd();
const MANAGED = "https://lpurlfmpvriyvpkujvyl.supabase.co";
const APP_SECRET = "phase6a-local-test-meta-app-secret";
const VERIFY_TOKEN = "phase6a-local-verify-token";

function localEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NODE_ENV: "test",
    ONEDECORE_WHATSAPP_WEBHOOK_MODE: "local-test",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN,
    META_WHATSAPP_APP_SECRET: APP_SECRET,
    ...overrides,
  };
}

function signBody(raw: Uint8Array, secret = APP_SECRET): string {
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  return `sha256=${digest}`;
}

function inboundPayload(messageId = "wamid.phase6a.001") {
  return {
    object: META_WEBHOOK_OBJECT,
    entry: [
      {
        id: "9001",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+919876543210",
                phone_number_id: "1001",
              },
              contacts: [
                {
                  wa_id: "919111222333",
                  profile: { name: "Synthetic Customer" },
                },
              ],
              messages: [
                {
                  from: "919111222333",
                  id: messageId,
                  timestamp: "1722765600",
                  type: "text",
                  text: { body: "Hello ONEDECORE" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("Phase 6A webhook env", () => {
  test("default mode disabled", () => {
    assert.equal(getMetaWebhookMode({}), "disabled");
    const env = getMetaWebhookServerEnv({ ONEDECORE_WHATSAPP_WEBHOOK_MODE: "disabled" });
    assert.equal(env.mode, "disabled");
    assert.equal(env.appSecret, null);
  });

  test("invalid mode fail closed", () => {
    assert.equal(getMetaWebhookMode({ ONEDECORE_WHATSAPP_WEBHOOK_MODE: "bogus" }), "disabled");
    assert.throws(() =>
      getMetaWebhookServerEnv({ ONEDECORE_WHATSAPP_WEBHOOK_MODE: "bogus" })
    );
  });

  test("local-test forbidden in production", () => {
    assert.throws(() =>
      getMetaWebhookServerEnv({
        NODE_ENV: "production",
        ONEDECORE_WHATSAPP_WEBHOOK_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
      })
    );
    assert.equal(
      getMetaWebhookMode({
        NODE_ENV: "production",
        ONEDECORE_WHATSAPP_WEBHOOK_MODE: "local-test",
      }),
      "disabled"
    );
  });

  test("local-test loopback Supabase only", () => {
    assert.throws(() =>
      getMetaWebhookServerEnv({
        ONEDECORE_WHATSAPP_WEBHOOK_MODE: "local-test",
        NEXT_PUBLIC_SUPABASE_URL: MANAGED,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
      })
    );
    assert.equal(isLoopbackSupabaseUrl("http://127.0.0.1:54321"), true);
    assert.equal(isManagedOneDecoreSupabaseUrl(MANAGED), true);
  });

  test("enabled managed OneDecore only", () => {
    assert.throws(() =>
      getMetaWebhookServerEnv({
        ONEDECORE_WHATSAPP_WEBHOOK_MODE: "enabled",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
        META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN,
        META_WHATSAPP_APP_SECRET: APP_SECRET,
      })
    );
    const env = getMetaWebhookServerEnv({
      ONEDECORE_WHATSAPP_WEBHOOK_MODE: "enabled",
      NEXT_PUBLIC_SUPABASE_URL: MANAGED,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-publishable",
      META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN,
      META_WHATSAPP_APP_SECRET: APP_SECRET,
    });
    assert.equal(env.mode, "enabled");
  });

  test("secrets remain server-only in env module", () => {
    const envSource = readFileSync(
      join(root, "src/features/whatsapp/server/meta-webhook-env.ts"),
      "utf8"
    );
    assert.equal(envSource.includes("NEXT_PUBLIC_META"), false);
    assert.equal(envSource.includes("META_WHATSAPP_APP_SECRET"), true);
  });
});

describe("Phase 6A GET verification", () => {
  test("disabled returns 503", () => {
    assert.throws(
      () =>
        handleMetaWebhookVerification(
          {
            mode: "disabled",
            verifyToken: null,
            hubMode: "subscribe",
            hubVerifyToken: VERIFY_TOKEN,
            hubChallenge: "12345",
            host: "localhost:3000",
          },
          { getEnv: () => getMetaWebhookServerEnv({ ONEDECORE_WHATSAPP_WEBHOOK_MODE: "disabled" }) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 503
    );
  });

  test("malformed verify returns 400", () => {
    assert.throws(
      () =>
        handleMetaWebhookVerification(
          {
            mode: "local-test",
            verifyToken: null,
            hubMode: "invalid",
            hubVerifyToken: VERIFY_TOKEN,
            hubChallenge: "12345",
            host: "localhost:3000",
          },
          {
            getMode: () => "local-test",
            getEnv: () => getMetaWebhookServerEnv(localEnv()),
          }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 400
    );
  });

  test("wrong token returns 403", () => {
    assert.throws(
      () =>
        handleMetaWebhookVerification(
          {
            mode: "local-test",
            verifyToken: null,
            hubMode: "subscribe",
            hubVerifyToken: "wrong-token",
            hubChallenge: "12345",
            host: "localhost:3000",
          },
          {
            getMode: () => "local-test",
            getEnv: () => getMetaWebhookServerEnv(localEnv()),
          }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 403
    );
  });

  test("correct token returns challenge without token leakage", () => {
    const result = handleMetaWebhookVerification(
      {
        mode: "local-test",
        verifyToken: null,
        hubMode: "subscribe",
        hubVerifyToken: VERIFY_TOKEN,
        hubChallenge: "1158201444",
        host: "localhost:3000",
      },
      {
        getMode: () => "local-test",
        getEnv: () => getMetaWebhookServerEnv(localEnv()),
      }
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(result.body, "1158201444");
    assert.equal(result.body.includes(VERIFY_TOKEN), false);
  });
});

describe("Phase 6A POST signature", () => {
  test("disabled before DB", async () => {
    const raw = new TextEncoder().encode("{}");
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: signBody(raw),
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv({ ONEDECORE_WHATSAPP_WEBHOOK_MODE: "disabled" }) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 503
    );
  });

  test("missing signature 401", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload()));
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: null,
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 401
    );
  });

  test("malformed signature 401", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload()));
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: "sha256=not-hex",
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 401
    );
  });

  test("wrong signature 401", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload()));
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: signBody(raw, "wrong-secret-value-32chars-min"),
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 401
    );
  });

  test("exact raw-body signature pass and one-byte change rejected", () => {
    const raw = new TextEncoder().encode('{"object":"whatsapp_business_account"}');
    const good = verifyMetaWebhookSignature(raw, signBody(raw), APP_SECRET);
    assert.equal(good.ok, true);
    const tampered = new Uint8Array(raw);
    tampered[tampered.length - 1] ^= 0x01;
    const bad = verifyMetaWebhookSignature(tampered, signBody(raw), APP_SECRET);
    assert.equal(bad.ok, false);
  });

  test("timing-safe implementation present", () => {
    const source = readFileSync(
      join(root, "src/features/whatsapp/server/meta-webhook-signature.ts"),
      "utf8"
    );
    assert.equal(source.includes("timingSafeEqual"), true);
  });
});

describe("Phase 6A request handling", () => {
  test("non-JSON content-type rejected", async () => {
    const raw = new TextEncoder().encode("plain");
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "text/plain",
            signatureHeader: signBody(raw),
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 400
    );
  });

  test("body cap enforced", async () => {
    const oversized = new Uint8Array(META_WEBHOOK_MAX_BODY_BYTES + 1);
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: oversized,
      headers: { "content-length": String(oversized.byteLength) },
    });
    const result = await readBoundedRawBody(request);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "BODY_TOO_LARGE");
  });

  test("malformed JSON rejected", async () => {
    const raw = new TextEncoder().encode("{not-json");
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: signBody(raw),
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 400
    );
  });

  test("signed object mismatch ignored", async () => {
    const payload = { object: "page", entry: [] };
    const raw = new TextEncoder().encode(JSON.stringify(payload));
    const result = await handleMetaWebhookPost(
      {
        contentType: "application/json",
        signatureHeader: signBody(raw),
        rawBody: raw,
        host: "localhost:3000",
        nodeEnv: "test",
      },
      { getEnv: () => getMetaWebhookServerEnv(localEnv()) }
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(result.outcome, "ignored");
  });
});

describe("Phase 6A normalization", () => {
  test("inbound text normalized", () => {
    const normalized = normalizeMetaWebhookPayload(inboundPayload());
    assert.equal(normalized.events.length, 1);
    assert.equal(normalized.events[0]?.kind, "inbound_message");
  });

  test("media unknown safely normalized", () => {
    const payload = inboundPayload("wamid.media.001");
    const entry = payload.entry[0]!;
    const change = entry.changes[0]!;
    const value = change.value as {
      messages: Array<Record<string, unknown>>;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: unknown;
      messaging_product?: string;
    };
    value.messages = [
      {
        from: "919111222333",
        id: "wamid.media.001",
        timestamp: "1722765600",
        type: "sticker",
        sticker: { id: "sticker-id", mime_type: "image/webp" },
      },
    ];
    const normalized = normalizeMetaWebhookPayload(payload);
    assert.equal(normalized.events[0]?.kind, "inbound_message");
    if (normalized.events[0]?.kind === "inbound_message") {
      assert.equal(normalized.events[0].normalizedMessageType, "sticker");
    }
  });

  test("status normalized", () => {
    const payload = {
      object: META_WEBHOOK_OBJECT,
      entry: [
        {
          id: "9001",
          changes: [
            {
              field: "messages",
              value: {
                metadata: {
                  display_phone_number: "+919876543210",
                  phone_number_id: "1001",
                },
                statuses: [
                  {
                    id: "wamid.phase6a.001",
                    status: "delivered",
                    timestamp: "1722765700",
                    recipient_id: "919111222333",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const normalized = normalizeMetaWebhookPayload(payload);
    assert.equal(normalized.events[0]?.kind, "message_status");
  });

  test("wa_id to E.164", () => {
    assert.equal(normalizeWaIdToE164("919111222333"), "+919111222333");
    assert.equal(normalizeWaIdToE164("invalid"), null);
  });

  test("envelope hash uses raw bytes", () => {
    const raw = new TextEncoder().encode('{"a":1}');
    assert.equal(computeEnvelopeHash(raw).length, 64);
  });

  test("signature header parser", () => {
    assert.equal(parseHubSignature256Header("sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789").ok, true);
    assert.equal(parseHubSignature256Header("bad").ok, false);
  });
});

describe("Phase 6A persistence boundary", () => {
  test("RPC only after signature with mock client", async () => {
    let rpcCalled = false;
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload("wamid.mock.001")));
    const result = await handleMetaWebhookPost(
      {
        contentType: "application/json",
        signatureHeader: signBody(raw),
        rawBody: raw,
        host: "localhost:3000",
        nodeEnv: "test",
      },
      {
        getEnv: () => getMetaWebhookServerEnv(localEnv()),
        createAdminClient: () =>
          ({
            rpc: async () => {
              rpcCalled = true;
              return {
                data: [{ outcome_code: "persisted" }],
                error: null,
              };
            },
          }) as never,
      }
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(rpcCalled, true);
  });

  test("duplicate returns 200", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload("wamid.mock.dup")));
    const result = await handleMetaWebhookPost(
      {
        contentType: "application/json",
        signatureHeader: signBody(raw),
        rawBody: raw,
        host: "localhost:3000",
        nodeEnv: "test",
      },
      {
        getEnv: () => getMetaWebhookServerEnv(localEnv()),
        createAdminClient: () =>
          ({
            rpc: async () => ({
              data: [{ outcome_code: "duplicate" }],
              error: null,
            }),
          }) as never,
      }
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(result.outcome, "duplicate");
  });

  test("DB error returns 500", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(inboundPayload("wamid.mock.err")));
    await assert.rejects(
      () =>
        handleMetaWebhookPost(
          {
            contentType: "application/json",
            signatureHeader: signBody(raw),
            rawBody: raw,
            host: "localhost:3000",
            nodeEnv: "test",
          },
          {
            getEnv: () => getMetaWebhookServerEnv(localEnv()),
            createAdminClient: () =>
              ({
                rpc: async () => ({
                  data: null,
                  error: { code: "XX000", message: "db down" },
                }),
              }) as never,
          }
        ),
      (error: unknown) =>
        error instanceof MetaWebhookError && error.httpStatus === 500
    );
  });

  test("no outbound graph call in implementation", () => {
    const ingestSource = readFileSync(
      join(root, "src/features/whatsapp/server/meta-webhook-ingest.ts"),
      "utf8"
    );
    const routeSource = readFileSync(
      join(root, "src/app/api/webhooks/meta/whatsapp/route.ts"),
      "utf8"
    );
    assert.equal(ingestSource.includes("graph.facebook.com"), false);
    assert.equal(routeSource.includes("graph.facebook.com"), false);
  });

  test("no n8n or groq references in whatsapp feature", () => {
    const files = [
      "src/features/whatsapp/server/meta-webhook-env.ts",
      "src/features/whatsapp/server/meta-webhook-signature.ts",
      "src/features/whatsapp/server/meta-webhook-contract.ts",
      "src/features/whatsapp/server/meta-webhook-ingest.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8").toLowerCase();
      assert.equal(source.includes("n8n"), false);
      assert.equal(source.includes("groq"), false);
    }
  });

  test("no automatic consent mutation in ingest path", () => {
    const ingestSource = readFileSync(
      join(root, "src/features/whatsapp/server/meta-webhook-ingest.ts"),
      "utf8"
    );
    assert.equal(ingestSource.includes("consent_events"), false);
    assert.equal(ingestSource.includes("MARKETING"), false);
    assert.equal(ingestSource.includes("WHATSAPP_SERVICE"), false);
  });
});

describe("Phase 6A route artifact", () => {
  test("canonical route exists with node runtime", () => {
    const routeSource = readFileSync(
      join(root, "src/app/api/webhooks/meta/whatsapp/route.ts"),
      "utf8"
    );
    assert.equal(routeSource.includes('runtime = "nodejs"'), true);
    assert.equal(routeSource.includes('dynamic = "force-dynamic"'), true);
    assert.equal(routeSource.includes("export async function GET"), true);
    assert.equal(routeSource.includes("export async function POST"), true);
  });
});
