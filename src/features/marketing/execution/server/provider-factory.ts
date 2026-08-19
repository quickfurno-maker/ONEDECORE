import "server-only";

import {
  CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED,
  CAMPAIGN_EXECUTION_MOCK_SCENARIO_ENV,
  getCampaignExecutionMode,
} from "./execution-env.ts";
import {
  isCampaignProductionEnabled,
  isCampaignSandboxTransportEnabled,
  resolveGoogleAdsProviderConfig,
  resolveMetaAdsProviderConfig,
} from "./provider-config.ts";
import { MockCampaignExecutionProvider, parseMockScenario } from "./mock-provider.ts";
import { MetaAdsCampaignExecutionProvider } from "./meta-ads-provider.ts";
import { GoogleAdsCampaignExecutionProvider } from "./google-ads-provider.ts";
import { createFetchProviderHttpTransport, type ProviderHttpTransport } from "./provider-http.ts";
import type { CampaignExecutionProvider } from "./provider-port.ts";
import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";

export const CAMPAIGN_PRODUCTION_GATE_OFF = "CAMPAIGN_PRODUCTION_GATE_OFF";
export const CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE = "CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE";

export function resolveCampaignExecutionProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options?: {
    readonly channel?: PaidAdsChannel;
    readonly transport?: ProviderHttpTransport;
  }
):
  | { readonly ok: true; readonly provider: CampaignExecutionProvider }
  | { readonly ok: false; readonly code: string } {
  const mode = getCampaignExecutionMode(env);
  if (mode === "disabled") {
    return { ok: false, code: "CAMPAIGN_EXECUTION_DISABLED" };
  }
  if (mode === "mock") {
    const scenario = parseMockScenario(env[CAMPAIGN_EXECUTION_MOCK_SCENARIO_ENV]);
    return { ok: true, provider: new MockCampaignExecutionProvider(scenario) };
  }

  if (mode === "live" && !isCampaignProductionEnabled(env)) {
    return { ok: false, code: CAMPAIGN_PRODUCTION_GATE_OFF };
  }
  if (mode === "sandbox" && !isCampaignSandboxTransportEnabled(env)) {
    return { ok: false, code: CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE };
  }

  const channel = options?.channel ?? "meta_ads";
  const transport =
    options?.transport ?? createFetchProviderHttpTransport({ allowLiveHosts: false });

  if (channel === "meta_ads") {
    const config = resolveMetaAdsProviderConfig(env);
    if (!config.ok) return config;
    return { ok: true, provider: new MetaAdsCampaignExecutionProvider(config.config, transport, env) };
  }

  const config = resolveGoogleAdsProviderConfig(env);
  if (!config.ok) return config;
  return { ok: true, provider: new GoogleAdsCampaignExecutionProvider(config.config, transport, env) };
}

export { CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED };
