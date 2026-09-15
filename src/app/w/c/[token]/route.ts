import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  classifyWhatsappClickClient,
  isWhatsappClickToken,
  parseWhatsappClickAllowedHosts,
  resolveSafeWhatsappClickDestination,
} from "@/features/whatsapp/contracts/click-tracking";
import { getWhatsappClickServerEnv } from "@/features/whatsapp/server/whatsapp-click-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * WM-5 opaque click redirect: `/w/c/<token>` from a WhatsApp template URL
 * button. The token is random and carries no PII; the database stores only its
 * hash and answers through a service-role RPC. Unknown, expired, inactive,
 * disallowed or unrecordable tokens all get the SAME redirect to the site
 * home, so the route never reveals whether a token exists. Tracking is off
 * unless ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE is enabled.
 */

const HEADERS = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
} as const;

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { ...HEADERS, location } });
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await context.params;
  const env = getWhatsappClickServerEnv();
  const fallback = env.fallbackUrl;
  if (env.mode === "disabled" || !env.supabaseUrl || !env.serviceRoleKey || !isWhatsappClickToken(token)) {
    return redirect(fallback);
  }

  try {
    const admin = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("record_whatsapp_click", {
      p_token: token,
      p_client_class: classifyWhatsappClickClient(request.headers.get("user-agent")),
    });
    if (error) return redirect(fallback);
    const destination = (data as { destination_url?: unknown } | null)?.destination_url;
    const safe = resolveSafeWhatsappClickDestination(destination, parseWhatsappClickAllowedHosts(env.allowedHosts, env.siteUrl));
    return redirect(safe ?? fallback);
  } catch {
    return redirect(fallback);
  }
}
