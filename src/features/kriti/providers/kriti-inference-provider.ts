import type { KritiProviderRequest, KritiProviderResponse } from "../contracts/provider.ts";
import type { KritiError } from "../contracts/errors.ts";

export type KritiProviderOutcome =
  | { readonly ok: true; readonly response: KritiProviderResponse }
  | { readonly ok: false; readonly error: KritiError };

export interface KritiInferenceProvider {
  readonly code: "fake" | "groq";
  readonly generate: (request: KritiProviderRequest) => Promise<KritiProviderOutcome>;
}
