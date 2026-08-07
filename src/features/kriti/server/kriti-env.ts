import "server-only";

import type { KritiProviderCode, KritiProviderMode } from "../contracts/provider.ts";

export interface KritiServerEnv {
  readonly mode: KritiProviderMode;
  readonly providerCode: KritiProviderCode;
  readonly groqApiKey: string | null;
  readonly groqModel: string;
  readonly requestTimeoutMs: number;
}

const MODE_VALUES = new Set<KritiProviderMode>(["disabled", "local-test", "enabled"]);
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = 30_000;

function readOptional(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  name: string
): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE Kriti Env] ${code}`);
}

export function getKritiProviderMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): KritiProviderMode {
  const raw = (env.ONEDECORE_KRITI_MODE ?? "disabled").trim();
  if (!MODE_VALUES.has(raw as KritiProviderMode)) {
    return "disabled";
  }
  if (raw === "local-test" && env.NODE_ENV === "production") {
    return "disabled";
  }
  return raw as KritiProviderMode;
}

export function resolveKritiProviderCode(mode: KritiProviderMode): KritiProviderCode {
  return mode === "local-test" ? "fake" : "groq";
}

export function getKritiServerEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): KritiServerEnv {
  const mode = getKritiProviderMode(env);
  const groqModel = readOptional(env, "ONEDECORE_KRITI_GROQ_MODEL") ?? DEFAULT_MODEL;
  const timeoutRaw = readOptional(env, "ONEDECORE_KRITI_TIMEOUT_MS");
  const requestTimeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 120_000) {
    throw safeEnvError("ONEDECORE_KRITI_TIMEOUT_MS must be between 1000 and 120000.");
  }

  if (mode === "disabled") {
    return {
      mode,
      providerCode: "fake",
      groqApiKey: null,
      groqModel,
      requestTimeoutMs,
    };
  }

  if (mode === "local-test" && env.NODE_ENV === "production") {
    throw safeEnvError("local-test mode is forbidden in production.");
  }

  const groqApiKey = readOptional(env, "ONEDECORE_KRITI_GROQ_API_KEY");
  if (mode === "enabled") {
    if (!groqApiKey || groqApiKey.length < 16) {
      throw safeEnvError("ONEDECORE_KRITI_GROQ_API_KEY is required for enabled mode.");
    }
  }

  return {
    mode,
    providerCode: resolveKritiProviderCode(mode),
    groqApiKey: mode === "enabled" ? groqApiKey : null,
    groqModel,
    requestTimeoutMs,
  };
}
