/**
 * Shared local-only guards for Phase 5C1 owner QA scripts.
 * Not for managed Supabase or production hosts.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * @returns {string}
 */
export function requireQaPassword() {
  const password = process.env.PHASE_5C1_QA_PASSWORD;
  if (!password || password.trim().length === 0) {
    throw new Error(
      "PHASE_5C1_QA_PASSWORD is required. Set it in your shell before running Phase 5C1 owner QA scripts."
    );
  }
  return password;
}

/**
 * @param {string} rawUrl
 * @param {string} label
 */
export function assertLocalSupabaseUrl(rawUrl, label = "Supabase API URL") {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https. Refusing non-local host: ${parsed.hostname}`);
  }

  if (!LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `${label} must target local Supabase (localhost or 127.0.0.1). Refusing: ${parsed.hostname}`
    );
  }
}

/**
 * @param {string} rawUrl
 * @param {string} label
 */
export function assertLocalAppUrl(rawUrl, label = "Application base URL") {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL: ${rawUrl}`);
  }

  if (!LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `${label} must target local development (localhost or 127.0.0.1). Refusing: ${parsed.hostname}`
    );
  }
}
