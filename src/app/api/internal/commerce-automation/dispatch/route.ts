import { timingSafeEqual } from "node:crypto";
import { getCommerceAutomationWorkerSecret } from "@/features/commerce/automation/server/automation-env";
import { dispatchCommerceAutomationJobs } from "@/features/commerce/automation/server/automation-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(): Response {
  return Response.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401, headers: { "cache-control": "no-store" } });
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const expected = getCommerceAutomationWorkerSecret();
  if (!expected) return unauthorized();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !secretsEqual(token, expected)) return unauthorized();

  let maxBatch = 20;
  try {
    const body = (await request.json()) as { maxBatch?: number };
    if (typeof body.maxBatch === "number") maxBatch = body.maxBatch;
  } catch {}

  const result = await dispatchCommerceAutomationJobs({ maxBatch, workerId: "internal-http" });
  return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
}
