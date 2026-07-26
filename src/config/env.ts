/**
 * ONEDECORE Public Environment Configuration
 * Validates public Supabase configuration values at runtime without logging credential values.
 */

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[ONEDECORE Env Error] Missing required public environment variable: ${name}`
    );
  }
  return value.trim();
}

function validateSupabaseUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const isLocal =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      process.env.NODE_ENV !== "production";

    if (!isLocal) {
      if (parsed.protocol !== "https:") {
        throw new Error(
          `[ONEDECORE Env Error] NEXT_PUBLIC_SUPABASE_URL must use HTTPS protocol.`
        );
      }
      if (parsed.hostname !== "lpurlfmpvriyvpkujvyl.supabase.co") {
        throw new Error(
          `[ONEDECORE Env Error] Invalid NEXT_PUBLIC_SUPABASE_URL hostname. Expected lpurlfmpvriyvpkujvyl.supabase.co`
        );
      }
    }
    return parsed.origin;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[ONEDECORE Env Error]")) {
      throw err;
    }
    throw new Error(
      `[ONEDECORE Env Error] Malformed NEXT_PUBLIC_SUPABASE_URL format.`
    );
  }
}

function validatePublishableKey(keyStr: string): string {
  const isLocal = keyStr.startsWith("eyJ") || process.env.NODE_ENV !== "production";
  if (!keyStr.startsWith("sb_publishable_") && !isLocal) {
    throw new Error(
      `[ONEDECORE Env Error] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must begin with 'sb_publishable_' prefix.`
    );
  }
  return keyStr;
}

export function getPublicSupabaseEnv(): {
  url: string;
  publishableKey: string;
} {
  const rawUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const rawKey = getEnvVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return {
    url: validateSupabaseUrl(rawUrl),
    publishableKey: validatePublishableKey(rawKey),
  };
}
