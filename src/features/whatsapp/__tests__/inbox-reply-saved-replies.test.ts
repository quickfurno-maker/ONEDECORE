import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const THREAD = "src/features/whatsapp/components/inbox/InboxThread.tsx";
const REPLY_BUTTON =
  "src/features/whatsapp/components/inbox/InboxReplyButton.tsx";
const COMPOSER = "src/features/whatsapp/components/inbox/InboxComposer.tsx";
const COMPOSER_SECTION =
  "src/features/whatsapp/components/inbox/InboxComposerSection.tsx";
const SAVED =
  "src/features/whatsapp/components/inbox/InboxSavedReplies.tsx";
const SAVED_CONTRACT =
  "src/features/whatsapp/contracts/saved-replies.ts";
const SEND = "src/features/whatsapp/server/whatsapp-send-actions.ts";
const DISPATCH =
  "src/features/whatsapp/server/whatsapp-dispatch-service.ts";
const META =
  "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts";
const MIGRATION =
  "supabase/migrations/20260925165103_whatsapp_reply_to_dispatch.sql";

describe("P2 inbox reply-to", () => {
  test("thread exposes reply only through the small client control", () => {
    const thread = read(THREAD);
    const button = read(REPLY_BUTTON);
    assert.match(thread, /canReply \? \(/);
    assert.match(thread, /messageId: message\.id/);
    assert.match(thread, /previewForMessage\(message\.presentation\)/);
    assert.match(button, /WHATSAPP_REPLY_SELECT_EVENT/);
    assert.doesNotMatch(thread, /"use client"/);
  });

  test("composer carries only the local message id back to the governed send action", () => {
    const composer = read(COMPOSER);
    assert.match(composer, /name="replyToMessageId"/);
    const section = read(COMPOSER_SECTION);
    assert.match(section, /whatsapp-reply-selection/);
    assert.match(section, /Cancel reply/);
    assert.match(section, /WHATSAPP_REPLY_SELECT_EVENT/);
    const send = read(SEND);
    assert.match(send, /formData\.get\("replyToMessageId"\)/);
    assert.match(send, /p_reply_to_message_id: replyToMessageId \?\? undefined/);
  });

  test("provider wamid resolution happens server-side after dispatch claim", () => {
    const src = read(DISPATCH);
    assert.match(src, /reply_to_message_id/);
    assert.match(src, /\.from\('whatsapp_messages'\)/);
    assert.match(src, /provider_message_id, conversation_id/);
    assert.match(src, /replyRow\.conversation_id !== claim\.conversation_id/);
    assert.match(src, /replyToProviderMessageId = replyRow\.provider_message_id/);
  });

  test("Meta text payload uses official context.message_id only when replying", () => {
    const src = read(META);
    assert.match(src, /context: \{ message_id: request\.replyToProviderMessageId \}/);
    assert.match(src, /request\.replyToProviderMessageId/);
  });

  test("bound outbound evidence preserves quoted provider context", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /v_intent\.reply_to_message_id/);
    assert.match(sql, /context_provider_message_id/);
    assert.match(sql, /v_reply_provider_message_id/);
    assert.match(sql, /m\.conversation_id = v_intent\.conversation_id/);
  });
});

describe("P2 saved replies", () => {
  test("saved replies insert drafts and never send on their own", () => {
    const component = read(SAVED);
    assert.match(component, /textareaRef\.current/);
    assert.match(component, /node\.value = body/);
    assert.match(component, /new Event\("input"/);
    assert.doesNotMatch(
      component,
      /server\/|sendIntent|dispatchWhatsapp|dispatchTextMessage|fetch\(/
    );
  });

  test("the library is mounted for users who may reply", () => {
    const section = read(COMPOSER_SECTION);
    assert.match(section, /canUse \? <InboxSavedReplies/);
    const contract = read(SAVED_CONTRACT);
    for (const id of [
      "welcome",
      "service-location",
      "consultation",
      "site-visit",
      "quotation-followup",
      "thanks",
    ]) {
      assert.match(contract, new RegExp(`id: "${id}"`));
    }
  });

  test("saved replies do not create marketing consent or templates", () => {
    const contract = read(SAVED_CONTRACT);
    assert.doesNotMatch(contract, /MARKETING|consent_events|template/i);
  });
});
