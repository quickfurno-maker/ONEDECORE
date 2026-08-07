/**
 * Kriti provider mode contracts — mirrors WhatsApp outbound gating pattern.
 */

export const KRITI_PROVIDER_MODES = ["disabled", "local-test", "enabled"] as const;
export type KritiProviderMode = (typeof KRITI_PROVIDER_MODES)[number];

export const KRITI_PROVIDER_CODES = ["fake", "groq"] as const;
export type KritiProviderCode = (typeof KRITI_PROVIDER_CODES)[number];

export interface KritiUsage {
  readonly promptTokensApprox: number;
  readonly completionTokensApprox: number;
  readonly totalTokensApprox: number;
}

export interface KritiProviderRequest {
  readonly requestId: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly responseSchemaName: string;
  readonly timeoutMs: number;
}

export interface KritiProviderResponse {
  readonly requestId: string;
  readonly rawJson: string;
  readonly usage: KritiUsage;
  readonly providerCode: KritiProviderCode;
}
