import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/auth/login", request.url);
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
