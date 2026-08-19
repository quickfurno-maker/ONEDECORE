import { timingSafeEqual } from "node:crypto";
import { getCampaignExecutionWorkerSecret } from "../../../../../features/marketing/execution/server/execution-env.ts";
import { dispatchCampaignRunOperations } from "../../../../../features/marketing/execution/server/dispatcher.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, code: "UNAUTHORIZED" }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const expected = getCampaignExecutionWorkerSecret();
  if (!expected) {
    return unauthorized();
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secretsEqual(token, expected)) {
    return unauthorized();
  }

  let maxBatch = 5;
  try {
    const body = (await request.json()) as { maxBatch?: number };
    if (typeof body.maxBatch === "number") {
      maxBatch = body.maxBatch;
    }
  } catch {
    maxBatch = 5;
  }

  const result = await dispatchCampaignRunOperations({ maxBatch, workerId: "internal-http" });
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
