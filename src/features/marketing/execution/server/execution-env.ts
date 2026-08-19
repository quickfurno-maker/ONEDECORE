import "server-only";

import { CAMPAIGN_EXECUTION_MODES, type CampaignExecutionMode } from "../contracts/execution-mode.ts";

export const CAMPAIGN_EXECUTION_MODE_ENV = "ONEDECORE_CAMPAIGN_EXECUTION_MODE";
export const CAMPAIGN_EXECUTION_HMAC_SECRET_ENV = "ONEDECORE_CAMPAIGN_EXECUTION_HMAC_SECRET";
export const CAMPAIGN_EXECUTION_WORKER_SECRET_ENV = "ONEDECORE_CAMPAIGN_EXECUTION_WORKER_SECRET";
export const PROVIDER_DATA_SHARING_ENABLED_ENV = "ONEDECORE_PROVIDER_DATA_SHARING_ENABLED";
export const CAMPAIGN_EXECUTION_MOCK_SCENARIO_ENV = "ONEDECORE_CAMPAIGN_EXECUTION_MOCK_SCENARIO";

export const CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED =
  "CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED";

function readOptional(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  name: string
): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE Campaign Execution Env] ${code}`);
}

export function getCampaignExecutionMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): CampaignExecutionMode {
  const raw = (env[CAMPAIGN_EXECUTION_MODE_ENV] ?? "disabled").trim();
  if (!(CAMPAIGN_EXECUTION_MODES as readonly string[]).includes(raw)) {
    return "disabled";
  }
  return raw as CampaignExecutionMode;
}

export function isProviderDataSharingEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[PROVIDER_DATA_SHARING_ENABLED_ENV] === "true";
}

export function getCampaignExecutionHmacSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | null {
  const dedicated = readOptional(env, CAMPAIGN_EXECUTION_HMAC_SECRET_ENV);
  if (!dedicated || dedicated.length < 32) return null;
  const landing = readOptional(env, "ONEDECORE_LANDING_LAB_HMAC_SECRET");
  if (landing && dedicated === landing) {
    return null;
  }
  return dedicated;
}

export function getCampaignExecutionWorkerSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | null {
  const secret = readOptional(env, CAMPAIGN_EXECUTION_WORKER_SECRET_ENV);
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function assertCampaignExecutionModeForDispatch(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): CampaignExecutionMode {
  const raw = (env[CAMPAIGN_EXECUTION_MODE_ENV] ?? "disabled").trim();
  if (!(CAMPAIGN_EXECUTION_MODES as readonly string[]).includes(raw)) {
    throw safeEnvError("Invalid ONEDECORE_CAMPAIGN_EXECUTION_MODE.");
  }
  return raw as CampaignExecutionMode;
}
