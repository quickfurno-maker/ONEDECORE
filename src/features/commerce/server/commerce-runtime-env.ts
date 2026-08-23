import "server-only";

export interface CommerceRuntimeEnv {
  readonly publicRuntimeSecret: string;
}

function safeEnvError(code: string): Error {
  return new Error(`[ONEDECORE Commerce Runtime] ${code}`);
}

export function getCommerceRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env
): CommerceRuntimeEnv {
  const publicRuntimeSecret = env.ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET?.trim() ?? "";
  if (publicRuntimeSecret.length < 32) {
    throw safeEnvError("ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET_REQUIRED");
  }
  return { publicRuntimeSecret };
}
