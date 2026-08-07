import { createKritiError } from "../contracts/errors.ts";
import type { KritiServerEnv } from "../server/kriti-env.ts";
import type { KritiProviderRequest } from "../contracts/provider.ts";
import type { KritiInferenceProvider, KritiProviderOutcome } from "./kriti-inference-provider.ts";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

interface GroqChatCompletionResponse {
  readonly choices?: readonly {
    readonly message?: { readonly content?: string | null };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: { readonly message?: string; readonly type?: string };
}

export function createKritiGroqProvider(env: KritiServerEnv): KritiInferenceProvider {
  if (!env.groqApiKey) {
    throw new Error("[ONEDECORE Kriti] Groq API key missing.");
  }

  return {
    code: "groq",
    async generate(request: KritiProviderRequest): Promise<KritiProviderOutcome> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

      try {
        const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: env.groqModel,
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          return {
            ok: false,
            error: createKritiError("KRITI_RATE_LIMITED", "Groq rate limit reached.", true),
          };
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          return {
            ok: false,
            error: createKritiError(
              "KRITI_PROVIDER_UNAVAILABLE",
              "Groq provider request failed.",
              retryable
            ),
          };
        }

        const payload = (await response.json()) as GroqChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          return {
            ok: false,
            error: createKritiError("KRITI_INVALID_OUTPUT", "Groq returned empty content.", false),
          };
        }

        return {
          ok: true,
          response: {
            requestId: request.requestId,
            rawJson: content,
            usage: {
              promptTokensApprox: payload.usage?.prompt_tokens ?? 0,
              completionTokensApprox: payload.usage?.completion_tokens ?? 0,
              totalTokensApprox: payload.usage?.total_tokens ?? 0,
            },
            providerCode: "groq",
          },
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return {
            ok: false,
            error: createKritiError("KRITI_TIMEOUT", "Groq request timed out.", true),
          };
        }
        return {
          ok: false,
          error: createKritiError("KRITI_PROVIDER_UNAVAILABLE", "Groq provider unavailable.", true),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
