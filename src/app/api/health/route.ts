import { NextResponse } from "next/server";

/**
 * Minimal process health for reverse-proxy / process-manager probes.
 * Does not touch Supabase, secrets, or business data.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "onedecore" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
