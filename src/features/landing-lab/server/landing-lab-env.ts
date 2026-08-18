import "server-only";

export const LANDING_LAB_PUBLIC_ENABLED_ENV = "ONEDECORE_LANDING_LAB_PUBLIC_ENABLED";
export const LANDING_LAB_HMAC_SECRET_ENV = "ONEDECORE_LANDING_LAB_HMAC_SECRET";
export const LP_VISITOR_COOKIE_NAME = "od_lp_visitor";
export const LP_VISITOR_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function isLandingLabPublicEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[LANDING_LAB_PUBLIC_ENABLED_ENV] === "true";
}

export function getLandingLabHmacSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | null {
  const dedicated = env[LANDING_LAB_HMAC_SECRET_ENV]?.trim() ?? "";
  if (dedicated.length >= 32) return dedicated;
  const shared = env.ONEDECORE_LEAD_HASH_SECRET?.trim() ?? "";
  if (shared.length >= 32) return shared;
  return null;
}
