/**
 * Phase 6C K3 — Kriti assist UI contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { escapeKritiHtml } from "../ui/render-kriti-safe-text.ts";
import { deriveKritiPanelStatus } from "../ui/kriti-panel-state.ts";
import { buildKritiDisplayModel } from "../ui/extract-kriti-display.ts";
import type { KritiSuggestion } from "../contracts/result.ts";
import { KRITI_FORBIDDEN_CALLBACK_NAMES } from "../contracts/human-control.ts";

const root = process.cwd();

describe("Phase 6C K3 safe text rendering", () => {
  test("escapes HTML for XSS-safe display", () => {
    const escaped = escapeKritiHtml('<script>alert("x")</script>');
    assert.equal(escaped, "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    assert.doesNotMatch(escaped, /<script/i);
  });
});

describe("Phase 6C K3 panel state", () => {
  test("disabled when provider mode is off", () => {
    assert.equal(
      deriveKritiPanelStatus({ providerDisabled: true, loading: false, result: null }),
      "disabled"
    );
  });

  test("rate limited maps from error code", () => {
    assert.equal(
      deriveKritiPanelStatus({
        providerDisabled: false,
        loading: false,
        result: {
          ok: false,
          requestId: "r1",
          error: { code: "KRITI_RATE_LIMITED", message: "slow down", retryable: true },
        },
      }),
      "rate_limited"
    );
  });
});

describe("Phase 6C K3 display extraction", () => {
  test("service reply draft exposes insertable text", () => {
    const suggestion: KritiSuggestion = {
      taskType: "service_reply_draft",
      schemaName: "kriti.service_reply_draft.v1",
      humanReviewRequired: true,
      disclaimer: "review",
      output: {
        purpose: "service_reply",
        draftText: "Hello, thanks for reaching out.",
        factsUsed: ["Customer asked about timeline"],
        missingFacts: [],
        warnings: ["Do not promise delivery date"],
        humanReviewRequired: true,
      },
    };
    const model = buildKritiDisplayModel(suggestion);
    assert.equal(model.insertableDraft, "Hello, thanks for reaching out.");
    assert.equal(model.humanReviewRequired, true);
  });
});

describe("Phase 6C K3 human control contracts", () => {
  test("forbidden callback names exclude auto-send and mutation", () => {
    assert.ok(KRITI_FORBIDDEN_CALLBACK_NAMES.includes("autoSend"));
    assert.ok(KRITI_FORBIDDEN_CALLBACK_NAMES.includes("sendMessage"));
    assert.ok(KRITI_FORBIDDEN_CALLBACK_NAMES.includes("applyBusinessMutation"));
  });
});

describe("Phase 6C K3 component contracts", () => {
  test("assist panel uses human-control callbacks only", () => {
    const src = readFileSync(
      join(root, "src/features/kriti/components/KritiAssistPanel.tsx"),
      "utf8"
    );
    assert.match(src, /onInsertDraft/);
    assert.match(src, /onCopy/);
    assert.match(src, /onDismiss/);
    assert.doesNotMatch(src, /autoSend/);
    assert.doesNotMatch(src, /sendMessage/);
    assert.doesNotMatch(src, /createWhatsappServiceSendIntentAction/);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
  });

  test("inbox integration inserts into textarea only", () => {
    const src = readFileSync(
      join(root, "src/features/kriti/integrations/kriti-inbox-integration.ts"),
      "utf8"
    );
    assert.match(src, /textareaRef/);
    assert.match(src, /textarea\.value = text/);
    assert.doesNotMatch(src, /create_whatsapp_service_send_intent/);
  });

  test("quotation integration is wording-only", () => {
    const src = readFileSync(
      join(root, "src/features/kriti/integrations/kriti-quotation-integration.ts"),
      "utf8"
    );
    assert.match(src, /onInsertWordingDraft/);
    assert.doesNotMatch(src, /discount/i);
    assert.doesNotMatch(src, /applyBusinessMutation/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("provider status defaults to disabled messaging", () => {
    const src = readFileSync(
      join(root, "src/features/kriti/components/KritiProviderStatus.tsx"),
      "utf8"
    );
    assert.match(src, /Disabled \(default\)/);
    assert.match(src, /auto-send/);
  });

  test("runtime wires K2 prompts with K1 task engine", () => {
    const src = readFileSync(
      join(root, "src/features/kriti/server/create-kriti-runtime.ts"),
      "utf8"
    );
    assert.match(src, /buildKritiPrompts/);
    assert.match(src, /runKritiTask/);
    assert.match(src, /createNoOpKritiAuditSink/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("no kriti admin routes activated", () => {
    assert.equal(
      (() => {
        try {
          readFileSync(join(root, "src/app/admin/kriti/page.tsx"), "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});
