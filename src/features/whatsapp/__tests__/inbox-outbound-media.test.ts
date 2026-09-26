import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  WHATSAPP_OUTBOUND_FILE_MAX_BYTES,
  WHATSAPP_OUTBOUND_IMAGE_MAX_BYTES,
  whatsappOutboundMediaKindForMime,
  whatsappOutboundMediaMaxBytes,
} from "../contracts/outbound-media.ts";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const ACTIONS = "src/features/whatsapp/server/whatsapp-send-actions.ts";
const DISPATCH = "src/features/whatsapp/server/whatsapp-dispatch-service.ts";
const STORAGE = "src/features/whatsapp/server/whatsapp-outbound-media.ts";
const PROVIDER = "src/features/whatsapp/server/whatsapp-provider-adapter.ts";
const META = "src/features/whatsapp/server/whatsapp-meta-provider-adapter.ts";
const UI = "src/features/whatsapp/components/inbox/InboxAttachmentComposer.tsx";
const SECTION = "src/features/whatsapp/components/inbox/InboxComposerSection.tsx";
const CONFIG = "next.config.ts";
const MIGRATION =
  "supabase/migrations/20260926040425_whatsapp_outbound_media_intents.sql";

describe("P2 outbound media contract", () => {
  test("the allowlist and size ceilings are explicit and bounded", () => {
    assert.equal(whatsappOutboundMediaKindForMime("image/jpeg"), "image");
    assert.equal(whatsappOutboundMediaKindForMime("image/png"), "image");
    assert.equal(whatsappOutboundMediaKindForMime("image/webp"), "image");
    assert.equal(whatsappOutboundMediaKindForMime("application/pdf"), "document");
    assert.equal(whatsappOutboundMediaKindForMime("video/mp4"), "video");
    assert.equal(whatsappOutboundMediaKindForMime("image/svg+xml"), null);
    assert.equal(whatsappOutboundMediaKindForMime("text/html"), null);
    assert.equal(
      whatsappOutboundMediaMaxBytes("image"),
      WHATSAPP_OUTBOUND_IMAGE_MAX_BYTES
    );
    assert.equal(
      whatsappOutboundMediaMaxBytes("document"),
      WHATSAPP_OUTBOUND_FILE_MAX_BYTES
    );
    assert.ok(WHATSAPP_OUTBOUND_FILE_MAX_BYTES <= 16 * 1024 * 1024);
  });

  test("Next Server Actions are sized above the attachment ceiling", () => {
    const config = read(CONFIG);
    assert.match(config, /serverActions:[\s\S]*bodySizeLimit: "21mb"/);
  });

  test("the browser never receives storage credentials or uploads directly", () => {
    const ui = read(UI);
    const storage = read(STORAGE);
    assert.doesNotMatch(ui, /createAdminClient|service.role|storage\.from|supabase/i);
    assert.match(storage, /createAdminClient/);
    assert.match(storage, /WHATSAPP_OUTBOUND_MEDIA_BUCKET/);
    assert.match(storage, /hashWhatsappOutboundMedia/);
    assert.match(storage, /WHATSAPP_MEDIA_CHECKSUM_MISMATCH/);
  });

  test("attachment action rechecks conversation scope before private upload", () => {
    const src = read(ACTIONS);
    const accessAt = src.indexOf("canCurrentUserAccessConversation(conversationId, \"use\")");
    const uploadAt = src.indexOf("const upload = await uploadWhatsappOutboundMedia");
    assert.ok(accessAt >= 0);
    assert.ok(uploadAt > accessAt);
    assert.match(src, /validateWhatsappOutboundMedia/);
    assert.match(src, /create_whatsapp_service_media_send_intent/);
    assert.match(src, /deleteWhatsappOutboundMediaBestEffort/);
    assert.match(src, /WHATSAPP_SERVICE_PURPOSE_CODE/);
  });

  test("media dispatch verifies private bytes before the provider adapter", () => {
    const src = read(DISPATCH);
    assert.match(src, /get_whatsapp_media_dispatch_payload/);
    assert.match(src, /downloadVerifiedWhatsappOutboundMedia/);
    assert.match(src, /dispatchMediaMessage/);
    assert.ok(
      src.indexOf("downloadVerifiedWhatsappOutboundMedia") <
        src.indexOf("provider.dispatchMediaMessage")
    );
    assert.match(src, /media_download_verify/);
    assert.match(src, /record_whatsapp_dispatch_attempt_outcome/);
  });

  test("provider port and Meta adapter support only image document and video media", () => {
    const provider = read(PROVIDER);
    const meta = read(META);
    assert.match(provider, /dispatchMediaMessage/);
    assert.match(meta, /\/media/);
    assert.match(meta, /type: request\.mediaKind/);
    assert.match(meta, /context: \{ message_id: request\.replyToProviderMessageId \}/);
    assert.doesNotMatch(meta, /audio[\s\S]*dispatchMediaMessage/);
  });

  test("the migration keeps the bucket private and never exposes object paths in messages", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /'whatsapp-outbound-media'[\s\S]*false/);
    assert.match(sql, /allowed_mime_types/);
    assert.match(sql, /message_kind in \('text', 'image', 'document', 'video'\)/);
    assert.match(sql, /service_window_media/);
    assert.match(sql, /whatsapp_inbox_can_use_conversation/);
    assert.match(sql, /whatsapp_evaluate_service_send_eligibility/);
    assert.match(sql, /consent_mutation_forbidden/);
    assert.match(sql, /provider_message_fabrication_forbidden/);
    assert.match(sql, /media_object_path/);
    const binder = sql.slice(sql.lastIndexOf("create or replace function public.bind_whatsapp_send_intent_dispatch"));
    assert.match(binder, /v_intent\.message_kind/);
    assert.match(binder, /context_provider_message_id/);
    assert.doesNotMatch(binder, /media_object_path[\s\S]*insert into public\.whatsapp_messages/i);
  });

  test("attachment UI shares reply context and disappears outside the service window", () => {
    const ui = read(UI);
    const section = read(SECTION);
    assert.match(ui, /if \(!serviceWindow\.open\) \{\s*return null/);
    assert.match(ui, /name="mediaFile"/);
    assert.match(ui, /name="caption"/);
    assert.match(ui, /name="replyToMessageId"/);
    assert.match(section, /replyToMessageId=\{replySelection\?\.messageId \?\? null\}/);
    assert.match(section, /onAcceptedSend=\{clearReply\}/);
  });

  test("media work never enables provider or marketing execution", () => {
    for (const path of [ACTIONS, DISPATCH, MIGRATION]) {
      const src = read(path);
      assert.doesNotMatch(src, /marketing_execution_enabled\s*=\s*true/i);
      assert.doesNotMatch(src, /WHATSAPP_OUTBOUND_MODE\s*=\s*enabled/i);
    }
  });
});
