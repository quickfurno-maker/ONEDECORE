import { timingSafeEqual } from "node:crypto";
import { getCampaignExecutionWorkerSecret } from "../../../../../features/marketing/execution/server/execution-env.ts";
import { clampWhatsappCampaignWorkerBatch } from "../../../../../features/whatsapp/contracts/campaign-execution.ts";
import { dispatchWhatsappCampaignJobs } from "../../../../../features/whatsapp/server/whatsapp-campaign-worker.ts";

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

  let maxBatch = clampWhatsappCampaignWorkerBatch(undefined);
  try {
    const body = (await request.json()) as { maxBatch?: unknown };
    maxBatch = clampWhatsappCampaignWorkerBatch(body.maxBatch);
  } catch {
    // No body: default batch.
  }

  try {
    const result = await dispatchWhatsappCampaignJobs({ maxBatch, workerId: "internal-http-whatsapp" });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, code: "WORKER_UNAVAILABLE" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
