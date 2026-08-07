/**
 * Phase 6C K0 — shared Kriti contract tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  isKritiTaskType,
  KRITI_ERROR_CODES,
  KRITI_FORBIDDEN_CALLBACK_NAMES,
  KRITI_TASK_TYPES,
  validateKritiStructuredOutput,
} from "../contracts/index.ts";

describe("Phase 6C K0 Kriti contracts", () => {
  test("task types cover ADR-0021 assistance set", () => {
    assert.equal(KRITI_TASK_TYPES.length, 9);
    assert.equal(isKritiTaskType("service_reply_draft"), true);
    assert.equal(isKritiTaskType("auto_send"), false);
  });

  test("service reply draft requires human review", () => {
    const output = validateKritiStructuredOutput("service_reply_draft", {
      draftText: "Hello, thank you for your message.",
      factsUsed: ["Customer asked about site visit"],
      missingFacts: [],
      warnings: ["Do not promise pricing"],
      humanReviewRequired: true,
      purpose: "service_reply",
    });
    assert.ok(output);
    if (output && "humanReviewRequired" in output) {
      assert.equal(output.humanReviewRequired, true);
    }
  });

  test("quotation wording rejects missing human review", () => {
    const output = validateKritiStructuredOutput("quotation_wording_draft", {
      draftText: "Updated scope wording only.",
      factsUsed: [],
      missingFacts: [],
      warnings: [],
      humanReviewRequired: false,
    });
    assert.equal(output, null);
  });

  test("malformed conversation summary fails closed", () => {
    assert.equal(
      validateKritiStructuredOutput("conversation_summary", { summary: "only" }),
      null
    );
  });

  test("error codes are normalized", () => {
    assert.equal(KRITI_ERROR_CODES.includes("KRITI_DISABLED"), true);
    assert.equal(KRITI_ERROR_CODES.includes("KRITI_INVALID_OUTPUT"), true);
  });

  test("forbidden callback names documented", () => {
    assert.equal(KRITI_FORBIDDEN_CALLBACK_NAMES.includes("autoSend"), true);
  });
});
