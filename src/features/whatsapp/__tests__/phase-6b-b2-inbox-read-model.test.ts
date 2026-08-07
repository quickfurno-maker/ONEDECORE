/**
 * Phase 6B-B2 — shared inbox read model contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  INBOX_CONVERSATION_LIST_PUBLIC_KEYS,
  INBOX_MESSAGE_PUBLIC_KEYS,
  mapConversationRowToListItem,
  mapMessageRowToItem,
  truncatePreviewText,
} from "../contracts/conversation-dtos.ts";
import { parseInboxListQuery } from "../contracts/inbox-list-query.ts";
import {
  hasWhatsappInboxReadAccess,
  type WhatsappInboxAccessContext,
} from "../contracts/inbox-access.ts";

const root = process.cwd();
const M20_MIGRATION = join(
  root,
  "supabase/migrations/20260807140000_whatsapp_shared_inbox_read_model_foundation.sql"
);

describe("Phase 6B-B2 read model migration", () => {
  test("M20 grants scoped SELECT on conversations and messages", () => {
    const sql = readFileSync(M20_MIGRATION, "utf8");
    assert.match(sql, /whatsapp_conversations_select_scoped/);
    assert.match(sql, /whatsapp_messages_select_scoped/);
    assert.match(sql, /private\.whatsapp_inbox_can_view_conversation/);
    assert.doesNotMatch(sql, /insert into public\.whatsapp_messages/i);
  });
});

describe("Phase 6B-B2 inbox list query", () => {
  test("parses bounded pagination and link filter", () => {
    const query = parseInboxListQuery({
      q: "  keshav  ",
      link: "unlinked",
      page: "2",
      pageSize: "99",
    });
    assert.equal(query.q, "keshav");
    assert.equal(query.linkFilter, "unlinked");
    assert.equal(query.page, 2);
    assert.equal(query.pageSize, 50);
  });
});

describe("Phase 6B-B2 DTO safety", () => {
  test("conversation list mapper exposes only approved public keys", () => {
    const item = mapConversationRowToListItem(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        customer_e164: "+919111222333",
        display_name_snapshot: "Test",
        lead_id: null,
        contact_id: null,
        last_message_at: "2026-08-07T10:00:00.000Z",
        last_inbound_at: "2026-08-07T10:00:00.000Z",
        leads: null,
      },
      "Hello"
    );
    for (const key of INBOX_CONVERSATION_LIST_PUBLIC_KEYS) {
      assert.ok(key in item);
    }
    assert.equal("provider_message_id" in item, false);
  });

  test("message mapper exposes only approved public keys", () => {
    const item = mapMessageRowToItem({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      direction: "inbound",
      normalized_message_type: "text",
      body_text: "Hi",
      provider_timestamp: "2026-08-07T10:00:00.000Z",
      latest_status: null,
    });
    for (const key of INBOX_MESSAGE_PUBLIC_KEYS) {
      assert.ok(key in item);
    }
    assert.equal("content" in item, false);
  });

  test("preview truncation is bounded", () => {
    const preview = truncatePreviewText("x".repeat(200));
    assert.ok(preview);
    assert.ok(preview.length <= 120);
  });
});

describe("Phase 6B-B2 access context", () => {
  test("read access requires whatsapp.inbox.read permission flag", () => {
    const denied: WhatsappInboxAccessContext = {
      userId: "u1",
      email: null,
      canRead: false,
      canUse: false,
      canManage: false,
    };
    const granted: WhatsappInboxAccessContext = {
      ...denied,
      canRead: true,
    };
    assert.equal(hasWhatsappInboxReadAccess(denied), false);
    assert.equal(hasWhatsappInboxReadAccess(granted), true);
  });
});

describe("Phase 6B-B2 server module presence", () => {
  test("repository and auth modules exist", () => {
    for (const rel of [
      "src/features/whatsapp/server/whatsapp-auth.ts",
      "src/features/whatsapp/server/whatsapp-permissions.ts",
      "src/features/whatsapp/server/whatsapp-inbox-queries.ts",
      "src/features/whatsapp/server/whatsapp-inbox-repository.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /server-only/);
    }
  });
});
