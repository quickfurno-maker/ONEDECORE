import { createHash } from "node:crypto";
import type { KritiAuditSink } from "../contracts/audit.ts";
import type { KritiRequest } from "../contracts/context.ts";
import { createKritiError } from "../contracts/errors.ts";
import type { KritiResult, KritiSuggestion } from "../contracts/result.ts";
import {
  KRITI_HUMAN_CONTROL_DISCLAIMER,
} from "../contracts/human-control.ts";
import {
  KRITI_TASK_SCHEMA_NAMES,
  validateKritiStructuredOutput,
} from "../contracts/task-schemas.ts";
import type { KritiInferenceProvider } from "../providers/kriti-inference-provider.ts";
import type { KritiPromptBundle } from "./kriti-prompt-stub.ts";
import { buildKritiPromptStub } from "./kriti-prompt-stub.ts";
import type { KritiServerEnv } from "./kriti-env.ts";

export interface KritiTaskRunnerDeps {
  readonly env: KritiServerEnv;
  readonly provider: KritiInferenceProvider | null;
  readonly buildPrompts?: (request: KritiRequest) => KritiPromptBundle;
  readonly auditSink?: KritiAuditSink;
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requiresHumanReview(taskType: KritiRequest["taskType"]): boolean {
  return taskType !== "conversation_summary" && taskType !== "missing_information";
}

export async function runKritiTask(
  request: KritiRequest,
  deps: KritiTaskRunnerDeps
): Promise<KritiResult> {
  const audit = deps.auditSink;
  if (audit) {
    await audit.record({
      eventType: "kriti.request",
      requestId: request.requestId,
      taskType: request.taskType,
      requestedAt: request.requestedAt,
      contextHash: hashValue(request.context),
    });
  }

  if (deps.env.mode === "disabled" || deps.provider == null) {
    return {
      ok: false,
      requestId: request.requestId,
      error: createKritiError("KRITI_DISABLED", "Kriti is disabled.", false),
    };
  }

  const prompts = (deps.buildPrompts ?? buildKritiPromptStub)(request);
  const providerOutcome = await deps.provider.generate({
    requestId: request.requestId,
    model: deps.env.groqModel,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    responseSchemaName: prompts.responseSchemaName,
    timeoutMs: deps.env.requestTimeoutMs,
  });

  if (!providerOutcome.ok) {
    if (audit) {
      await audit.record({
        eventType: "kriti.request_failed",
        requestId: request.requestId,
        code: providerOutcome.error.code,
        occurredAt: new Date().toISOString(),
      });
    }
    return { ok: false, requestId: request.requestId, error: providerOutcome.error };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(providerOutcome.response.rawJson);
  } catch {
    const error = createKritiError("KRITI_INVALID_OUTPUT", "Provider output was not valid JSON.", false);
    if (audit) {
      await audit.record({
        eventType: "kriti.request_failed",
        requestId: request.requestId,
        code: error.code,
        occurredAt: new Date().toISOString(),
      });
    }
    return {
      ok: false,
      requestId: request.requestId,
      error,
    };
  }

  const structured = validateKritiStructuredOutput(request.taskType, parsed);
  if (!structured) {
    const error = createKritiError("KRITI_INVALID_OUTPUT", "Provider output failed schema validation.", false);
    if (audit) {
      await audit.record({
        eventType: "kriti.request_failed",
        requestId: request.requestId,
        code: error.code,
        occurredAt: new Date().toISOString(),
      });
    }
    return {
      ok: false,
      requestId: request.requestId,
      error,
    };
  }

  const suggestion: KritiSuggestion = {
    taskType: request.taskType,
    schemaName: KRITI_TASK_SCHEMA_NAMES[request.taskType],
    output: structured,
    humanReviewRequired: requiresHumanReview(request.taskType) || "humanReviewRequired" in structured
      ? Boolean((structured as { humanReviewRequired?: boolean }).humanReviewRequired ?? true)
      : false,
    disclaimer: KRITI_HUMAN_CONTROL_DISCLAIMER,
  };

  if (audit) {
    await audit.record({
      eventType: "kriti.suggestion",
      requestId: request.requestId,
      taskType: request.taskType,
      schemaName: suggestion.schemaName,
      resultHash: hashValue(structured),
      occurredAt: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    requestId: request.requestId,
    suggestion,
    usage: providerOutcome.response.usage,
  };
}
