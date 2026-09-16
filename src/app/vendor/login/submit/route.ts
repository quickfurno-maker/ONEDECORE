import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/config/env";
import { safeVendorRedirect } from "@/features/commerce/vendor/vendor-auth";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 8 * 1024;
const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

function effectiveOrigin(request: NextRequest): string {
  const first = (raw: string | null) => raw?.split(",")[0]?.trim() || null;
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host")) ?? request.nextUrl.host;
  const proto = first(request.headers.get("x-forwarded-proto")) ?? request.nextUrl.protocol.replace(/:$/, "");
  return `${proto}://${host}`.toLowerCase();
}

function sameOrigin(request: NextRequest): boolean {
  const raw = request.headers.get("origin");
  if (!raw) return false;
  try {
    const origin = new URL(raw);
    return `${origin.protocol.replace(/:$/, "")}://${origin.host}`.toLowerCase() === effectiveOrigin(request);
  } catch {
    return false;
  }
}

function errorResponse(request: NextRequest, next: string): NextResponse {
  const url = new URL("/vendor/login", effectiveOrigin(request));
  url.searchParams.set("error", "invalid");
  if (next !== "/vendor") url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303, headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403, headers: NO_STORE });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413, headers: NO_STORE });
  }
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeVendorRedirect(String(form.get("next") ?? "/vendor"));
  if (!email || !password) return errorResponse(request, next);

  const { url, publishableKey } = getPublicSupabaseEnv();
  const pending: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const headers: Record<string, string> = { ...NO_STORE };
  const jar = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet, responseHeaders) => {
        for (const cookie of cookiesToSet) {
          pending.push(cookie as typeof pending[number]);
          jar.set(cookie.name, cookie.value);
        }
        Object.assign(headers, responseHeaders ?? {});
      },
    },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) return errorResponse(request, next);
  const { data: vendor, error: vendorError } = await supabase.rpc("get_my_commerce_vendor");
  if (vendorError || !vendor) {
    await supabase.auth.signOut();
    return errorResponse(request, next);
  }

  const response = NextResponse.redirect(new URL(next, effectiveOrigin(request)), {
    status: 303,
    headers,
  });
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as never);
  }
  return response;
}
