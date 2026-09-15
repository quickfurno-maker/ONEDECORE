import "server-only";

import { isLoopbackSupabaseUrl, isManagedOneDecoreSupabaseUrl } from "../../../config/server-env.ts";

/**
 * WM-5 — server-only environment for the public click redirect.
 *
 *   ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE   disabled | local-test | enabled (default disabled)
 *   ONEDECORE_WHATSAPP_CLICK_ALLOWED_HOSTS   comma-separated extra redirect hosts
 *   NEXT_PUBLIC_APP_URL                      site origin: the fallback and an allowed host
 *
 * Disabled or misconfigured means every token redirects to the site home and
 * nothing is recorded. The service-role key never leaves this module's caller.
 */

export type WhatsappClickTrackingMode = "disabled" | "local-test" | "enabled";

export interface WhatsappClickServerEnv {
  readonly mode: WhatsappClickTrackingMode;
  readonly supabaseUrl: string | null;
  readonly serviceRoleKey: string | null;
  readonly siteUrl: string | null;
  readonly allowedHosts: string | null;
  readonly fallbackUrl: string;
}

type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

function read(env: EnvSource, name: string): string | null {
  const value = env[name];
  return value == null || value.trim() === "" ? null : value.trim();
}

export function getWhatsappClickTrackingMode(env: EnvSource = process.env): WhatsappClickTrackingMode {
  const raw = read(env, "ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE") ?? "disabled";
  if (raw !== "local-test" && raw !== "enabled") return "disabled";
  if (raw === "local-test" && env.NODE_ENV === "production") return "disabled";
  return raw;
}

export function getWhatsappClickServerEnv(env: EnvSource = process.env): WhatsappClickServerEnv {
  const siteUrl = read(env, "NEXT_PUBLIC_APP_URL");
  let fallbackUrl = "/";
  if (siteUrl) {
    try {
      fallbackUrl = new URL("/", siteUrl).toString();
    } catch {
      fallbackUrl = "/";
    }
  }
  const disabled: WhatsappClickServerEnv = {
    mode: "disabled",
    supabaseUrl: null,
    serviceRoleKey: null,
    siteUrl,
    allowedHosts: null,
    fallbackUrl,
  };
  const mode = getWhatsappClickTrackingMode(env);
  if (mode === "disabled") return disabled;

  const supabaseUrl = read(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = read(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.startsWith("sb_publishable_")) return disabled;
  if (mode === "local-test" && !isLoopbackSupabaseUrl(supabaseUrl)) return disabled;
  if (mode === "enabled" && !isManagedOneDecoreSupabaseUrl(supabaseUrl)) return disabled;

  return { mode, supabaseUrl, serviceRoleKey, siteUrl, allowedHosts: read(env, "ONEDECORE_WHATSAPP_CLICK_ALLOWED_HOSTS"), fallbackUrl };
}
