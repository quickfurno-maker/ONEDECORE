/**
 * Phase 6B-B1 — shared inbox authorization and send-intent foundation tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  WHATSAPP_INBOX_PERMISSION_CODES,
  WHATSAPP_INBOX_ROLE_PERMISSIONS,
  WHATSAPP_SERVICE_PURPOSE_CODE,
} from "../contracts/inbox-permissions.ts";
import {
  canUseWhatsappConversation,
  canViewWhatsappConversation,
  resolveWhatsappInboxAccess,
  type ConversationAccessContext,
  type InboxAccessContext,
} from "../server/inbox-access-resolver.ts";
import {
  assertTextOnlySendPayload,
  computeWhatsappSendRequestHash,
  normalizeWhatsappSendBody,
  rejectMarketingPurpose,
} from "../server/send-intent-normalization.ts";
import {
  isWhatsappEligibilityDeniedError,
  isWhatsappIdempotencyConflictError,
  isWhatsappInboxAccessDeniedError,
  isWhatsappPurposeDeniedError,
} from "../server/whatsapp-inbox-errors.ts";

const root = process.cwd();
const M19_MIGRATION = join(
  root,
  "supabase/migrations/20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql"
);

function actor(
  overrides: Partial<InboxAccessContext> & Pick<InboxAccessContext, "actorId">
): InboxAccessContext {
  return {
    isActiveStaff: true,
    permissions: new Set<string>(),
    roles: new Set<string>(),
    ...overrides,
  };
}

function conversation(
  overrides: Partial<ConversationAccessContext> = {}
): ConversationAccessContext {
  return {
    conversationId: "conv-1",
    leadId: "lead-1",
    assignedTo: "exec-a",
    ...overrides,
  };
}

describe("Phase 6B-B1 migration contract", () => {
  test("migration defines inbox permissions and send-intent tables", () => {
    const sql = readFileSync(M19_MIGRATION, "utf8");
    for (const code of WHATSAPP_INBOX_PERMISSION_CODES) {
      assert.match(sql, new RegExp(code.replaceAll(".", "\\.")));
    }
    assert.match(sql, /whatsapp_send_intents/);
    assert.match(sql, /whatsapp_send_intent_events/);
    assert.match(sql, /create_whatsapp_service_send_intent/);
    assert.doesNotMatch(sql, /graph\.facebook\.com/);
    assert.doesNotMatch(sql, /n8n/i);
  });

  test("M18 migration is not modified by B1 worktree", () => {
    const m18Path = join(
      root,
      "supabase/migrations/20260804150000_meta_whatsapp_data_webhook_foundation.sql"
    );
    const m18 = readFileSync(m18Path, "utf8");
    assert.match(m18, /ingest_meta_whatsapp_message/);
  });
});

describe("Phase 6B-B1 inbox access resolver", () => {
  test("assigned executive can read/use linked conversation", () => {
    const ctx = actor({
      actorId: "exec-a",
      permissions: new Set(["whatsapp.inbox.read", "whatsapp.inbox.use"]),
      roles: new Set(["sales_executive"]),
    });
    const conv = conversation();
    assert.equal(canViewWhatsappConversation(ctx, conv), true);
    assert.equal(canUseWhatsappConversation(ctx, conv), true);
  });

  test("other executive denied on linked conversation", () => {
    const ctx = actor({
      actorId: "exec-b",
      permissions: new Set(["whatsapp.inbox.read", "whatsapp.inbox.use"]),
      roles: new Set(["sales_executive"]),
    });
    const conv = conversation({ assignedTo: "exec-a" });
    assert.equal(canUseWhatsappConversation(ctx, conv), false);
  });

  test("reassignment uses current owner only", () => {
    const oldOwner = actor({
      actorId: "exec-a",
      permissions: new Set(["whatsapp.inbox.read", "whatsapp.inbox.use"]),
      roles: new Set(["sales_executive"]),
    });
    const newOwner = actor({
      actorId: "exec-b",
      permissions: new Set(["whatsapp.inbox.read", "whatsapp.inbox.use"]),
      roles: new Set(["sales_executive"]),
    });
    const reassigned = conversation({ assignedTo: "exec-b" });
    assert.equal(canUseWhatsappConversation(oldOwner, reassigned), false);
    assert.equal(canUseWhatsappConversation(newOwner, reassigned), true);
  });

  test("unlinked triage is manager-only", () => {
    const se = actor({
      actorId: "exec-a",
      permissions: new Set(["whatsapp.inbox.read", "whatsapp.inbox.use"]),
      roles: new Set(["sales_executive"]),
    });
    const sm = actor({
      actorId: "mgr",
      permissions: new Set([
        "whatsapp.inbox.read",
        "whatsapp.inbox.use",
        "whatsapp.inbox.manage",
      ]),
      roles: new Set(["sales_manager"]),
    });
    const unlinked = conversation({ leadId: null, assignedTo: null });
    assert.equal(canViewWhatsappConversation(se, unlinked), false);
    assert.equal(canUseWhatsappConversation(se, unlinked), false);
    assert.equal(resolveWhatsappInboxAccess(sm, unlinked, "manage"), true);
  });

  test("read is not implied by use permission alone for unlinked", () => {
    const readOnly = actor({
      actorId: "reader",
      permissions: new Set(["whatsapp.inbox.read"]),
      roles: new Set(["sales_executive"]),
    });
    const unlinked = conversation({ leadId: null, assignedTo: null });
    assert.equal(canViewWhatsappConversation(readOnly, unlinked), false);
    assert.equal(canUseWhatsappConversation(readOnly, unlinked), false);
  });

  test("PM and designer have no inbox grants in constants", () => {
    assert.deepEqual(WHATSAPP_INBOX_ROLE_PERMISSIONS.project_manager, []);
    assert.deepEqual(WHATSAPP_INBOX_ROLE_PERMISSIONS.designer, []);
  });
});

describe("Phase 6B-B1 send-intent normalization", () => {
  test("normalizes whitespace in body text", () => {
    assert.equal(
      normalizeWhatsappSendBody("  hello   world  "),
      "hello world"
    );
  });

  test("rejects overlong body text", () => {
    assert.throws(() => normalizeWhatsappSendBody("x".repeat(4097)));
  });

  test("WHATSAPP_SERVICE purpose allowed; MARKETING rejected", () => {
    rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE);
    assert.throws(() => rejectMarketingPurpose("MARKETING"));
  });

  test("request hash is deterministic for canonical payload", () => {
    const request = {
      conversationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      purposeCode: WHATSAPP_SERVICE_PURPOSE_CODE,
      bodyText: "Hello",
      replyToMessageId: null,
    };
    const first = computeWhatsappSendRequestHash(request);
    const second = computeWhatsappSendRequestHash({
      ...request,
      bodyText: "Hello",
    });
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  test("text-only payload guard rejects null bytes", () => {
    assert.throws(() => assertTextOnlySendPayload("hello\0world"));
  });
});

describe("Phase 6B-B1 error classifiers", () => {
  test("normalized error helpers detect access and idempotency failures", () => {
    assert.equal(
      isWhatsappInboxAccessDeniedError("denied_conversation_scope"),
      true
    );
    assert.equal(
      isWhatsappIdempotencyConflictError("idempotency_conflict: mismatch"),
      true
    );
    assert.equal(
      isWhatsappPurposeDeniedError("denied_purpose: only WHATSAPP_SERVICE"),
      true
    );
    assert.equal(isWhatsappEligibilityDeniedError("denied_dnc"), true);
  });
});

describe("Phase 6B-B1 provider boundary", () => {
  test("no Meta Graph client in B1 migration", () => {
    const migration = readFileSync(M19_MIGRATION, "utf8");
    assert.doesNotMatch(migration, /graph\.facebook\.com/);
    assert.doesNotMatch(migration, /insert into public\.whatsapp_messages/i);
  });
});
