import { createKritiError, type KritiError } from "../contracts/errors.ts";
import type { KritiProviderRequest } from "../contracts/provider.ts";
import type { KritiInferenceProvider, KritiProviderOutcome } from "./kriti-inference-provider.ts";

export type KritiFakeScenario =
  | "success"
  | "malformed_output"
  | "timeout"
  | "rate_limited"
  | "transient_error"
  | "terminal_error"
  | "safety_refusal"
  | "oversized_context";

export interface KritiFakeProviderOptions {
  readonly scenario?: KritiFakeScenario;
}

function successPayload(schemaName: string): string {
  if (schemaName.includes("service_reply_draft")) {
    return JSON.stringify({
      draftText: "Thank you for your message. We will review your request and respond shortly.",
      factsUsed: ["Customer asked about next steps"],
      missingFacts: ["Preferred site visit date"],
      warnings: ["Do not promise pricing or discounts"],
      humanReviewRequired: true,
      purpose: "service_reply",
    });
  }
  return JSON.stringify({
    summary: "Synthetic conversation summary for local-test.",
    facts: [{ text: "Customer asked about modular kitchen scope", confidence: "fact" }],
    openQuestions: ["Preferred timeline"],
    risks: ["Do not invent pricing"],
  });
}

export function createKritiFakeProvider(
  options: KritiFakeProviderOptions = {}
): KritiInferenceProvider {
  const scenario = options.scenario ?? "success";

  return {
    code: "fake",
    async generate(request: KritiProviderRequest): Promise<KritiProviderOutcome> {
      const fail = (error: KritiError): KritiProviderOutcome => ({ ok: false, error });

      switch (scenario) {
        case "malformed_output":
          return {
            ok: true,
            response: {
              requestId: request.requestId,
              rawJson: "{not-json",
              usage: { promptTokensApprox: 10, completionTokensApprox: 1, totalTokensApprox: 11 },
              providerCode: "fake",
            },
          };
        case "timeout":
          return fail(createKritiError("KRITI_TIMEOUT", "Fake provider timeout.", true));
        case "rate_limited":
          return fail(createKritiError("KRITI_RATE_LIMITED", "Fake provider rate limited.", true));
        case "transient_error":
          return fail(
            createKritiError("KRITI_PROVIDER_UNAVAILABLE", "Fake transient provider error.", true)
          );
        case "terminal_error":
          return fail(
            createKritiError("KRITI_PROVIDER_UNAVAILABLE", "Fake terminal provider error.", false)
          );
        case "safety_refusal":
          return fail(createKritiError("KRITI_SAFETY_REFUSAL", "Fake safety refusal.", false));
        case "oversized_context":
          return fail(createKritiError("KRITI_CONTEXT_TOO_LARGE", "Fake oversized context.", false));
        case "success":
        default:
          return {
            ok: true,
            response: {
              requestId: request.requestId,
              rawJson: successPayload(request.responseSchemaName),
              usage: { promptTokensApprox: 120, completionTokensApprox: 80, totalTokensApprox: 200 },
              providerCode: "fake",
            },
          };
      }
    },
  };
}
