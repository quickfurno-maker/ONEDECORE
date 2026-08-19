import "server-only";

import {
  CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED,
  CAMPAIGN_EXECUTION_MOCK_SCENARIO_ENV,
  getCampaignExecutionMode,
} from "./execution-env.ts";
import { MockCampaignExecutionProvider, parseMockScenario } from "./mock-provider.ts";
import type { CampaignExecutionProvider } from "./provider-port.ts";

export function resolveCampaignExecutionProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
):
  | { readonly ok: true; readonly provider: CampaignExecutionProvider }
  | { readonly ok: false; readonly code: string } {
  const mode = getCampaignExecutionMode(env);
  if (mode === "disabled") {
    return { ok: false, code: "CAMPAIGN_EXECUTION_DISABLED" };
  }
  if (mode === "sandbox" || mode === "live") {
    return { ok: false, code: CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED };
  }
  const scenario = parseMockScenario(env[CAMPAIGN_EXECUTION_MOCK_SCENARIO_ENV]);
  return { ok: true, provider: new MockCampaignExecutionProvider(scenario) };
}
