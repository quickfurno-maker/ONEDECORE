import "server-only";

export const COMMERCE_AUTOMATION_ENABLED_ENV = "ONEDECORE_COMMERCE_AUTOMATION_ENABLED";
export const COMMERCE_AUTOMATION_WORKER_SECRET_ENV = "ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET";

export function isCommerceAutomationEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[COMMERCE_AUTOMATION_ENABLED_ENV] === "true";
}

export function getCommerceAutomationWorkerSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | null {
  const secret = env[COMMERCE_AUTOMATION_WORKER_SECRET_ENV]?.trim();
  if (!secret || secret.length < 32) return null;
  return secret;
}
