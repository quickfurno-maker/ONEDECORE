import "server-only";

export const LANDING_LAB_PUBLIC_ENABLED_ENV = "ONEDECORE_LANDING_LAB_PUBLIC_ENABLED";
export const LANDING_LAB_HMAC_SECRET_ENV = "ONEDECORE_LANDING_LAB_HMAC_SECRET";
/** Non-production only. Never consulted when NODE_ENV is production. */
export const LANDING_LAB_HMAC_TEST_SECRET_ENV =
  "ONEDECORE_LANDING_LAB_HMAC_TEST_SECRET";
export const LP_VISITOR_COOKIE_NAME = "od_lp_visitor";
export const LP_VISITOR_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function isLandingLabPublicEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[LANDING_LAB_PUBLIC_ENABLED_ENV] === "true";
}

/**
 * The Landing Lab signing secret. ITS OWN, NEVER THE LEAD SECRET.
 *
 * This used to fall back to `ONEDECORE_LEAD_HASH_SECRET` whenever the
 * dedicated variable was unset — in production as well as locally. Two
 * unrelated domains then shared one key: the same secret that fingerprints
 * lead phone numbers also signed the publication contexts that decide which
 * campaign a lead is attributed to. One compromised or rotated value would
 * have silently broken or forged the other, and nothing in the system would
 * have said so, because the fallback was indistinguishable from correct
 * configuration.
 *
 * Missing now means missing. `resolveTrustedLandingIdentity` already refuses
 * to attribute a lead when this returns null, so absent configuration fails
 * closed: the enquiry is still accepted, it simply carries no landing
 * attribution it cannot prove.
 *
 * Outside production a loopback stack may use `ONEDECORE_LANDING_LAB_HMAC_TEST_SECRET`
 * so fixtures can sign contexts without provisioning a real secret. That is an
 * explicit test fixture, not a silent reuse of a production key.
 */
export function getLandingLabHmacSecret(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string | null {
  const dedicated = env[LANDING_LAB_HMAC_SECRET_ENV]?.trim() ?? "";
  if (dedicated.length >= 32) return dedicated;

  if (env.NODE_ENV !== "production") {
    const fixture = env[LANDING_LAB_HMAC_TEST_SECRET_ENV]?.trim() ?? "";
    if (fixture.length >= 32) return fixture;
  }

  return null;
}
