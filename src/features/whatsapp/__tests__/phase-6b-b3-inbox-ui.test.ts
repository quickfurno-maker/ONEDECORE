/**
 * Phase 6B-B3 — shared inbox UI contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  hasInboxListActiveFilters,
  parseInboxListQuery,
  toInboxListPaginationMeta,
} from "../contracts/inbox-list-query.ts";
import {
  INITIAL_WHATSAPP_SEND_ACTION_STATE,
  type WhatsappSendActionState,
} from "../contracts/send-action-state.ts";

const root = process.cwd();

describe("Phase 6B-B3 inbox list helpers", () => {
  test("detects active filters", () => {
    assert.equal(
      hasInboxListActiveFilters(
        parseInboxListQuery({ q: "keshav", link: "all" })
      ),
      true
    );
    assert.equal(
      hasInboxListActiveFilters(parseInboxListQuery({ link: "linked" })),
      true
    );
    assert.equal(
      hasInboxListActiveFilters(parseInboxListQuery({})),
      false
    );
  });

  test("derives pagination meta from page result", () => {
    const meta = toInboxListPaginationMeta({
      items: [],
      page: 2,
      pageSize: 25,
      totalCount: 60,
      totalPages: 3,
    });
    assert.equal(meta.hasPreviousPage, true);
    assert.equal(meta.hasNextPage, true);
    assert.equal(meta.page, 2);
    assert.equal(meta.totalPages, 3);
  });
});

describe("Phase 6B-B3 send action state", () => {
  test("initial state is non-success with empty message", () => {
    const state: WhatsappSendActionState = INITIAL_WHATSAPP_SEND_ACTION_STATE;
    assert.equal(state.success, false);
    assert.equal(state.message, "");
  });
});

describe("Phase 6B-B3 route and component presence", () => {
  test("admin whatsapp routes exist", () => {
    for (const rel of [
      "src/app/admin/whatsapp/layout.tsx",
      "src/app/admin/whatsapp/inbox/page.tsx",
      "src/app/admin/whatsapp/inbox/[conversationId]/page.tsx",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /force-dynamic/);
    }

    const index = readFileSync(
      join(root, "src/app/admin/whatsapp/page.tsx"),
      "utf8"
    );
    assert.match(index, /redirect\("\/admin\/whatsapp\/inbox"\)/);
  });

  test("composer records pre-dispatch intent only", () => {
    const composer = readFileSync(
      join(root, "src/features/whatsapp/components/inbox/InboxComposer.tsx"),
      "utf8"
    );
    assert.match(composer, /createWhatsappServiceSendIntentAction/);
    assert.match(composer, /pre-dispatch send intent only/i);
    assert.doesNotMatch(composer, /sent successfully/i);
    assert.doesNotMatch(composer, /delivered/i);
  });

  test("send action server module calls create_whatsapp_service_send_intent RPC", () => {
    const action = readFileSync(
      join(root, "src/features/whatsapp/server/whatsapp-send-actions.ts"),
      "utf8"
    );
    assert.match(action, /"use server"/);
    assert.match(action, /create_whatsapp_service_send_intent/);
    assert.match(action, /Provider dispatch is not active/i);
    assert.doesNotMatch(action, /graph\.facebook/i);
  });

  test("admin layout gates WhatsApp nav link by read permission", () => {
    const layout = readFileSync(
      join(root, "src/app/admin/layout.tsx"),
      "utf8"
    );
    assert.match(layout, /hasAnyWhatsappInboxReadPermission/);
    assert.match(layout, /\/admin\/whatsapp\/inbox/);
  });
});
