import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  INBOX_MESSAGE_PUBLIC_KEYS,
  WHATSAPP_MESSAGE_ORIGIN_KINDS,
} from "../contracts/conversation-dtos.ts";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MIGRATION =
  "supabase/migrations/20260926041623_whatsapp_inbox_message_origin.sql";
const QUERY = "src/features/whatsapp/server/whatsapp-inbox-queries.ts";
const THREAD = "src/features/whatsapp/components/inbox/InboxThread.tsx";

describe("P2 inbox outbound message origin", () => {
  test("the projection is read-only and scoped to the same inbox visibility rule", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /auth\.uid\(\) is null/);
    assert.match(sql, /cardinality\(p_message_ids\) > 100/);
    assert.match(sql, /private\.whatsapp_inbox_can_view_conversation/);
    assert.match(sql, /m\.direction = 'outbound'/);
    assert.doesNotMatch(sql, /insert into|update public|delete from/i);
  });

  test("origin comes only from existing attribution evidence", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /whatsapp_message_automation_attributions/);
    assert.match(sql, /whatsapp_message_campaign_attributions/);
    assert.match(sql, /whatsapp_template_send_intents/);
    assert.match(sql, /whatsapp_template_snapshots/);
    assert.match(sql, /whatsapp_automations/);
    assert.match(sql, /campaign_versions/);
    assert.match(sql, /campaigns/);
  });

  test("the exposed wrapper is invoker-only while the private authority checks access", () => {
    const sql = read(MIGRATION);
    assert.match(
      sql,
      /public\.get_whatsapp_inbox_message_origins[\s\S]*security invoker/
    );
    assert.match(
      sql,
      /revoke all on function public\.get_whatsapp_inbox_message_origins\(uuid\[\]\)[\s\S]*from public, anon/
    );
    assert.match(
      sql,
      /grant execute on function public\.get_whatsapp_inbox_message_origins\(uuid\[\]\)[\s\S]*to authenticated/
    );
    assert.doesNotMatch(sql, /grant .*campaigns|grant .*automations/i);
  });

  test("the message DTO carries only the bounded origin projection", () => {
    assert.deepEqual(WHATSAPP_MESSAGE_ORIGIN_KINDS, [
      "campaign",
      "automation",
      "utility_template",
    ]);
    assert.ok(INBOX_MESSAGE_PUBLIC_KEYS.includes("origin"));
    const contracts = read(
      "src/features/whatsapp/contracts/conversation-dtos.ts"
    );
    assert.match(contracts, /origin: WhatsappMessageOrigin \| null/);
    assert.match(contracts, /origin: null/);
  });

  test("the caller-session message query batches origin lookups for outbound rows only", () => {
    const src = read(QUERY);
    assert.match(src, /item\.direction === "outbound"/);
    assert.match(src, /get_whatsapp_inbox_message_origins/);
    assert.match(src, /p_message_ids: outboundIds/);
    assert.match(src, /origins\.get\(item\.id\) \?\? null/);
    assert.doesNotMatch(src, /createAdminClient|service_role|SERVICE_ROLE/);
  });

  test("the thread visibly distinguishes campaign automation and utility-template messages", () => {
    const src = read(THREAD);
    assert.match(src, /"Automation"/);
    assert.match(src, /"Campaign"/);
    assert.match(src, /"Utility template"/);
    assert.match(src, /data-origin-kind=\{origin\.kind\}/);
    assert.match(src, /origin\.label/);
    assert.match(src, /suppressTemplateTag/);
  });
});
