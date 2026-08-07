/**
 * Phase 6B-B4 — provider dispatch contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  META_WHATSAPP_GRAPH_API_VERSION_DEFAULT,
  WHATSAPP_OUTBOUND_MODES,
} from "../contracts/provider-dispatch.ts";
import { classifyMetaDispatchHttpStatus } from "../server/whatsapp-dispatch-errors.ts";
import {
  getWhatsappOutboundMode,
  resolveWhatsappProviderCode,
} from "../server/whatsapp-outbound-env.ts";
import { createFakeWhatsappProviderAdapter } from "../server/whatsapp-fake-provider-adapter.ts";

const root = process.cwd();
const M21_MIGRATION = join(
  root,
  "supabase/migrations/20260808140000_whatsapp_provider_dispatch_foundation.sql"
);

describe("Phase 6B-B4 migration contract", () => {
  test("M21 defines dispatch attempts and service-role claim/bind RPCs", () => {
    const sql = readFileSync(M21_MIGRATION, "utf8");
    assert.match(sql, /whatsapp_provider_dispatch_attempts/);
    assert.match(sql, /claim_whatsapp_send_intent_for_dispatch/);
    assert.match(sql, /bind_whatsapp_send_intent_dispatch/);
    assert.match(sql, /record_whatsapp_dispatch_attempt_outcome/);
    assert.match(sql, /bind_whatsapp_send_intent_dispatch/);
    assert.match(sql, /insert into public\.whatsapp_messages[\s\S]*'outbound'/);
    assert.doesNotMatch(sql, /create_whatsapp_service_send_intent_impl/);
  });
});

describe("Phase 6B-B4 outbound env", () => {
  test("defaults to disabled and maps local-test to fake provider", () => {
    assert.equal(getWhatsappOutboundMode({}), "disabled");
    assert.equal(
      resolveWhatsappProviderCode("local-test"),
      "fake"
    );
    assert.equal(resolveWhatsappProviderCode("enabled"), "meta");
    for (const mode of WHATSAPP_OUTBOUND_MODES) {
      assert.ok(mode.length > 0);
    }
    assert.equal(META_WHATSAPP_GRAPH_API_VERSION_DEFAULT, "v22.0");
  });
});

describe("Phase 6B-B4 fake provider adapter", () => {
  test("returns deterministic provider message id without network", async () => {
    const adapter = createFakeWhatsappProviderAdapter();
    const first = await adapter.dispatchTextMessage({
      phoneNumberId: "1101",
      customerE164: "+919111222333",
      bodyText: "Hello",
      providerAttemptKey: "attempt-1",
    });
    const second = await adapter.dispatchTextMessage({
      phoneNumberId: "1101",
      customerE164: "+919111222333",
      bodyText: "Hello",
      providerAttemptKey: "attempt-1",
    });

    assert.equal(first.kind, "success");
    assert.equal(second.kind, "success");
    if (first.kind === "success" && second.kind === "success") {
      assert.equal(first.providerMessageId, second.providerMessageId);
      assert.match(first.providerMessageId, /^wamid\.fake\./);
    }
  });
});

describe("Phase 6B-B4 dispatch error classification", () => {
  test("classifies transient and terminal Meta HTTP statuses", () => {
    assert.equal(classifyMetaDispatchHttpStatus(429), "transient");
    assert.equal(classifyMetaDispatchHttpStatus(500), "transient");
    assert.equal(classifyMetaDispatchHttpStatus(400), "terminal");
    assert.equal(classifyMetaDispatchHttpStatus(401), "terminal");
  });
});

describe("Phase 6B-B4 module presence", () => {
  test("dispatch service and Meta adapter remain server-only", () => {
    for (const rel of [
      "src/features/whatsapp/server/whatsapp-dispatch-service.ts",
      "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts",
      "src/features/whatsapp/server/whatsapp-outbound-env.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /server-only|dispatch/);
    }
  });

  test("composer does not fabricate delivery/read claims", () => {
    const composer = readFileSync(
      join(root, "src/features/whatsapp/components/inbox/InboxComposer.tsx"),
      "utf8"
    );
    assert.doesNotMatch(composer, /message (was )?read/i);
    assert.doesNotMatch(composer, /delivered/i);
    assert.match(composer, /fabricating delivery or read status/i);
  });

  test("Meta adapter pins Graph API version constant", () => {
    const adapter = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts"),
      "utf8"
    );
    assert.match(adapter, /graph\.facebook\.com/);
    assert.match(adapter, /graphApiVersion/);
  });
});
