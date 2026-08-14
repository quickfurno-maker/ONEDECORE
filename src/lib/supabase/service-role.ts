import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

function readRequired(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`[ONEDECORE Admin] Missing required environment variable ${name}.`);
  }
  return value.trim();
}

function resolveSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  if (!url) {
    throw new Error("[ONEDECORE Admin] Missing required Supabase URL.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
  } catch {
    throw new Error("[ONEDECORE Admin] Invalid Supabase URL.");
  }
  return url;
}

/**
 * Fail-closed service-role client. No dummy keys. Independent of NODE_ENV.
 */
export function createAdminClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = readRequired("SUPABASE_SERVICE_ROLE_KEY");

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("[ONEDECORE Admin] Publishable key rejected in SUPABASE_SERVICE_ROLE_KEY slot.");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
