import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOGIN_PORTAL,
  loginPortalHref,
} from "@/features/staff-admin/contracts/login-portal";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Back to the Admin portal by default. The visible selector is enough to
  // reach the staff one; remembering the prior portal would mean carrying
  // session metadata for a cosmetic convenience.
  const loginUrl = new URL(
    loginPortalHref(DEFAULT_LOGIN_PORTAL),
    request.url
  );
  return NextResponse.redirect(loginUrl, 303);
}

export async function GET(): Promise<NextResponse> {
  return new NextResponse("Method Not Allowed. Sign-out requires a POST request.", {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
}
