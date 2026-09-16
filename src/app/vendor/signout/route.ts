import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/vendor/login", request.url), 303);
}

export async function GET(): Promise<NextResponse> {
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
